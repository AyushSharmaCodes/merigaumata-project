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
                await handleDonationWebhook(event, payment, notes);
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

/**
 * Handle Donation Webhook
 */
async function handleDonationWebhook(event, payment, notes) {
    if (event === 'payment.captured') {
        const status = payment.status === RAZORPAY_STATUS.CAPTURED ? PAYMENT_STATUS.SUCCESS : payment.status;

        // One-Time Donation
        if (notes.donation_type === 'ONE_TIME' && payment.order_id) {
            const { data: existingDonation, error: fetchError } = await supabase
                .from('donations')
                .select('*')
                .eq('razorpay_order_id', payment.order_id)
                .maybeSingle();

            if (fetchError) {
                logger.error({ err: fetchError }, 'Donation Webhook Fetch Error:');
                if (fetchError.code !== 'PGRST116') throw new Error(`Donation Webhook DB Error: ${fetchError.message}`);
            }

            if (!existingDonation) {
                return;
            }

            const alreadyProcessed = existingDonation.payment_status === PAYMENT_STATUS.SUCCESS
                && existingDonation.razorpay_payment_id === payment.id;

            const { data: updatedDonation, error } = await supabase
                .from('donations')
                .update({
                    payment_status: status,
                    razorpay_payment_id: payment.id,
                    updated_at: new Date().toISOString()
                })
                .eq('razorpay_order_id', payment.order_id)
                .select()
                .single();

            if (error) {
                logger.error({ err: error }, 'Donation Webhook Update Error:');
                if (error.code !== 'PGRST116') throw new Error(`Donation Webhook DB Error: ${error.message}`);
            } else if (updatedDonation) {
                logger.info(`Donation ${payment.order_id} updated to ${status}`);

                // Send Donation Receipt
                if (status === PAYMENT_STATUS.SUCCESS && !alreadyProcessed) {
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

                    try {
                        const amount = updatedDonation.amount;
                        await emailService.sendDonationReceiptEmail(
                            updatedDonation.donor_email,
                            {
                                donation: updatedDonation,
                                donorName: updatedDonation.donor_name,
                                isAnonymous: updatedDonation.is_anonymous
                            },
                            updatedDonation.user_id
                        );
                    } catch (emailErr) {
                        logger.error({ err: emailErr }, 'Failed to send donation receipt:');
                    }
                }
            }
        }
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

        const { data: existingDonation, error: existingDonationError } = await supabase
            .from('donations')
            .select('id')
            .eq('razorpay_payment_id', payment.id)
            .maybeSingle();

        if (existingDonationError && existingDonationError.code !== 'PGRST116') {
            throw new Error(`Subscription Webhook Existing Fetch Error: ${existingDonationError.message}`);
        }

        const { data: originalDonation, error: fetchError } = await supabase
            .from('donations')
            .select('*')
            .eq('razorpay_subscription_id', subscription.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw new Error(`Subscription Webhook Fetch Error: ${fetchError.message}`);
        }
        if (!originalDonation) {
            logger.error({ err: subscription.id }, 'Subscription Webhook: Original donation not found for');
            return;
        }

        if (!existingDonation) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const unique = crypto.randomBytes(4).toString('hex').toUpperCase();
            const newRef = `DON-SUB-${dateStr}-${unique}`;

            const { data: newDonation, error: insertError } = await supabase
                .from('donations')
                .insert([{
                    donation_reference_id: newRef,
                    user_id: originalDonation.user_id,
                    type: 'monthly',
                    amount: payment.amount / 100,
                    donor_name: originalDonation.donor_name,
                    donor_email: originalDonation.donor_email,
                    donor_phone: originalDonation.donor_phone,
                    is_anonymous: originalDonation.is_anonymous,
                    payment_status: PAYMENT_STATUS.SUCCESS,
                    razorpay_payment_id: payment.id,
                    razorpay_subscription_id: subscription.id,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                logger.error({ err: insertError }, 'Subscription Webhook: Failed to create recurring record');
                throw new Error(`Subscription Webhook Insert Error: ${insertError.message}`);
            } else if (newDonation) {
                logger.info(`Recurring Donation recorded: ${newRef}`);
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
                try {
                    await emailService.sendDonationReceiptEmail(
                        newDonation.donor_email,
                        {
                            donation: newDonation,
                            donorName: newDonation.donor_name,
                            isAnonymous: newDonation.is_anonymous
                        },
                        newDonation.user_id
                    );
                } catch (emailErr) {
                    logger.error({ err: emailErr }, 'Failed to send recurring donation receipt:');
                }
            }
        }

        const { error: subUpdateError } = await supabase
            .from('donation_subscriptions')
            .update({
                status: SUBSCRIPTION_STATUS.ACTIVE,
                current_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : undefined,
                current_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : undefined,
                next_billing_at: subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : undefined,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);

        if (subUpdateError) {
            logger.error({ err: subUpdateError }, 'Subscription Webhook: Failed to update lifecycle status');
            throw new Error(`Subscription Webhook Update Error: ${subUpdateError.message}`);
        }
    }

    if (
        event === 'subscription.cancelled'
        || event === 'subscription.halted'
        || event === 'subscription.paused'
        || event === 'subscription.resumed'
        || event === 'subscription.activated'
        || event === 'subscription.completed'
        || event === 'subscription.expired'
    ) {
        const statusMap = {
            'subscription.cancelled': SUBSCRIPTION_STATUS.CANCELLED,
            'subscription.halted': SUBSCRIPTION_STATUS.HALTED,
            'subscription.paused': SUBSCRIPTION_STATUS.PAUSED,
            'subscription.resumed': SUBSCRIPTION_STATUS.ACTIVE,
            'subscription.activated': SUBSCRIPTION_STATUS.ACTIVE,
            'subscription.completed': 'completed',
            'subscription.expired': 'expired'
        };
        const newStatus = statusMap[event] || 'unknown';

        logger.info(`Subscription ${subscription.id} is now ${newStatus}`);

        await supabase
            .from('donation_subscriptions')
            .update({
                status: newStatus,
                current_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : undefined,
                current_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : undefined,
                next_billing_at: subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : undefined,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);
    }
}

/**
 * Handle Event Registration Webhook
 */
async function handleEventWebhook(event, payment, notes) {
    if (event === 'payment.captured') {
        const status = payment.status === RAZORPAY_STATUS.CAPTURED ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.FAILED;
        const regStatus = status === PAYMENT_STATUS.PAID ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING;

        const { data: updatedReg, error } = await supabase
            .from('event_registrations')
            .update({
                payment_status: status,
                razorpay_payment_id: payment.id,
                status: regStatus,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', payment.order_id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, 'Event Webhook Update Error:');
            if (error.code !== 'PGRST116') throw new Error(`Event Webhook DB Error: ${error.message}`);
        } else if (updatedReg) {
            logger.info(`Event Registration ${payment.order_id} updated to ${status}`);

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
            if (dbPayment.status === PAYMENT_STATUS.PAYMENT_SUCCESS) {
                logger.info(`Idempotency: Payment ${dbPayment.id} already captured`);
                return;
            }

            await updatePaymentRecord(dbPayment.id, {
                status: PAYMENT_STATUS.PAYMENT_SUCCESS, // Standardized robust status
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
                    // Try another way: Some flows might store razorpay_order_id in a different metadata field or we can check payments mapping
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
                        payment_status: PAYMENT_STATUS.PAID,
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
                logger.info(`Order Payment ${dbPayment.id} captured (updated to PAYMENT_SUCCESS)`);
            } else {
                logger.warn(`Order Webhook: Payment record orphaned (no order_id) for ${payment.order_id}. Flagging for sweep.`);
                await updatePaymentRecord(dbPayment.id, {
                    status: 'CAPTURED_ORPHAN',
                    updated_at: new Date().toISOString()
                });
            }
        } else {
            logger.warn(`Order Webhook: Payment record not found for ${payment.order_id}`);
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
            await updatePaymentRecord(dbPayment.id, {
                status: PAYMENT_STATUS.PAYMENT_FAILED,
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
            logger.info(`Order Payment ${dbPayment.id} marked as PAYMENT_FAILED`);
        }
    } else if (event === 'refund.processed' && data.refund) {
        const refundEntity = data.refund.entity;
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
            .select() // Return the record to check type
            .single();

        // If refund record doesn't exist (e.g. manual RP dashboard refund), create it?
        // Deployment rule: "Refund type... driven by backend". If missing, it's external.
        if (refundUpdateError && refundUpdateError.code !== 'PGRST116') {
            throw new Error(`Webhook Refund Update Error: ${refundUpdateError.message}`);
        }

        if (!updatedRefund && refundUpdateError) {
            logger.warn(`[Webhook] Refund record not found for ${refundEntity.id}. Creating default BUSINESS_REFUND.`);
            // Auto-create for manual dashboard refunds
            await supabase.from('refunds').insert({
                payment_id: dbPayment.id,
                order_id: dbPayment.order_id,
                razorpay_refund_id: refundEntity.id,
                amount: refundAmount,
                refund_type: 'BUSINESS_REFUND', // Default assumption
                razorpay_refund_status: 'PROCESSED',
                status: REFUND_JOB_STATUS.PROCESSED,
                reason: 'Manually initiated via Dashboard'
            });
        }

        // 3. Recalculate Totals
        // Fetch valid processed refunds to sum up
        const { data: allRefunds, error: allRefundsFetchError } = await supabase
            .from('refunds')
            .select('amount')
            .eq('payment_id', dbPayment.id)
            .in('razorpay_refund_status', ['PROCESSED']);

        if (allRefundsFetchError) {
            throw new Error(`Webhook All Refunds Fetch Error: ${allRefundsFetchError.message}`);
        }

        const totalRefunded = allRefunds?.reduce((sum, r) => sum + Number(r.amount), 0) || refundAmount;

        // "Full refund" must mean the customer received the full paid amount back.
        // Cancelled/returned business refunds may still be partial if some delivery is non-refundable.
        const isFullRefund = totalRefunded >= totalPaid;

        const newPaymentStatus = isFullRefund ? PAYMENT_STATUS.REFUND_COMPLETED : PAYMENT_STATUS.REFUND_PARTIAL;

        // 5. Update Payment
        const { error: refundPaymentUpdateError } = await supabase
            .from('payments')
            .update({
                status: newPaymentStatus,
                total_refunded_amount: totalRefunded,
                updated_at: new Date().toISOString()
            })
            .eq('id', dbPayment.id);

        if (refundPaymentUpdateError) {
            throw new Error(`Webhook Refund Payment Update Error: ${refundPaymentUpdateError.message}`);
        }

        logger.info(`[Webhook] Payment ${dbPayment.id} updated to ${newPaymentStatus} (Total Refunded: ${totalRefunded})`);

        // 6. Update Order Status & Timeline
        if (dbPayment.order_id) {
            const orderStatus = isFullRefund ? 'refunded' : 'partially_refunded'; // UI mapping

            const { error: finalOrderUpdateError } = await supabase
                .from('orders')
                .update({
                    payment_status: orderStatus,
                    status: isFullRefund ? ORDER_STATUS.REFUNDED : ORDER_STATUS.CONFIRMED,
                    updated_at: new Date().toISOString()
                })
                .eq('id', dbPayment.order_id);

            if (finalOrderUpdateError) {
                throw new Error(`Webhook Final Order Update Error: ${finalOrderUpdateError.message}`);
            }

            // Sync Invoice Status
            await supabaseAdmin
                .from('invoices')
                .update({
                    status: isFullRefund ? 'cancelled' : 'partially_refunded',
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', dbPayment.order_id)
                .eq('type', 'RAZORPAY');

            // Log Timeline match
            const eventType = isFullRefund ? 'REFUND_COMPLETED' : 'REFUND_PARTIAL';
            await orderService.logStatusHistory(
                dbPayment.order_id,
                orderStatus,
                'SYSTEM',
                ORDER.REFUND_PROCESSED_NOTE,
                'SYSTEM',
                eventType
            );
        }

        if (updatedRefund?.order_id) {
            await RefundService.syncOrderRefunds(updatedRefund.order_id, false, 'SYSTEM');
        }
    }


}

module.exports = webhookService;
