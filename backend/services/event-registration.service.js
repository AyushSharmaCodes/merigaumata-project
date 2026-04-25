const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');
const emailService = require('./email');
const { createInvoice } = require('../services/razorpay-invoice.service');
const { capturePayment, voidAuthorization, refundPayment, fetchPayment } = require('../utils/razorpay-helper');
const EventPricingService = require('./event-pricing.service');
const EventRefundService = require('./event-refund.service');
const EventCancellationService = require('./event-cancellation.service');
const { getDefaultRegistrationDeadline } = require('./event.utils');
const EventMessages = require('../constants/messages/EventMessages');
const { LOGS, VALIDATION, AUTH, COMMON, SYSTEM } = require('../constants/messages');
const realtimeService = require('./realtime.service');
const { fetchInvoice } = require('../services/razorpay-invoice.service');
const { supabaseAdmin } = require('../config/supabase');

// Initialize Razorpay
const razorpay = wrapRazorpayWithTimeout(new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}));

/**
 * Event Registration Service
 * Handles event registration, payments, and cancellations.
 */
class EventRegistrationService {

    /**
     * Generate unique registration number
     * Format: EVT-YYYYMMDD-XXXX (e.g., EVT-20260106-0001)
     */
    static async generateRegistrationNumber() {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `EVT-${dateStr}-`;

        const { data: lastReg } = await supabase
            .from('event_registrations')
            .select('registration_number')
            .like('registration_number', `${prefix}%`)
            .order('registration_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextNumber = 1;
        if (lastReg?.registration_number) {
            const lastPart = lastReg.registration_number.slice(-4);
            const lastCounter = parseInt(lastPart, 10);
            if (!isNaN(lastCounter)) {
                nextNumber = lastCounter + 1;
            }
        }

        return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    }

    /**
     * Create Registration Order (Free or Paid)
     */
    static async createRegistrationOrder(userId, { eventId, fullName, email, phone }) {
        logger.debug({ userId, eventId, fullName, email, phone }, 'Creating registration order with inputs');
        if (!eventId || !fullName || !email || !phone) {
            throw new Error(VALIDATION.INVALID_INPUT);
        }

        // Get event details
        // Check for duplicate registration (strictly by email id as requested)
        const { data: existingReg } = await supabase
            .from('event_registrations')
            .select('id, status')
            .eq('event_id', eventId)
            .eq('email', email)
            .not('status', 'in', '(cancelled,refunded,failed)')
            .maybeSingle();

        if (existingReg) {
            // If status is pending (payment failed or abandoned), cancel it and allow retry
            if (existingReg.status === 'pending') {
                logger.info({ userId, email, eventId, oldRegId: existingReg.id }, LOGS.EVENT_REG_AUTO_CANCEL);
                await supabase
                    .from('event_registrations')
                    .update({
                        status: 'cancelled',
                        cancellation_reason: SYSTEM.AUTO_RETRY_REASON,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingReg.id);
            } else {
                logger.info({ userId, email, eventId, status: existingReg.status }, LOGS.EVENT_REG_DUPLICATE);
                throw new Error(EventMessages.DUPLICATE_REGISTRATION);
            }
        }

        // Get event details
        logger.debug({ eventId }, LOGS.EVENT_REG_FETCH_INIT);

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, registration_amount, gst_rate, base_price, gst_amount, registration_deadline, start_date, start_time, end_date, end_time, location, description, event_code, status, cancellation_status, capacity, registrations, is_registration_enabled')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            throw new Error(EventMessages.NOT_FOUND);
        }

        // Check if event is cancelled
        if (event.status === 'cancelled' || event.cancellation_status === 'CANCELLED' || event.cancellation_status === 'CANCELLATION_PENDING') {
            throw new Error(EventMessages.EVENT_CANCELLED);
        }

        if (event.is_registration_enabled === false) {
            throw new Error(EventMessages.REGISTRATION_CLOSED);
        }

        const eventEndDateTime = event.end_date ? this._getEventEndDateTime(event) : null;
        if (event.status === 'completed' || (eventEndDateTime && Date.now() > eventEndDateTime.getTime())) {
            throw new Error(EventMessages.REGISTRATION_CLOSED);
        }

        // Check Capacity
        if (event.capacity && event.capacity > 0) {
            // Count active registrations (not cancelled/refunded/failed)
            const { count: activeCount, error: countError } = await supabase
                .from('event_registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .not('status', 'in', '(cancelled,refunded,failed)');

            if (countError) {
                logger.error({ err: countError, eventId }, 'Failed to count active registrations');
            }

            const currentCount = activeCount || event.registrations || 0;
            if (currentCount >= event.capacity) {
                logger.warn({ eventId, capacity: event.capacity, currentCount }, 'Event capacity full');
                throw new Error(EventMessages.CAPACITY_FULL);
            }
        }

        // Check Registration Deadline
        // If admin/manager did not set a deadline explicitly, default to 24 hours before event start.
        let effectiveDeadline;

        if (event.registration_deadline) {
            effectiveDeadline = new Date(event.registration_deadline);
        } else if (typeof event.start_date === 'string' && event.start_date.includes('T')) {
            const autoDeadline = getDefaultRegistrationDeadline({
                startDate: event.start_date,
                startTime: event.start_time
            });
            effectiveDeadline = autoDeadline ? new Date(autoDeadline) : undefined;
        }

        if (effectiveDeadline && Date.now() >= effectiveDeadline.getTime()) {
            logger.warn({ eventId, deadline: effectiveDeadline.toISOString(), isAutoComputed: !event.registration_deadline }, LOGS.EVENT_REG_DEADLINE_STRICT);
            throw new Error(EventMessages.REGISTRATION_CLOSED);
        }

        // Generate Registration Number
        const prefix = `EVT-${event.title.substring(0, 3).toUpperCase()}-`;
        const registrationNumber = await this.generateRegistrationNumber(prefix);

        // Check if free event
        const isFree = !event.registration_amount || event.registration_amount === 0;

        // Calculate Payment Breakdown (if missing in event)
        let basePrice = event.base_price;
        let gstAmount = event.gst_amount;
        let gstRate = event.gst_rate;

        if (!isFree && (!basePrice || !gstAmount)) {
            // Calculate on the fly
            const breakdown = EventPricingService.calculateBreakdown(event.registration_amount, event.gst_rate);
            basePrice = breakdown.basePrice;
            gstAmount = breakdown.gstAmount;
            gstRate = breakdown.gstRate;

            logger.info({
                registrationAmount: event.registration_amount,
                calculatedBase: basePrice,
                calculatedGst: gstAmount
            }, LOGS.EVENT_REG_TAX_CALC);
        }

        // Create initial registration record
        const { data: registration, error: regError } = await supabase
            .from('event_registrations')
            .insert([{
                registration_number: registrationNumber,
                event_id: eventId,
                user_id: userId,
                full_name: fullName,
                email,
                phone,
                amount: isFree ? 0 : event.registration_amount,
                gst_rate: isFree ? 0 : gstRate,
                base_price: isFree ? 0 : basePrice,
                gst_amount: isFree ? 0 : gstAmount,
                payment_status: isFree ? 'free' : 'pending',
                status: isFree ? 'confirmed' : 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (regError) {
            logger.error(LOGS.EVENT_REG_CREATE_FAILED, {
                module: 'EventRegistration',
                operation: 'CREATE_ORDER',
                err: regError,
                userId,
                eventId
            });
            throw new Error(EventMessages.REGISTRATION_FAILED_CONTACT_SUPPORT);
        }

        // --- FREE EVENT FLOW ---
        if (isFree) {
            // Increment registrations count
            const { error: orderRpcError } = await supabase.rpc('increment_event_registrations', { p_event_id: eventId });
            if (orderRpcError) {
                // Fallback: direct update if RPC doesn't exist
                logger.warn({ err: orderRpcError?.message }, 'RPC increment failed, using direct update');
                await supabase
                    .from('events')
                    .update({ registrations: (event.registrations || 0) + 1 })
                    .eq('id', eventId);
            }

            // Send confirmation email
            emailService.sendEventRegistrationEmail(
                email,
                {
                    event: {
                        id: eventId,
                        title: event.title,
                        startDate: event.start_date,
                        location: event.location,
                        description: event.description,
                        eventCode: event.event_code
                    },
                    registration: {
                        id: registration.id,
                        registrationNumber: registration.registration_number
                    },
                    attendeeName: fullName,
                    isPaid: false
                },
                userId
            ).catch(err => logger.error({ err: err.message }, LOGS.EVENT_REG_FREE_EMAIL_FAILED));

            realtimeService.publish({
                topic: 'dashboard',
                type: 'event_registration.created',
                audience: 'staff',
                payload: {
                    registrationId: registration.id,
                    eventId,
                    status: registration.status
                }
            });

            return {
                success: true,
                isFree: true,
                registration: {
                    id: registration.id,
                    registrationNumber: registration.registration_number
                }
            };
        }

        // --- PAID EVENT FLOW ---
        // Create Razorpay INVOICE (replaces simple Order)
        // This generates a detailed PDF Invoice + Receipt linked to the payment
        const invoiceResult = await createInvoice({
            paymentId: null, // No payment ID yet
            amount: event.registration_amount,
            customerName: fullName,
            customerEmail: email,
            customerPhone: phone,
            receiptNumber: registration.registration_number,
            description: `Registration: ${event.title}`
        });

        if (!invoiceResult.success) {
            logger.error({ err: invoiceResult.error, registrationId: registration.id }, LOGS.EVENT_REG_INVOICE_FAILED);
            // We continue but the user won't have a nice invoice link yet. 
            // However, we NEED the order_id for the checkout to work.
            // If invoice creation fails, we might need to fallback or fail the registration.
            // For now, let's fail to ensure consistency.
            throw new Error(COMMON.PAYMENT_GATEWAY_ERROR);
        }

        logger.info({ invoiceResult }, LOGS.EVENT_REG_INVOICE_SUCCESS);

        // Update registration with invoice details immediately
        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({
                invoice_id: invoiceResult.invoiceId,
                invoice_url: invoiceResult.invoiceUrl,
                razorpay_order_id: invoiceResult.orderId // Store Order ID for verification
            })
            .eq('id', registration.id);

        if (updateError) {
            logger.error({ err: updateError, registrationId: registration.id }, LOGS.EVENT_REG_INVOICE_DB_FAILED);
            // Validate if column exists error
            if (updateError.code === '42703') { // Undefined column
                logger.warn(LOGS.EVENT_REG_INVOICE_DB_WARN);
            }
        }

        return {
            success: true,
            isFree: false,
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: Math.round(event.registration_amount * 100),
            currency: 'INR',
            order_id: invoiceResult.orderId, // CRITICAL: Frontend expects Order ID linked to Invoice
            invoice_id: invoiceResult.invoiceId, // Pass Invoice ID so frontend can return it for verification
            registration_id: registration.id,
            registration: {
                registrationNumber: registration.registration_number
            }
        };
    }

    /**
     * Verify Payment and Confirm Registration - AUTO CAPTURE PATTERN
     * 
     * 1. Verify signature
     * 2. Payment is ALREADY CAPTURED
     * 3. Run DB transaction (update registration status)
     * 4. If DB succeeds → All good
     * 5. If DB fails → REFUND payment
     */
    static async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, registration_id, razorpay_invoice_id }) {
        logger.info({
            razorpay_payment_id,
            razorpay_order_id,
            registration_id,
            has_signature: !!razorpay_signature,
            has_invoice_id: !!razorpay_invoice_id
        }, LOGS.EVENT_REG_VERIFY_INIT);

        // Relaxed check: We NEED payment_id and registration_id. The rest can be fetched via S2S if missing.
        if (!razorpay_payment_id || !registration_id) {
            logger.error({ razorpay_payment_id, registration_id }, LOGS.EVENT_REG_MISSING_PARAMS);
            throw new Error(VALIDATION.INVALID_INPUT);
        }

        // Fetch registration for amount - GET FULL EVENT DETAILS
        const { data: regData, error: fetchError } = await supabase
            .from('event_registrations')
            .select('*, events!inner(*)') // Fetch ALL event fields
            .eq('id', registration_id)
            .single();

        if (fetchError || !regData) {
            logger.error({ err: fetchError, registration_id }, LOGS.EVENT_REG_NOT_FOUND_VERIFY);
            throw new Error(EventMessages.REGISTRATION_NOT_FOUND);
        }

        if (
            regData.status === 'confirmed' &&
            regData.payment_status === 'paid' &&
            regData.razorpay_payment_id === razorpay_payment_id
        ) {
            logger.info({
                registrationId: regData.id,
                razorpay_payment_id
            }, 'Event registration verification replay detected; returning existing registration');

            return {
                success: true,
                registration: {
                    id: regData.id,
                    registrationNumber: regData.registration_number,
                    eventTitle: regData.events?.title,
                    status: regData.status,
                    paymentStatus: regData.payment_status,
                    amount: regData.amount
                },
                duplicate: true
            };
        }

        // define registration alias for consistency with downstream code
        const registration = regData;

        // Initial amount (might be updated by RPC later)
        let amount = regData.amount || regData.events?.registration_amount || 0;
        let isSignatureVerified = false;

        // 1. Signature Verification (Preferred if all params present)
        if (razorpay_order_id && razorpay_signature) {
            try {
                const generated_signature = crypto
                    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                    .update(razorpay_order_id + '|' + razorpay_payment_id)
                    .digest('hex');

                if (generated_signature === razorpay_signature) {
                    isSignatureVerified = true;
                    logger.info({ razorpay_payment_id }, LOGS.EVENT_REG_SIG_SUCCESS);
                } else {
                    logger.warn({
                        razorpay_payment_id,
                        expected: generated_signature,
                        received: razorpay_signature
                    }, LOGS.EVENT_REG_SIG_MISMATCH);
                }
            } catch (sigErr) {
                logger.error({ err: sigErr }, LOGS.EVENT_REG_SIG_ERROR);
            }
        } else {
            logger.info(LOGS.EVENT_REG_SIG_MISSING_S2S);
        }

        // 2. S2S Verification (Fallback / Source of Truth)
        if (!isSignatureVerified) {
            try {
                logger.info({ razorpay_payment_id }, LOGS.EVENT_REG_S2S_INIT);
                const payment = await razorpay.payments.fetch(razorpay_payment_id);

                logger.info({
                    id: payment.id,
                    status: payment.status,
                    amount: payment.amount,
                    order_id: payment.order_id,
                    email: payment.email
                }, LOGS.EVENT_REG_S2S_DETAILS);

                // Check Status
                if (payment.status !== 'captured' && payment.status !== 'authorized') {
                    throw new Error(`Payment status is ${payment.status} (expected captured/authorized)`);
                }

                // Verify Amount (Prevent manipulation)
                const expectedAmount = Math.round(amount * 100);
                if (payment.amount !== expectedAmount) {
                    logger.error({
                        expected: expectedAmount,
                        received: payment.amount
                    }, LOGS.EVENT_REG_AMOUNT_MISMATCH);
                    throw new Error(EventMessages.PAYMENT_VERIFICATION_FAILED);
                }

                // If we have an order_id on record, it MUST match the payment's order_id if present
                if (razorpay_order_id && payment.order_id && payment.order_id !== razorpay_order_id) {
                    logger.error({
                        payment_order_id: payment.order_id,
                        input_order_id: razorpay_order_id
                    }, LOGS.EVENT_REG_ORDER_MISMATCH);
                    throw new Error(EventMessages.PAYMENT_VERIFICATION_FAILED);
                }

                // If the input didn't have an order_id (null case), we adopt the one from payment
                if (!razorpay_order_id && payment.order_id) {
                    razorpay_order_id = payment.order_id;
                    logger.info({ razorpay_order_id }, LOGS.EVENT_REG_ADOPT_ORDER);
                }

                isSignatureVerified = true; // S2S is authoritative
                logger.info(LOGS.EVENT_REG_S2S_PASSED);

            } catch (s2sError) {
                logger.error({ err: s2sError, razorpay_payment_id }, LOGS.EVENT_REG_S2S_FAILED);
                throw new Error(EventMessages.PAYMENT_VERIFICATION_FAILED);
            }
        }

        // --- PAYMENT VERIFIED (Either Signature or S2S) ---

        // Auto-Capture check (if somehow authorized but not captured)
        // Note: We used payment_capture=1 so it should be captured, but good to be safe.
        // We update status to 'captured' locally.

        await supabase
            .from('event_registrations')
            .update({
                payment_status: 'captured',
                updated_at: new Date().toISOString()
            })
            .eq('id', registration_id);

        let receiptUrl = null;

        // --- DB TRANSACTION PHASE ---
        try {
            // 3. Update Registration Status - TRANSACTIONAL VERSION
            // We pass null for invoice_url because we rely on the one generated during createRegistrationOrder
            // We pass our verified (or adopted) razorpay parameters
            const { data: rpcResult, error: verifyRpcError } = await supabase
                .rpc('verify_event_registration_transactional', {
                    p_registration_id: registration_id,
                    p_razorpay_payment_id: razorpay_payment_id,
                    p_razorpay_signature: razorpay_signature || 's2s_verified', // specific marker if sig missing
                    p_invoice_url: null
                });

            if (verifyRpcError) {
                logger.error({ err: verifyRpcError }, LOGS.EVENT_REG_TRANS_FAILED);
                throw new Error(EventMessages.REGISTRATION_FAILED_CONTACT_SUPPORT);
            }

            // Update local registration object with RPC result
            if (rpcResult && rpcResult.registration) {
                Object.assign(registration, rpcResult.registration);
            } else {
                // Fallback fetch
                const { data: refreshedReg } = await supabase
                    .from('event_registrations')
                    .select('*, events!inner(*)')
                    .eq('id', registration_id)
                    .single();
                if (refreshedReg) Object.assign(registration, refreshedReg);
            }

            // Consolidate Event Data
            const event = registration.events;
            const eventData = event;

            // Fallback Tax Calculation if missing
            let finalBasePrice = registration.base_price;
            let finalGstAmount = registration.gst_amount;

            if (finalBasePrice === undefined || finalBasePrice === null) {
                const breakdown = EventPricingService.calculateBreakdown(registration.amount, registration.gst_rate);
                finalBasePrice = breakdown.basePrice;
                finalGstAmount = breakdown.gstAmount;
            }

            // Get Invoice URL (should have been set during creation)
            let invoiceUrl = registration.invoice_url;

            // FALLBACK: Recover Invoice URL if missing
            // Priority: DB -> Frontend Argument -> DB Invoice ID -> Razorpay Payment Object
            if (!invoiceUrl) {
                try {
                    // 1. Try to get Invoice ID from anywhere
                    let targetInvoiceId = registration.invoice_id || razorpay_invoice_id;

                    // 2. If missing, and we have a payment ID, fetch the payment to find the linked invoice
                    if (!targetInvoiceId && razorpay_payment_id) {
                        logger.info(LOGS.EVENT_REG_RECOVER_INV_MISSING);
                        const payment = await razorpay.payments.fetch(razorpay_payment_id);
                        if (payment && payment.invoice_id) {
                            targetInvoiceId = payment.invoice_id;
                            logger.info({ targetInvoiceId }, LOGS.EVENT_REG_RECOVER_INV_FOUND);
                        }
                    }

                    if (targetInvoiceId) {
                        logger.info({ invoiceId: targetInvoiceId }, LOGS.EVENT_REG_RECOVER_INV_FETCH);
                        const invoiceResult = await fetchInvoice(targetInvoiceId);

                        if (invoiceResult.success && invoiceResult.invoiceUrl) {
                            invoiceUrl = invoiceResult.invoiceUrl;

                            // Opportunistically update the DB
                            // We also update invoice_id if we found it via payment but it wasn't in DB
                            const updates = { invoice_url: invoiceUrl };
                            if (!registration.invoice_id) updates.invoice_id = targetInvoiceId;

                            await supabase
                                .from('event_registrations')
                                .update(updates)
                                .eq('id', registration.id)
                                .then(({ error }) => {
                                    if (error) logger.warn({ err: error }, LOGS.EVENT_REG_RECOVER_INV_FAILED);
                                });
                        }
                    } else {
                        logger.warn(LOGS.EVENT_REG_RECOVER_INV_MISSING);
                    }
                } catch (fetchErr) {
                    logger.error({ err: fetchErr }, LOGS.EVENT_REG_RECOVER_INV_FAILED);
                }
            }

            // --- DB SUCCESS ---
            // Increment registrations count on event
            const eventId = registration.event_id;
            const { error: incrementError } = await supabase.rpc('increment_event_registrations', { p_event_id: eventId });
            if (incrementError) {
                logger.warn({ err: incrementError?.message }, 'RPC increment failed, using direct update');
                await supabase
                    .from('events')
                    .update({ registrations: (registration.events?.registrations || 0) + 1 })
                    .eq('id', eventId);
            }

            logger.info({
                registrationId: registration.id,
                registrationNumber: registration.registration_number,
                paymentId: razorpay_payment_id,
                hasInvoiceUrl: !!invoiceUrl
            }, LOGS.EVENT_REG_CONFIRMED_DB);

            // 4. Send Confirmation Email - NON-BLOCKING
            emailService.sendEventRegistrationEmail(
                registration.email,
                {
                    event: {
                        id: eventData.id,
                        title: eventData.title || EventMessages.DEFAULT_TITLE,
                        startDate: eventData.start_date,
                        endDate: eventData.end_date,
                        startTime: eventData.start_time,
                        endTime: eventData.end_time,
                        location: eventData.location,
                        description: eventData.description,
                        eventCode: eventData.event_code
                    },
                    registration: {
                        id: registration.id,
                        registrationNumber: registration.registration_number
                    },
                    attendeeName: registration.full_name,
                    isPaid: true,
                    paymentDetails: {
                        amount: registration.amount,
                        basePrice: finalBasePrice,
                        gstAmount: finalGstAmount,
                        gstRate: registration.gst_rate,
                        transactionId: razorpay_payment_id,
                        razorpayPaymentId: razorpay_payment_id,
                        paidAt: new Date().toISOString(),
                        invoiceUrl: invoiceUrl
                    }
                },
                registration.user_id
            ).catch(err => logger.error({ err: err.message }, LOGS.EVENT_REG_EMAIL_FAILED));

            return {
                success: true,
                registration: {
                    id: registration.id,
                    registrationNumber: registration.registration_number,
                    eventTitle: event.title,
                    status: 'confirmed',
                    paymentStatus: 'paid',
                    amount: registration.amount
                }
            };

        } catch (systemError) {
            // --- DB FAILURE: REFUND PAYMENT ---
            logger.error({
                err: systemError,
                stack: systemError.stack,
                razorpay_payment_id,
                registration_id
            }, LOGS.EVENT_REG_VERIFY_PROCESS_FAILED);

            const cancellationUpdate = {
                status: 'cancelled',
                updated_at: new Date().toISOString()
            };

            try {
                // Refund the full amount
                await refundPayment(razorpay_payment_id, null, {
                    reason: `${EventMessages.PAYMENT_VERIFICATION_FAILED}: ${systemError.message}`
                });

                // Refund Success: Mark as Refunded + Cancelled
                await supabase
                    .from('event_registrations')
                    .update({
                        ...cancellationUpdate,
                        payment_status: 'refunded'
                    })
                    .eq('id', registration_id);

                logger.info({
                    razorpay_payment_id,
                    registration_id
                }, LOGS.EVENT_REG_REFUND_SUCCESS);

                throw new Error(EventMessages.REGISTRATION_FAILED_REFUNDED);

            } catch (refundError) {
                // Check if this is the success error we just threw
                if (refundError.message.includes('Registration failed')) {
                    throw refundError;
                }

                logger.error({
                    err: refundError,
                    razorpay_payment_id,
                    registration_id
                }, LOGS.EVENT_REG_REFUND_FAIL_CRITICAL);

                await supabase
                    .from('event_registrations')
                    .update({
                        ...cancellationUpdate
                    })
                    .eq('id', registration_id);

                throw new Error(EventMessages.REGISTRATION_FAILED_CONTACT_SUPPORT);
            }
        }
    }

    /**
     * Cancel Registration
     */
    static async cancelRegistration(userId, registrationId, reason = 'User requested cancellation') {
        const correlationId = uuidv4();

        logger.info({
            module: 'EventRegistration',
            operation: 'USER_CANCEL_INIT',
            userId,
            registrationId,
            correlationId
        }, LOGS.EVENT_REG_CANCEL_INIT);

        // 1. Fetch Registration with Event Data
        const { data: registration, error: fetchError } = await supabase
            .from('event_registrations')
            .select('*, events(*)')
            .eq('id', registrationId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !registration) {
            logger.warn({ registrationId, userId, correlationId }, 'Registration not found for cancellation');
            throw new Error(EventMessages.REGISTRATION_NOT_FOUND);
        }

        if (registration.status === 'cancelled') {
            logger.info({ registrationId, correlationId }, LOGS.EVENT_REG_CANCEL_ALREADY);
            return { message: EventMessages.REGISTRATION_ALREADY_CANCELLED };
        }

        // 2. Deadline Check (24 hours before start)
        // Only apply deadline check for user-initiated cancellations, not admin
        const eventStartDateTime = this._getEventStartDateTime(registration.events);
        const eventStartMs = eventStartDateTime ? eventStartDateTime.getTime() : new Date(registration.events?.start_date).getTime();
        const now = Date.now();
        const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

        if (now > eventStartMs - twentyFourHoursInMs) {
            logger.warn({
                registrationId,
                eventId: registration.event_id,
                eventStartTime: registration.events?.start_date,
                correlationId
            }, LOGS.EVENT_REG_CANCEL_BLOCKED_DEADLINE);
            throw new Error(EventMessages.CANCELLATION_DEADLINE_EXCEEDED);
        }

        // 3. Delegate to Shared Processing Logic
        // This handles Refund, Status Update, and Email
        // We await it here so the user gets immediate feedback if it fails (e.g. DB error)
        // For email, the shared service catches errors so it won't fail the written response.

        await EventCancellationService.processSingleRegistration(
            registration,
            registration.events,
            correlationId,
            reason
        );



        // Fetch refund data for response
        let refundInfo = null;
        const { data: refundData } = await supabase
            .from('event_refunds')
            .select('id, status, amount, gateway_reference')
            .eq('registration_id', registrationId)
            .maybeSingle();

        if (refundData) {
            refundInfo = {
                refundId: refundData.gateway_reference || refundData.id,
                amount: refundData.amount,
                status: refundData.status
            };
        }

        logger.info({
            module: 'EventRegistration',
            operation: 'USER_CANCEL_COMPLETE',
            registrationId,
            correlationId,
            hasRefund: !!refundInfo
        }, LOGS.EVENT_REG_CANCEL_COMPLETE);

        return {
            message: EventMessages.REGISTRATION_CANCELLED,
            refund: refundInfo
        };
    }

    /**
     * Get User Registrations
     */
    static async getUserRegistrations(userId, { page = 1, limit = 5 } = {}) {
        logger.debug({ userId, page }, LOGS.EVENT_REG_FETCH_ALL);
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('event_registrations')
            .select(`*, events (id, title, start_date, end_date, start_time, location, image, capacity, registrations), event_refunds (id, status, amount, gateway_reference)`, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error({ userId, error }, LOGS.EVENT_REG_FETCH_ALL_ERROR);
            throw error;
        }
        logger.info({ userId, count: data?.length || 0 }, LOGS.EVENT_REG_FETCH_ALL_SUCCESS);

        return {
            registrations: data || [],
            total: count || 0
        };
    }

    /**
     * Get Registration by ID
     */
    static async getRegistrationById(id, userId = null, options = {}) {
        const client = options.useAdmin ? supabaseAdmin : supabase;

        const { data, error } = await client
            .from('event_registrations')
            .select(`*, events (id, title, start_date, end_date, location, image)`)
            .eq('id', id)
            .single();

        if (error || !data) {
            const err = new Error(EventMessages.REGISTRATION_NOT_FOUND);
            err.statusCode = 404;
            throw err;
        }

        // Access Control (Skip if using admin for public links)
        if (!options.useAdmin && userId && data.user_id && data.user_id !== userId) {
            const err = new Error(AUTH.UNAUTHORIZED);
            err.statusCode = 403;
            throw err;
        }

        return data;
    }
    /**
     * Helper: Combine event start_date + start_time into a single Date
     */
    static _getEventStartDateTime(event) {
        if (!event?.start_date) return null;
        const startDate = new Date(event.start_date);
        if (event.start_time) {
            const [hours, minutes] = event.start_time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                startDate.setHours(hours, minutes, 0, 0);
            }
        }
        return startDate;
    }

    static _getEventEndDateTime(event) {
        if (!event?.end_date && !event?.start_date) return null;
        const endDate = new Date(event.end_date || event.start_date);
        if (event.end_time) {
            const [hours, minutes] = event.end_time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                endDate.setHours(hours, minutes, 0, 0);
            }
        } else if (!event.end_date && event.start_time) {
            const [hours, minutes] = event.start_time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                endDate.setHours(hours, minutes, 0, 0);
            }
        }
        return endDate;
    }
}

module.exports = EventRegistrationService;
