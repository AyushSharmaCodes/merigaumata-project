const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { capturePayment, voidAuthorization } = require('../utils/razorpay-helper');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');
const emailService = require('./email');
const { DONATION, LOGS, COMMON, SYSTEM } = require('../constants/messages');

// Initialize Razorpay
const razorpay = wrapRazorpayWithTimeout(new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}));

/**
 * Generate unique donation reference ID
 * Format: DON-YYYYMMDD-UUID (short)
 */
function generateDonationRef() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const unique = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `DON-${dateStr}-${unique}`;
}

/**
 * Donation Service
 * Handles One-Time and Monthly Donation logic with Razorpay
 */
class DonationService {
    static createHttpError(message, status) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    static async findReusableOneTimeDonationIntent({ userId, amount, donorEmail, donorPhone, isAnonymous }) {
        let query = supabase
            .from('donations')
            .select('donation_reference_id, razorpay_order_id, amount, currency, donor_name, donor_email, donor_phone, created_at')
            .eq('type', 'one_time')
            .in('payment_status', ['pending', 'authorized'])
            .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
            .eq('amount', amount)
            .order('created_at', { ascending: false })
            .limit(1);

        if (userId) {
            query = query.eq('user_id', userId);
        } else if (!isAnonymous && donorEmail) {
            query = query.eq('donor_email', donorEmail);
        } else if (!isAnonymous && donorPhone) {
            query = query.eq('donor_phone', donorPhone);
        } else {
            return null;
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
            logger.warn({ err: error, userId, donorEmail }, 'Failed to check for reusable donation intent');
            return null;
        }

        if (!data?.razorpay_order_id) {
            return null;
        }

        return data;
    }

    static async findReusableSubscription({ userId, amount }) {
        if (!userId) {
            return null;
        }

        const { data, error } = await supabase
            .from('donation_subscriptions')
            .select('razorpay_subscription_id, donation_reference_id, amount, donor_name, donor_email, donor_phone, created_at')
            .eq('user_id', userId)
            .eq('amount', amount)
            .in('status', ['created', 'authenticated', 'active', 'pending'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.warn({ err: error, userId, amount }, 'Failed to check for reusable donation subscription');
            return null;
        }

        return data || null;
    }

    /**
     * Create One-Time Donation Order
     */
    static async createOneTimeOrder(userId, { amount, donorName, donorEmail, donorPhone, isAnonymous }) {
        if (!amount || amount <= 0) {
            throw new Error(DONATION.INVALID_AMOUNT);
        }

        const existingIntent = await this.findReusableOneTimeDonationIntent({
            userId,
            amount,
            donorEmail,
            donorPhone,
            isAnonymous
        });

        if (existingIntent) {
            logger.info({
                userId,
                donationRef: existingIntent.donation_reference_id,
                razorpayOrderId: existingIntent.razorpay_order_id
            }, 'Reusing recent one-time donation intent');

            return {
                order_id: existingIntent.razorpay_order_id,
                amount: Math.round(Number(existingIntent.amount) * 100),
                currency: existingIntent.currency || 'INR',
                key_id: process.env.RAZORPAY_KEY_ID,
                donation_ref: existingIntent.donation_reference_id,
                donor_name: existingIntent.donor_name || (isAnonymous ? DONATION.ANONYMOUS_DONOR : donorName),
                donor_email: donorEmail,
                donor_contact: donorPhone,
                reused: true
            };
        }

        const donationRef = generateDonationRef();
        const receipt = `don_${Date.now()}`;

        // Create Razorpay Order with MANUAL CAPTURE
        const orderOptions = {
            amount: Math.round(amount * 100), // in paise
            currency: 'INR',
            receipt,
            payment_capture: 0, // MANUAL CAPTURE - capture only after DB success
            notes: {
                payment_purpose: 'DONATION',
                donation_type: 'ONE_TIME',
                donation_reference_id: donationRef,
                anonymous: isAnonymous ? 'true' : 'false',
                donor_email: isAnonymous ? 'hidden' : donorEmail
            }
        };

        const razorpayOrder = await razorpay.orders.create(orderOptions);

        // Record in Database
        const { data, error } = await supabase
            .from('donations')
            .insert([{
                donation_reference_id: donationRef,
                user_id: userId,
                type: 'one_time',
                amount,
                donor_name: isAnonymous ? DONATION.ANONYMOUS_DONOR : donorName,
                donor_email: isAnonymous ? null : donorEmail, // privacy
                donor_phone: isAnonymous ? null : donorPhone,
                is_anonymous: isAnonymous || false,
                payment_status: 'pending',
                razorpay_order_id: razorpayOrder.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            donation_ref: donationRef,
            donor_name: isAnonymous ? DONATION.ANONYMOUS_DONOR : donorName,
            donor_email: donorEmail,
            donor_contact: donorPhone
        };
    }

    /**
     * Create Monthly Subscription - TRANSACTIONAL VERSION
     * Both DB records are created atomically
     */
    static async createSubscription(userId, { amount, donorName, donorEmail, donorPhone, isAnonymous }) {
        if (!userId) {
            throw this.createHttpError('errors.auth.loginRequired', 401);
        }

        if (!amount || amount <= 0) {
            throw new Error(DONATION.INVALID_AMOUNT);
        }

        const existingSubscription = await this.findReusableSubscription({ userId, amount });
        if (existingSubscription) {
            logger.info({
                userId,
                subscriptionId: existingSubscription.razorpay_subscription_id,
                donationRef: existingSubscription.donation_reference_id
            }, 'Reusing existing monthly donation subscription');

            return {
                subscription_id: existingSubscription.razorpay_subscription_id,
                key_id: process.env.RAZORPAY_KEY_ID,
                donation_ref: existingSubscription.donation_reference_id,
                donor_name: existingSubscription.donor_name || (isAnonymous ? DONATION.ANONYMOUS_DONOR : donorName),
                donor_email: donorEmail,
                donor_contact: donorPhone,
                reused: true
            };
        }

        const donationRef = generateDonationRef();

        // 1. Create or Get Plan on Razorpay
        let planId = null;

        try {
            const existingPlans = await razorpay.plans.all({ count: 100 });
            const amountInPaise = Math.round(amount * 100);

            const matchedPlan = existingPlans.items.find(p => {
                return p.item.amount === amountInPaise &&
                    p.item.currency === 'INR' &&
                    p.period === 'monthly' &&
                    Number(p.interval) === 1;
            });

            if (matchedPlan) {
                planId = matchedPlan.id;
            }
        } catch (fetchError) {
            logger.error({ err: fetchError }, LOGS.DONATION_PLAN_FETCH_ERROR);
        }

        if (!planId) {
            const planOptions = {
                period: 'monthly',
                interval: 1,
                item: {
                    name: `${DONATION.DEFAULT_PLAN_NAME} - ₹${amount}`,
                    amount: Math.round(amount * 100),
                    currency: 'INR',
                    description: DONATION.DEFAULT_PLAN_DESCRIPTION
                },
                notes: { type: 'donation_plan' }
            };
            const plan = await razorpay.plans.create(planOptions);
            planId = plan.id;
        }

        // 2. Create Subscription on Razorpay
        const subscriptionOptions = {
            plan_id: planId,
            total_count: 120, // 10 years
            quantity: 1,
            customer_notify: 1,
            notes: {
                payment_purpose: 'DONATION',
                donation_type: 'MONTHLY',
                donation_reference_id: donationRef,
                anonymous: isAnonymous ? 'true' : 'false',
                donor_email: isAnonymous ? 'hidden' : donorEmail,
                initial_amount: amount
            }
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);

        // 3. ATOMIC TRANSACTION: Create both subscription lifecycle and donation intent
        // Uses PostgreSQL function to ensure both inserts succeed or both fail
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('create_subscription_transactional', {
                p_user_id: userId,
                p_donation_ref: donationRef,
                p_razorpay_subscription_id: subscription.id,
                p_razorpay_plan_id: planId,
                p_amount: amount,
                p_donor_name: isAnonymous ? DONATION.ANONYMOUS_DONOR : donorName,
                p_donor_email: isAnonymous ? null : donorEmail,
                p_donor_phone: isAnonymous ? null : donorPhone,
                p_is_anonymous: isAnonymous || false
            });

        if (rpcError) {
            logger.error({ err: rpcError }, LOGS.DONATION_SUB_TRANS_FAILED);

            // Attempt to cancel the Razorpay subscription since DB failed
            try {
                await razorpay.subscriptions.cancel(subscription.id);
                logger.info({ subscriptionId: subscription.id }, LOGS.DONATION_SUB_CANCEL_RAZORPAY);
            } catch (cancelError) {
                logger.error({ err: cancelError, subscriptionId: subscription.id },
                    LOGS.DONATION_SUB_CANCEL_FAILED);
            }

            // User-friendly error message (hide technical details)
            throw new Error(DONATION.SETUP_FAILED);
        }

        logger.info({
            donationRef,
            subscriptionId: subscription.id
        }, LOGS.DONATION_SUB_CREATED);

        // Send subscription confirmation email (async, don't block response)
        if (donorEmail && !isAnonymous) {
            emailService.sendSubscriptionConfirmationEmail(
                donorEmail,
                {
                    subscription: {
                        amount: amount,
                        donationRef: donationRef
                    },
                    donorName: donorName,
                    isAnonymous: isAnonymous
                },
                userId
            ).catch(err => logger.error({ err }, LOGS.DONATION_SUB_EMAIL_FAILED));
        }

        return {
            subscription_id: subscription.id,
            key_id: process.env.RAZORPAY_KEY_ID,
            donation_ref: donationRef,
            donor_name: isAnonymous ? DONATION.ANONYMOUS_DONOR : donorName,
            donor_email: donorEmail,
            donor_contact: donorPhone
        };
    }

    /**
     * Verify Payment - DELAYED CAPTURE PATTERN
     */
    static async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new Error(DONATION.MISSING_DETAILS);
        }

        const { data: donation, error: fetchError } = await supabase
            .from('donations')
            .select('*')
            .eq('razorpay_order_id', razorpay_order_id)
            .single();

        if (fetchError || !donation) {
            throw new Error(DONATION.NOT_FOUND);
        }

        if (
            donation.razorpay_payment_id === razorpay_payment_id &&
            ['success', 'authorized'].includes(donation.payment_status)
        ) {
            logger.info({
                donationId: donation.id,
                razorpay_order_id,
                razorpay_payment_id
            }, 'Donation verification replay detected; returning existing donation');
            return donation;
        }

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            await supabase
                .from('donations')
                .update({ payment_status: 'failed' })
                .eq('razorpay_order_id', razorpay_order_id);
            throw new Error(DONATION.INVALID_SIGNATURE);
        }

        logger.info({
            razorpay_payment_id,
            razorpay_order_id,
            amount: donation.amount
        }, LOGS.DONATION_PAYMENT_AUTHORIZED);

        await supabase
            .from('donations')
            .update({ payment_status: 'authorized' })
            .eq('razorpay_order_id', razorpay_order_id);

        try {
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('verify_donation_transactional', {
                    p_razorpay_order_id: razorpay_order_id,
                    p_razorpay_payment_id: razorpay_payment_id,
                    p_payment_status: 'success'
                });

            if (rpcError) {
                logger.error({ err: rpcError }, LOGS.DONATION_TRANS_VERIFY_FAILED);
                throw new Error(DONATION.UPDATE_FAILED);
            }

            try {
                logger.info({
                    razorpay_payment_id,
                    amount: donation.amount
                }, LOGS.DONATION_DB_TRANS_SUCCESS);

                await capturePayment(razorpay_payment_id, donation.amount);

                logger.info({
                    donationId: rpcResult.donation.id,
                    donationRef: rpcResult.donation.donation_reference_id
                }, LOGS.DONATION_PAYMENT_CAPTURED);

                const donationData = rpcResult.donation;
                if (donationData.donor_email) {
                    emailService.sendDonationReceiptEmail(
                        donationData.donor_email,
                        {
                            donation: {
                                id: donationData.donation_reference_id,
                                amount: donationData.amount,
                                createdAt: donationData.created_at
                            },
                            donorName: donationData.donor_name,
                            isAnonymous: donationData.is_anonymous
                        },
                        donationData.user_id
                    ).catch(err => logger.error({ err }, LOGS.DONATION_RECEIPT_EMAIL_FAILED));
                }

            } catch (captureError) {
                logger.error({
                    err: captureError,
                    razorpay_payment_id,
                    donationId: rpcResult.donation.id
                }, LOGS.DONATION_CAPTURE_CRITICAL_ERROR);
            }

            return rpcResult.donation;

        } catch (systemError) {
            logger.error({
                err: systemError,
                razorpay_payment_id,
                razorpay_order_id
            }, LOGS.DONATION_VOID_PAYMENT);

            try {
                await voidAuthorization(razorpay_payment_id, DONATION.UPDATE_FAILED);

                await supabase
                    .from('donations')
                    .update({
                        payment_status: 'voided',
                        updated_at: new Date().toISOString()
                    })
                    .eq('razorpay_order_id', razorpay_order_id);

                logger.info({
                    razorpay_payment_id,
                    razorpay_order_id
                }, LOGS.DONATION_VOID_SUCCESS);

                throw new Error(DONATION.PROCESSING_FAILED);

            } catch (voidError) {
                if (voidError.message?.includes('processed')) {
                    throw voidError;
                }

                logger.error({
                    err: voidError,
                    razorpay_payment_id,
                    razorpay_order_id
                }, LOGS.DONATION_VOID_FAILED);

                throw new Error(DONATION.PROCESSING_FAILED_WITH_RELEASE);
            }
        }
    }

    /**
     * Process Webhook
     */
    static async processWebhook(signature, body) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            throw new Error(DONATION.WEBHOOK_SECRET_MISSING || DONATION.INVALID_SIGNATURE);
        }

        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(JSON.stringify(body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            throw new Error(DONATION.INVALID_SIGNATURE);
        }

        const event = body.event;
        const payload = body.payload;

        if (event === 'payment.captured') {
            const payment = payload.payment.entity;
            const notes = payment.notes;

            if (notes.payment_purpose === 'DONATION') {
                const status = payment.status === 'captured' ? 'success' : payment.status;

                if (notes.donation_type === 'ONE_TIME' && payment.order_id) {
                    await supabase
                        .from('donations')
                        .update({
                            payment_status: status,
                            razorpay_payment_id: payment.id,
                            updated_at: new Date().toISOString()
                        })
                        .eq('razorpay_order_id', payment.order_id);
                }
            }
        }
        else if (event === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.payment.entity;
            const donationRef = generateDonationRef();
            const amount = payment.amount / 100;

            const { data: existingDonation, error: existingDonationError } = await supabase
                .from('donations')
                .select('id, donation_reference_id, payment_status')
                .eq('razorpay_payment_id', payment.id)
                .maybeSingle();

            if (existingDonationError) {
                logger.error({ err: existingDonationError, razorpayPaymentId: payment.id }, LOGS.DONATION_RECURRING_LOG_FAILED);
                throw existingDonationError;
            }

            if (existingDonation) {
                logger.info({
                    donationId: existingDonation.id,
                    donationRef: existingDonation.donation_reference_id,
                    razorpayPaymentId: payment.id,
                    subscriptionId: subscription.id
                }, LOGS.DONATION_RECURRING_PROCESSED);
                return;
            }

            const { data: newDonation, error: insertError } = await supabase
                .from('donations')
                .insert([{
                    donation_reference_id: donationRef,
                    type: 'monthly',
                    amount: amount,
                    razorpay_payment_id: payment.id,
                    razorpay_subscription_id: subscription.id,
                    payment_status: 'success',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                logger.error({ err: insertError }, LOGS.DONATION_RECURRING_LOG_FAILED);
                return;
            }

            const { data: subscriptionRecord } = await supabase
                .from('donation_subscriptions')
                .select('donor_email, donor_name, is_anonymous, user_id, status')
                .eq('razorpay_subscription_id', subscription.id)
                .single();

            if (subscriptionRecord && subscriptionRecord.status === 'created') {
                const nextBillingAt = subscription.charge_at
                    ? new Date(subscription.charge_at * 1000).toISOString()
                    : null;

                await supabase
                    .from('donation_subscriptions')
                    .update({
                        status: 'active',
                        next_billing_at: nextBillingAt,
                        updated_at: new Date().toISOString()
                    })
                    .eq('razorpay_subscription_id', subscription.id);

                logger.info({ subscriptionId: subscription.id, nextBillingAt }, LOGS.DONATION_SUB_ACTIVATED);
            } else if (subscriptionRecord) {
                const nextBillingAt = subscription.charge_at
                    ? new Date(subscription.charge_at * 1000).toISOString()
                    : null;

                if (nextBillingAt) {
                    await supabase
                        .from('donation_subscriptions')
                        .update({
                            next_billing_at: nextBillingAt,
                            updated_at: new Date().toISOString()
                        })
                        .eq('razorpay_subscription_id', subscription.id);
                }
            }

            if (subscriptionRecord && subscriptionRecord.donor_email && !subscriptionRecord.is_anonymous) {
                emailService.sendDonationReceiptEmail(
                    subscriptionRecord.donor_email,
                    {
                        donation: {
                            id: donationRef,
                            amount: amount,
                            createdAt: new Date().toISOString()
                        },
                        donorName: subscriptionRecord.donor_name,
                        isAnonymous: subscriptionRecord.is_anonymous
                    },
                    subscriptionRecord.user_id
                ).catch(err => logger.error({ err }, LOGS.DONATION_RECURRING_RECEIPT_FAILED));
            }

            logger.info({
                donationRef: newDonation?.donation_reference_id || donationRef,
                subscriptionId: subscription.id,
                razorpayPaymentId: payment.id,
                amount
            }, LOGS.DONATION_RECURRING_PROCESSED);
        }
    }

    /**
     * Create QR Code
     */
    static async createQRCode() {
        const qrCode = await razorpay.qrCode.create({
            type: 'upi_qr',
            name: DONATION.QR_CODE_NAME,
            usage: 'multiple_use',
            fixed_amount: false,
            description: DONATION.QR_CODE_DESCRIPTION,
            notes: { payment_purpose: 'ANONYMOUS_DONATION' }
        });

        return {
            qr_code_url: qrCode.image_url,
            id: qrCode.id
        };
    }

    /**
     * Get User Subscriptions
     */
    static async getUserSubscriptions(userId) {
        const { data, error } = await supabase
            .from('donation_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Get User Donation History
     */
    static async getUserDonations(userId) {
        const { data, error } = await supabase
            .from('donations')
            .select('id, donation_reference_id, type, amount, currency, payment_status, created_at, razorpay_payment_id, razorpay_subscription_id')
            .eq('user_id', userId)
            .in('payment_status', ['success', 'authorized'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Cancel Subscription - TRANSACTIONAL VERSION
     */
    static async cancelSubscription(userId, subscriptionId) {
        try {
            await razorpay.subscriptions.cancel(subscriptionId);
        } catch (razorpayError) {
            if (!razorpayError.message?.includes('already cancelled')) {
                throw razorpayError;
            }
        }

        const { data: subscription, error: rpcError } = await supabase
            .rpc('update_subscription_status_transactional', {
                p_user_id: userId,
                p_razorpay_subscription_id: subscriptionId,
                p_new_status: 'cancelled',
                p_action: 'cancel'
            });

        if (rpcError) {
            logger.error({
                err: rpcError,
                subscriptionId
            }, LOGS.DONATION_SUB_CANCEL_DB_FAILED);
            throw new Error(DONATION.STATUS_UPDATE_FAILED);
        }

        if (subscription && subscription.donor_email) {
            emailService.sendSubscriptionCancellationEmail(
                subscription.donor_email,
                {
                    subscription: {
                        amount: subscription.amount,
                        donationRef: subscription.donation_reference_id
                    },
                    donorName: subscription.donor_name
                },
                userId
            ).catch(err => logger.error({ err }, LOGS.DONATION_SUB_CANCEL_EMAIL_FAILED));
        }

        logger.info({ subscriptionId }, LOGS.DONATION_SUB_CANCELLED);
        return true;
    }

    /**
     * Pause Subscription - TRANSACTIONAL VERSION
     */
    static async pauseSubscription(userId, subscriptionId) {
        await razorpay.subscriptions.pause(subscriptionId, { pause_at: 'now' });

        const { data: result, error: rpcError } = await supabase
            .rpc('update_subscription_status_transactional', {
                p_user_id: userId,
                p_razorpay_subscription_id: subscriptionId,
                p_new_status: 'paused',
                p_action: 'pause'
            });

        if (rpcError) {
            logger.error({
                err: rpcError,
                subscriptionId
            }, LOGS.DONATION_SUB_PAUSE_DB_FAILED);

            try {
                await razorpay.subscriptions.resume(subscriptionId, { resume_at: 'now' });
                logger.info({ subscriptionId }, LOGS.DONATION_SUB_PAUSE_ROLLBACK);
            } catch (rollbackError) {
                logger.error({ err: rollbackError, subscriptionId },
                    LOGS.DONATION_SUB_PAUSE_ROLLBACK_FAILED);
            }

            throw new Error(DONATION.STATUS_UPDATE_FAILED);
        }

        logger.info({ subscriptionId }, LOGS.DONATION_SUB_PAUSED);
        return true;
    }

    /**
     * Resume Subscription - TRANSACTIONAL VERSION
     */
    static async resumeSubscription(userId, subscriptionId) {
        await razorpay.subscriptions.resume(subscriptionId, { resume_at: 'now' });

        const { data: result, error: rpcError } = await supabase
            .rpc('update_subscription_status_transactional', {
                p_user_id: userId,
                p_razorpay_subscription_id: subscriptionId,
                p_new_status: 'active',
                p_action: 'resume'
            });

        if (rpcError) {
            logger.error({
                err: rpcError,
                subscriptionId
            }, LOGS.DONATION_SUB_RESUME_DB_FAILED);

            try {
                await razorpay.subscriptions.pause(subscriptionId, { pause_at: 'now' });
                logger.info({ subscriptionId }, LOGS.DONATION_SUB_RESUME_ROLLBACK);
            } catch (rollbackError) {
                logger.error({ err: rollbackError, subscriptionId },
                    LOGS.DONATION_SUB_RESUME_ROLLBACK_FAILED);
            }

            throw new Error(DONATION.STATUS_UPDATE_FAILED);
        }

        logger.info({ subscriptionId }, LOGS.DONATION_SUB_RESUMED);
        return true;
    }
}

module.exports = DonationService;
