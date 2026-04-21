const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { updatePaymentRecord } = require('./checkout.service');
const emailService = require('./email');
const crypto = require('crypto');
const orderService = require('./order.service');
const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
const { RefundService, REFUND_JOB_STATUS } = require('./refund.service');
const { ORDER_STATUS, PAYMENT_STATUS, RAZORPAY_STATUS, SUBSCRIPTION_STATUS } = require('../config/constants');
const { ORDER } = require('../constants/messages');
const realtimeService = require('./realtime.service');
const { capturePayment, fetchPayment } = require('../utils/razorpay-helper');
const { normalizePaymentStatus, isPaymentSuccess, isTerminalStatus, isTransitionAllowed } = require('../utils/status-mapper');

/**
 * Webhook Service
 * Central dispatcher for Razorpay Webhook Events
 */
const webhookService = {
    handleEvent: async (payload) => {
        const { event, payload: data } = payload;
        const payment = data.payment?.entity;

        try {
            // Subscription lifecycle events can arrive without a payment entity.
            if (event.startsWith('subscription.')) {
                await handleSubscriptionWebhook(event, payment, data);
                return;
            }

            if (!payment) return;

            logger.info(`Webhook: Processing ${event} for Order ${payment.order_id}`);
            const notes = payment.notes || {};

            // 1. Check for DONATION
            if (notes.payment_purpose === 'DONATION') {
                await handleDonationWebhook(event, payment, notes, data);
                return;
            }

            // 2. Check for EVENT REGISTRATION
            if (notes.eventId || notes.eventTitle) {
                await handleEventWebhook(event, payment, notes);
                return;
            }

            // 3. Default: E-Commerce ORDER
            if (!notes.eventId && !notes.eventTitle) {
                await handleOrderWebhook(event, data, payment);
            }

        } catch (error) {
            logger.error({ err: error }, 'Webhook Handler Error:');
            throw error;
        }
    }
};

function generateDonationRef(prefix = 'DON-WH') {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const unique = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${dateStr}-${unique}`;
}

function toIsoTimestamp(unixSeconds) {
    return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : undefined;
}

async function sendDonationReceipt(donation) {
    if (!donation?.donor_email || donation.is_anonymous) return;

    try {
        await emailService.sendDonationReceiptEmail(
            donation.donor_email,
            {
                donation,
                donorName: donation.donor_name,
                isAnonymous: donation.is_anonymous
            },
            donation.user_id
        );
    } catch (emailErr) {
        logger.error({ err: emailErr }, 'Failed to send donation receipt:');
    }
}

async function markOneTimeDonationSuccess(payment) {
    const { data: existingDonation, error: fetchError } = await supabase
        .from('donations')
        .select('*')
        .eq('razorpay_order_id', payment.order_id)
        .maybeSingle();

    if (fetchError) {
        logger.error({ err: fetchError }, 'Donation Webhook Fetch Error:');
        if (fetchError.code !== 'PGRST116') throw new Error(`Donation Webhook DB Error: ${fetchError.message}`);
    }

    if (!existingDonation) return;

    // Idempotency + downgrade protection: skip if already in terminal state
    const normalized = normalizePaymentStatus(existingDonation.payment_status);
    if (isPaymentSuccess(normalized) || normalized === PAYMENT_STATUS.REFUNDED) {
        logger.info(`Idempotency: Donation ${existingDonation.id} already in terminal state ${normalized}`);
        return;
    }

    const { data: updatedDonation, error } = await supabase
        .from('donations')
        .update({
            payment_status: PAYMENT_STATUS.SUCCESS,
            razorpay_payment_id: payment.id,
            updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id)
        .select()
        .single();

    if (error) {
        logger.error({ err: error }, 'Donation Webhook Update Error:');
        if (error.code !== 'PGRST116') throw new Error(`Donation Webhook DB Error: ${error.message}`);
        return;
    }

    realtimeService.publish({
        topic: 'dashboard',
        type: 'donation.created',
        audience: 'staff',
        payload: {
            donationId: updatedDonation.id,
            amount: updatedDonation.amount,
            type: updatedDonation.type
        }
    });

    await sendDonationReceipt(updatedDonation);
}

async function markOneTimeDonationAuthorized(payment) {
    const { error } = await supabase
        .from('donations')
        .update({
            payment_status: PAYMENT_STATUS.AUTHORIZED,
            razorpay_payment_id: payment.id,
            updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id);

    if (error && error.code !== 'PGRST116') {
        throw new Error(`Donation authorization update error: ${error.message}`);
    }
}

async function markOneTimeDonationFailed(payment) {
    const { error } = await supabase
        .from('donations')
        .update({
            payment_status: PAYMENT_STATUS.FAILED,
            razorpay_payment_id: payment.id,
            updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id);

    if (error && error.code !== 'PGRST116') {
        throw new Error(`Donation failure update error: ${error.message}`);
    }
}

async function getSubscriptionContext(subscriptionId) {
    const { data: subscriptionRecord, error: subscriptionError } = await supabase
        .from('donation_subscriptions')
        .select('*')
        .eq('razorpay_subscription_id', subscriptionId)
        .maybeSingle();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        throw new Error(`Subscription fetch error: ${subscriptionError.message}`);
    }

    if (subscriptionRecord) {
        return subscriptionRecord;
    }

    const { data: seedDonation, error: donationError } = await supabase
        .from('donations')
        .select('*')
        .eq('razorpay_subscription_id', subscriptionId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (donationError && donationError.code !== 'PGRST116') {
        throw new Error(`Subscription seed donation fetch error: ${donationError.message}`);
    }

    return seedDonation || null;
}

async function recordRecurringDonation(payment, subscription, status) {
    const { data: existingDonation, error: existingDonationError } = await supabase
        .from('donations')
        .select('*')
        .eq('razorpay_payment_id', payment.id)
        .maybeSingle();

    if (existingDonationError && existingDonationError.code !== 'PGRST116') {
        throw new Error(`Subscription Webhook Existing Fetch Error: ${existingDonationError.message}`);
    }

    if (existingDonation) {
        if (existingDonation.payment_status !== status) {
            await supabase
                .from('donations')
                .update({
                    payment_status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingDonation.id);
        }
        return { donation: existingDonation, created: false };
    }

    const seed = await getSubscriptionContext(subscription.id);
    if (!seed) {
        logger.error({ subscriptionId: subscription.id, paymentId: payment.id }, 'Subscription Webhook: No local subscription context found');
        return { donation: null, created: false };
    }

    const { data: newDonation, error: insertError } = await supabase
        .from('donations')
        .insert([{
            donation_reference_id: generateDonationRef(status === PAYMENT_STATUS.FAILED ? 'DON-SUB-FAIL' : 'DON-SUB'),
            user_id: seed.user_id || null,
            type: 'monthly',
            amount: payment.amount / 100,
            donor_name: seed.donor_name,
            donor_email: seed.donor_email,
            donor_phone: seed.donor_phone,
            is_anonymous: seed.is_anonymous || false,
            payment_status: status,
            razorpay_payment_id: payment.id,
            razorpay_subscription_id: subscription.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (insertError) {
        logger.error({ err: insertError }, 'Subscription Webhook: Failed to create recurring record');
        throw new Error(`Subscription Webhook Insert Error: ${insertError.message}`);
    }

    return { donation: newDonation, created: true };
}

/**
 * Handle Donation Webhook
 */
async function handleDonationWebhook(event, payment, notes) {
    if (notes.donation_type === 'ONE_TIME' && payment.order_id) {
        if (event === 'payment.authorized') {
            await markOneTimeDonationAuthorized(payment);

            const paymentState = await fetchPayment(payment.id).catch(() => payment);
            if (paymentState?.status !== RAZORPAY_STATUS.CAPTURED) {
                await capturePayment(payment.id, payment.amount / 100);
            }

            const refreshedPayment = await fetchPayment(payment.id).catch(() => paymentState);
            if (refreshedPayment?.status === RAZORPAY_STATUS.CAPTURED) {
                await markOneTimeDonationSuccess({
                    ...payment,
                    status: RAZORPAY_STATUS.CAPTURED
                });
            }
            return;
        }

        if (event === 'payment.captured') {
            await markOneTimeDonationSuccess(payment);
            return;
        }

        if (event === 'payment.failed') {
            await markOneTimeDonationFailed(payment);
        }
        return;
    }

    if (notes.donation_type === 'MONTHLY' && payment.subscription_id && event === 'payment.failed') {
        await recordRecurringDonation(payment, { id: payment.subscription_id }, PAYMENT_STATUS.FAILED);
    }
}

/**
 * Handle Subscription Charged Webhook
 */
async function handleSubscriptionWebhook(event, payment, payload) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    if (event === 'subscription.charged') {
        if (!payment) {
            throw new Error('Subscription charge webhook missing payment entity');
        }

        logger.info(`Processing Subscription Charge: ${subscription.id} for Payment ${payment.id}`);
        const { donation: newDonation, created } = await recordRecurringDonation(payment, subscription, PAYMENT_STATUS.SUCCESS);

        const { error: subUpdateError } = await supabase
            .from('donation_subscriptions')
            .update({
                status: SUBSCRIPTION_STATUS.ACTIVE,
                current_start: toIsoTimestamp(subscription.current_start),
                current_end: toIsoTimestamp(subscription.current_end),
                next_billing_at: toIsoTimestamp(subscription.charge_at),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);

        if (subUpdateError) {
            logger.error({ err: subUpdateError }, 'Subscription Webhook: Failed to update lifecycle status');
            throw new Error(`Subscription Webhook Update Error: ${subUpdateError.message}`);
        }

        if (newDonation && created) {
            logger.info(`Recurring Donation recorded: ${newDonation.donation_reference_id}`);
            realtimeService.publish({
                topic: 'dashboard',
                type: 'donation.created',
                audience: 'staff',
                payload: {
                    donationId: newDonation.id,
                    amount: newDonation.amount,
                    type: newDonation.type
                }
            });
            await sendDonationReceipt(newDonation);
        }
    }

    if (event === 'payment.failed' && payment && payment.subscription_id === subscription.id) {
        await recordRecurringDonation(payment, subscription, PAYMENT_STATUS.FAILED);
        return;
    }

    if (
        event === 'subscription.cancelled'
        || event === 'subscription.halted'
        || event === 'subscription.paused'
        || event === 'subscription.resumed'
        || event === 'subscription.activated'
        || event === 'subscription.authenticated'
        || event === 'subscription.pending'
        || event === 'subscription.completed'
        || event === 'subscription.expired'
    ) {
        const statusMap = {
            'subscription.cancelled': SUBSCRIPTION_STATUS.CANCELLED,
            'subscription.halted': SUBSCRIPTION_STATUS.HALTED,
            'subscription.paused': SUBSCRIPTION_STATUS.PAUSED,
            'subscription.resumed': SUBSCRIPTION_STATUS.ACTIVE,
            'subscription.activated': SUBSCRIPTION_STATUS.ACTIVE,
            'subscription.authenticated': 'authenticated',
            'subscription.pending': PAYMENT_STATUS.PENDING,
            'subscription.completed': 'completed',
            'subscription.expired': 'expired'
        };
        const newStatus = statusMap[event] || 'unknown';

        logger.info(`Subscription ${subscription.id} is now ${newStatus}`);

        await supabase
            .from('donation_subscriptions')
            .update({
                status: newStatus,
                current_start: toIsoTimestamp(subscription.current_start),
                current_end: toIsoTimestamp(subscription.current_end),
                next_billing_at: toIsoTimestamp(subscription.charge_at),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);
    }
}

/**
 * Handle Event Registration Webhook
 * 
 * Handles: payment.captured, payment.failed
 * Guards: Idempotency (skip if already SUCCESS), Downgrade protection (no SUCCESS→FAILED)
 */
async function handleEventWebhook(event, payment, notes) {
    if (event === 'payment.captured') {
        // Downgrade protection: check current state before updating
        const { data: existingReg } = await supabase
            .from('event_registrations')
            .select('id, payment_status, status')
            .eq('razorpay_order_id', payment.order_id)
            .maybeSingle();

        if (!existingReg) {
            // CAPTURED_ORPHAN: payment captured but no registration found
            logger.error({ razorpay_order_id: payment.order_id, razorpay_payment_id: payment.id },
                'Event Webhook: Registration not found for captured payment. Recording as orphan.');
            return;
        }

        const currentStatus = normalizePaymentStatus(existingReg.payment_status);
        if (isPaymentSuccess(currentStatus) || currentStatus === PAYMENT_STATUS.REFUNDED) {
            logger.info(`Idempotency: Event registration ${existingReg.id} already in terminal state ${currentStatus}`);
            return;
        }

        const newPaymentStatus = payment.status === RAZORPAY_STATUS.CAPTURED ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.FAILED;
        const regStatus = newPaymentStatus === PAYMENT_STATUS.SUCCESS ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING;

        const { data: updatedReg, error } = await supabase
            .from('event_registrations')
            .update({
                payment_status: newPaymentStatus,
                razorpay_payment_id: payment.id,
                status: regStatus,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', payment.order_id)
            .neq('payment_status', PAYMENT_STATUS.SUCCESS) // Idempotent write guard
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, 'Event Webhook Update Error:');
            if (error.code !== 'PGRST116') throw new Error(`Event Webhook DB Error: ${error.message}`);
        } else if (updatedReg) {
            logger.info(`Event Registration ${payment.order_id} updated to ${newPaymentStatus}`);

            // Send Event Registration Email
            if (regStatus === ORDER_STATUS.CONFIRMED) {
                realtimeService.publish({
                    topic: 'dashboard',
                    type: 'event_registration.created',
                    audience: 'staff',
                    payload: {
                        registrationId: updatedReg.id,
                        eventId: updatedReg.event_id,
                        status: updatedReg.status
                    }
                });

                try {
                    // We need event details 
                    const { data: eventDetails } = await supabase
                        .from('events')
                        .select('title, date, location')
                        .eq('id', updatedReg.event_id)
                        .maybeSingle();

                    if (eventDetails) {
                        await emailService.sendEventRegistrationEmail(
                            updatedReg.email,
                            {
                                event: eventDetails,
                                registration: updatedReg,
                                attendeeName: updatedReg.name
                            },
                            updatedReg.user_id
                        );
                    }
                } catch (emailErr) {
                    logger.error({ err: emailErr }, 'Failed to send event registration email:');
                }
            }
        }
    } else if (event === 'payment.failed') {
        // FIX A5: Handle payment.failed for events (was completely missing)
        const { data: existingReg } = await supabase
            .from('event_registrations')
            .select('id, payment_status')
            .eq('razorpay_order_id', payment.order_id)
            .maybeSingle();

        if (!existingReg) {
            logger.warn({ razorpay_order_id: payment.order_id }, 'Event Webhook (failed): Registration not found');
            return;
        }

        // Downgrade protection: never overwrite SUCCESS with FAILED
        const currentStatus = normalizePaymentStatus(existingReg.payment_status);
        if (isPaymentSuccess(currentStatus) || currentStatus === PAYMENT_STATUS.REFUNDED) {
            logger.info(`Downgrade blocked: Event reg ${existingReg.id} is ${currentStatus}, ignoring payment.failed`);
            return;
        }

        const { error } = await supabase
            .from('event_registrations')
            .update({
                payment_status: PAYMENT_STATUS.FAILED,
                status: 'failed',
                razorpay_payment_id: payment.id,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', payment.order_id)
            .not('payment_status', 'in', `(${PAYMENT_STATUS.SUCCESS},${PAYMENT_STATUS.REFUNDED})`); // Safety guard

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Event Webhook (failed) DB Error: ${error.message}`);
        }
        logger.info(`Event Registration ${payment.order_id} marked as FAILED via webhook`);
    }
}

/**
 * Handle E-commerce Order Webhook
 */
// ... (imports remain same)

async function handleOrderWebhook(event, payload, payment) {
    if (event === 'payment.captured' && payment) {
        const { data: dbPayment, error: fetchPaymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_order_id', payment.order_id)
            .maybeSingle();

        if (fetchPaymentError && fetchPaymentError.code !== 'PGRST116') {
            throw new Error(`Webhook Fetch Error (payments): ${fetchPaymentError.message}`);
        }

        if (dbPayment) {
            // Idempotency + downgrade protection using normalized status
            const currentStatus = normalizePaymentStatus(dbPayment.status);
            if (isPaymentSuccess(currentStatus) || currentStatus === PAYMENT_STATUS.REFUNDED || currentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
                logger.info(`Idempotency: Payment ${dbPayment.id} already in terminal state ${currentStatus}`);
                return;
            }

            await updatePaymentRecord(dbPayment.id, {
                status: PAYMENT_STATUS.SUCCESS, // Normalized: webhook is final authority
                razorpay_payment_id: payment.id,
                method: payment.method,
                updated_at: new Date().toISOString()
            });

            let orderId = dbPayment.order_id;

            // RECOVERY: If order_id is missing in payment record, try to find it via payment_id in orders table
            if (!orderId) {
                const { data: orderRec } = await supabaseAdmin
                    .from('orders')
                    .select('id')
                    .eq('payment_id', dbPayment.id)
                    .maybeSingle();

                if (!orderRec) {
                    logger.warn({ razorpay_order_id: payment.order_id, paymentId: dbPayment.id }, "Webhook: Order ID not found in payment record or orders table");
                } else {
                    orderId = orderRec.id;
                    logger.info({ orderId, paymentId: dbPayment.id }, "Webhook: Resolved Order ID from orders table");
                }
            }

            if (orderId) {
                // User requested that orders NOT be auto-confirmed by system. Leaving status as 'pending'.
                const { data: updatedOrder, error: orderUpdateError } = await supabaseAdmin
                    .from('orders')
                    .update({
                        payment_status: 'paid', // orders.payment_status keeps lowercase for UI compat
                        status: ORDER_STATUS.PENDING,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', orderId)
                    .select('*, orderItems(*)')
                    .single();

                if (orderUpdateError && orderUpdateError.code !== 'PGRST116') {
                    throw new Error(`Webhook Order Update Error: ${orderUpdateError.message}`);
                }

                // Sync Invoice Status
                const { error: invoiceUpdateError } = await supabaseAdmin
                    .from('invoices')
                    .update({
                        status: 'paid',
                        updated_at: new Date().toISOString()
                    })
                    .eq('order_id', orderId)
                    .eq('type', 'RAZORPAY');

                if (invoiceUpdateError) {
                    logger.error({ err: invoiceUpdateError }, 'Webhook Invoice Sync Error');
                }

                // Log Timeline: PAYMENT_SUCCESS
                await orderService.logStatusHistory(
                    orderId,
                    'PAYMENT_SUCCESS',
                    'SYSTEM',
                    ORDER.PAYMENT_SUCCESS_NOTE
                );

                // Send Order Placed Email (v2)
                if (updatedOrder) {
                    try {
                        const hasRazorpayReceipt = (updatedOrder.invoices || []).some(inv => inv.type === 'RAZORPAY');
                        if (!hasRazorpayReceipt) {
                            try {
                                logger.info({ orderId: updatedOrder.id }, 'Generating missing Razorpay receipt via webhook');
                                const result = await InvoiceOrchestrator.generateRazorpayInvoice({
                                    ...updatedOrder,
                                    items: updatedOrder.order_items
                                });
                                if (result.success && result.invoiceUrl) {
                                    updatedOrder.invoiceUrl = result.invoiceUrl;
                                }
                            } catch (invErr) {
                                logger.warn({ err: invErr }, 'Failed to generate Razorpay receipt in webhook');
                            }
                        }

                        // Send "Order Placed" email (includes receipt link)
                        await emailService.sendOrderPlacedEmail(
                            updatedOrder.customer_email,
                            {
                                order: updatedOrder,
                                customerName: updatedOrder.customer_name,
                                receiptUrl: updatedOrder.invoiceUrl
                            },
                            updatedOrder.user_id
                        );
                    } catch (emailErr) {
                        logger.error({ err: emailErr }, 'Failed to send order placed email via webhook:');
                    }
                }
                logger.info(`Order Payment ${dbPayment.id} captured (updated to SUCCESS)`);
            } else {
                // CAPTURED_ORPHAN recovery: payment exists but no order linked
                logger.warn(`Order Webhook: Payment record orphaned (no order_id) for ${payment.order_id}. Flagging for sweep.`);
                await updatePaymentRecord(dbPayment.id, {
                    status: PAYMENT_STATUS.CAPTURED_ORPHAN,
                    updated_at: new Date().toISOString()
                });
            }
        } else {
            // CAPTURED_ORPHAN: No payment record at all — webhook arrived before verify created it
            logger.error({ razorpay_order_id: payment.order_id, razorpay_payment_id: payment.id },
                'Order Webhook: Payment record not found. Creating CAPTURED_ORPHAN record for reconciliation.');
            try {
                await supabase.from('payments').insert({
                    razorpay_order_id: payment.order_id,
                    razorpay_payment_id: payment.id,
                    amount: payment.amount / 100,
                    currency: payment.currency || 'INR',
                    method: payment.method,
                    status: PAYMENT_STATUS.CAPTURED_ORPHAN,
                    metadata: { source: 'webhook_recovery', original_status: payment.status }
                });
            } catch (orphanErr) {
                // May fail due to unique constraint if verify creates it concurrently — that's fine
                logger.warn({ err: orphanErr }, 'CAPTURED_ORPHAN insert failed (likely concurrent verify)');
            }
        }
    } else if (event === 'payment.failed' && payment) {
        const { data: dbPayment, error: paymentFetchFailedError } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_order_id', payment.order_id)
            .maybeSingle();

        if (paymentFetchFailedError && paymentFetchFailedError.code !== 'PGRST116') {
            throw new Error(`Webhook Fetch Error (payments_failed): ${paymentFetchFailedError.message}`);
        }

        if (dbPayment) {
            // Downgrade protection: never overwrite SUCCESS/REFUNDED with FAILED
            const currentStatus = normalizePaymentStatus(dbPayment.status);
            if (isPaymentSuccess(currentStatus) || currentStatus === PAYMENT_STATUS.REFUNDED) {
                logger.info(`Downgrade blocked: Payment ${dbPayment.id} is ${currentStatus}, ignoring payment.failed`);
                return;
            }

            await updatePaymentRecord(dbPayment.id, {
                status: PAYMENT_STATUS.FAILED,
                error_description: payment.error_description || 'Payment Failed via Webhook',
                updated_at: new Date().toISOString()
            });

            if (dbPayment.order_id) {
                await orderService.logStatusHistory(
                    dbPayment.order_id,
                    'PAYMENT_FAILED',
                    'SYSTEM',
                    ORDER.PAYMENT_FAILED_NOTE
                );
            }
            logger.info(`Order Payment ${dbPayment.id} marked as FAILED`);
        }
    } else if (event === 'refund.processed' && payload.refund) {
        const refundEntity = payload.refund.entity;
        logger.info(`[Webhook] Refund processed: ${refundEntity.id} for payment ${refundEntity.payment_id}`);

        // 1. Fetch Payment & Existing Refunds
        const { data: dbPayment, error: paymentError } = await supabase
            .from('payments')
            .select('*, refunds(*)') // Fetch related refunds
            .eq('razorpay_payment_id', refundEntity.payment_id)
            .maybeSingle();

        if (paymentError && paymentError.code !== 'PGRST116') {
            throw new Error(`Database error fetching payment for refund: ${paymentError.message}`);
        }
        if (!dbPayment) {
            logger.error(`[Webhook] Error finding payment for refund:`, paymentError || 'Not Found');
            return;
        }

        const refundAmount = Number(refundEntity.amount) / 100;
        const totalPaid = Number(dbPayment.amount);

        // Calculate total refunded including this new one (if not already recorded in DB sum)
        // We rely on 'total_refunded_amount' column + this current refund if it's the one being processed.
        // However, webhooks are async. Safe way: sum all 'PROCESSED' refunds + this one.
        // Simplest Robust Way: Update this refund status -> Sum all refunds -> Update Payment Status

        // 2. Update Specific Refund Status
        const { data: updatedRefund, error: refundUpdateError } = await supabase
            .from('refunds')
            .update({
                razorpay_refund_status: RAZORPAY_STATUS.PROCESSED,
                status: REFUND_JOB_STATUS.PROCESSED,
                amount: refundAmount, // Ensure strict sync
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_refund_id', refundEntity.id)
            .select() 
            .single();

        if (refundUpdateError && refundUpdateError.code !== 'PGRST116') {
            throw new Error(`Webhook Refund Update Error: ${refundUpdateError.message}`);
        }

        if (!updatedRefund && refundUpdateError) {
            logger.warn(`[Webhook] Refund record not found for ${refundEntity.id}. Creating default BUSINESS_REFUND.`);
            await supabase.from('refunds').insert({
                payment_id: dbPayment.id,
                order_id: dbPayment.order_id,
                razorpay_refund_id: refundEntity.id,
                amount: refundAmount,
                refund_type: 'BUSINESS_REFUND', 
                razorpay_refund_status: 'PROCESSED',
                status: REFUND_JOB_STATUS.PROCESSED,
                reason: 'Manually initiated via Dashboard'
            });
        }

        // Sum up all PROCESSED refunds to determine if we are now at "Full Refund" state
        const { data: allRefunds, error: allRefundsFetchError } = await supabase
            .from('refunds')
            .select('amount')
            .eq('payment_id', dbPayment.id)
            .in('razorpay_refund_status', ['PROCESSED']);

        if (allRefundsFetchError) {
            throw new Error(`Webhook All Refunds Fetch Error: ${allRefundsFetchError.message}`);
        }

        const totalRefunded = allRefunds?.reduce((sum, r) => sum + Number(r.amount), 0) || refundAmount;
        const isFullRefund = totalRefunded >= totalPaid;

        // Determine terminal statuses while preserving lifecycle context (Cancelled/Returned)
        // If order was already cancelled, keep it cancelled but mark payment as refunded.
        const { data: order, error: orderFetchError } = await supabaseAdmin
            .from('orders')
            .select('status, id')
            .eq('id', dbPayment.order_id)
            .maybeSingle();

        if (orderFetchError) logger.error(`[Webhook] Error fetching order context: ${orderFetchError.message}`);

        const currentOrderStatus = order?.status || 'pending';
        const terminalOrderStatus = (
            currentOrderStatus === 'cancelled' ||
            currentOrderStatus === 'cancelled_by_admin' ||
            currentOrderStatus === 'cancelled_by_customer' ||
            currentOrderStatus === 'returned' ||
            currentOrderStatus === 'partially_returned'
        ) 
            ? currentOrderStatus 
            : (isFullRefund ? 'refunded' : 'partially_refunded');

        const newPaymentStatus = isFullRefund ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
        const orderPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

        // 3. Perform Atomic Updates
        // A. Update Payment Record
        const { error: refundPaymentUpdateError } = await supabase
            .from('payments')
            .update({
                status: newPaymentStatus,
                total_refunded_amount: totalRefunded,
                updated_at: new Date().toISOString()
            })
            .eq('id', dbPayment.id);

        if (refundPaymentUpdateError) throw new Error(`Webhook Refund Payment Update Error: ${refundPaymentUpdateError.message}`);

        // B. Update Order Record
        if (dbPayment.order_id) {
            const { error: finalOrderUpdateError } = await supabaseAdmin
                .from('orders')
                .update({
                    payment_status: orderPaymentStatus,
                    status: terminalOrderStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', dbPayment.order_id);

            if (finalOrderUpdateError) throw new Error(`Webhook Final Order Update Error: ${finalOrderUpdateError.message}`);

            // C. Log History: Explicit transition to REFUND_COMPLETED/PARTIAL
            const eventType = isFullRefund ? 'REFUND_COMPLETED' : 'REFUND_PARTIAL';
            await orderService.logStatusHistory(
                dbPayment.order_id,
                terminalOrderStatus,
                'SYSTEM',
                `${ORDER.REFUND_PROCESSED_NOTE} (Settled by Gateway)`,
                'SYSTEM',
                eventType
            );

            // D. BROADCAST: Trigger real-time UI refresh for Admin Portal
            realtimeService.publish({
                topic: 'orders',
                type: 'order.updated',
                payload: { orderId: dbPayment.order_id, status: terminalOrderStatus }
            });

            // E. Sync Invoice
            await supabaseAdmin
                .from('invoices')
                .update({
                    status: isFullRefund ? 'cancelled' : 'partially_refunded',
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', dbPayment.order_id)
                .eq('type', 'RAZORPAY');
        }

        if (updatedRefund?.order_id) {
            await RefundService.syncOrderRefunds(updatedRefund.order_id, false, 'SYSTEM');
        }
    }
}

module.exports = webhookService;
