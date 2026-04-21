const Razorpay = require('razorpay');
const { supabaseAdmin: supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const appEmitter = require('../utils/events');
const { logStatusHistory } = require('./history.service');
const { ORDER } = require('../constants/messages');
const { QC_STATUS, QC_TERMINAL } = require('../domain/qcStatus');
const { REFUND_STATUS, REFUND_TERMINAL } = require('../domain/refundStatus');
const TransitionGuards = require('../domain/transitionGuards');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');

const razorpay = wrapRazorpayWithTimeout(new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}));

const REFUND_TYPES = {
    BUSINESS_REFUND: 'BUSINESS_REFUND',
    TECHNICAL_REFUND: 'TECHNICAL_REFUND'
};

const SUCCESSFUL_REFUND_STATUSES = new Set(['PROCESSED', 'COMPLETED']);
const RETRYABLE_REFUND_STATUSES = new Set(['FAILED', 'PENDING']);

/**
 * Refund Service - Hardened
 */
class RefundService {
    static buildRefundIdempotencyKey({ orderId = null, paymentId = null, refundType }) {
        if (paymentId && (!orderId || refundType === REFUND_TYPES.TECHNICAL_REFUND)) {
            return `refund_payment_${paymentId}_${String(refundType || 'UNKNOWN').toLowerCase()}`;
        }

        if (orderId) {
            return `refund_order_${orderId}_${String(refundType || 'UNKNOWN').toLowerCase()}`;
        }

        throw new Error('REFUND_REFERENCE_REQUIRED');
    }

    static normalizeRefundStatus(status) {
        if (!status) return '';

        const normalized = String(status).trim().toUpperCase();
        const aliases = {
            CREATED: 'PENDING',
            INITIATED: 'PENDING',
            REFUND_INITIATED: 'PENDING',
            PROCESSING: 'PROCESSING',
            RAZORPAY_PROCESSING: 'PROCESSING',
            PROCESSED: 'PROCESSED',
            COMPLETED: 'COMPLETED',
            REFUNDED: 'PROCESSED',
            FAILED: 'FAILED'
        };

        return aliases[normalized] || normalized;
    }

    static isRetryableStatus(status) {
        return RETRYABLE_REFUND_STATUSES.has(this.normalizeRefundStatus(status));
    }

    static isTerminalStatus(status) {
        const normalized = this.normalizeRefundStatus(status);
        return SUCCESSFUL_REFUND_STATUSES.has(normalized) || normalized === 'FAILED';
    }

    /**
     * Initialize Event Listeners
     */
    static init() {
        appEmitter.on('QC_COMPLETED', async ({ return_id, order_id }) => {
            logger.info(`[RefundService] Received QC_COMPLETED for return ${return_id}. Triggering financial reconciliation...`);
            await this.reconcileReturnRefund(return_id);
        });
    }

    /**
     * Atomic Exactly-Once Refund Trigger
     */
    static async triggerRefundTransition(returnId) {
        const { data, error } = await supabase
            .from('returns')
            .update({ 
                refund_status: REFUND_STATUS.REFUND_INITIATED,
                updated_at: new Date()
            })
            .eq('id', returnId)
            .eq('refund_status', REFUND_STATUS.NOT_STARTED)
            .select('id')
            .single();

        if (error || !data) {
            return false; // Already initiated or not found
        }
        return true;
    }

    /**
     * Financial Reconciliation Logic (The "Reconciler")
     */
    static async reconcileReturnRefund(returnId) {
        try {
            // 1. Fetch Return with Items and Order
            const { data: returnObj, error: rError } = await supabase
                .from('returns')
                .select(`
                    *, 
                    orders(*, order_items(*)),
                    qc_audits(*)
                `)
                .eq('id', returnId)
                .single();

            if (rError || !returnObj) throw new Error('RETURN_NOT_FOUND');

            // Manual per-item QC outcomes already create refund rows directly.
            // If they exist, do not run the older whole-return reconciler again.
            const { data: existingRefunds, error: refundLookupError } = await supabase
                .from('refunds')
                .select('id, status')
                .eq('return_id', returnId);

            if (refundLookupError) throw refundLookupError;

            const successfulExistingRefund = (existingRefunds || []).some((refund) => SUCCESSFUL_REFUND_STATUSES.has(this.normalizeRefundStatus(refund.status)));
            const pendingExistingRefund = (existingRefunds || []).some((refund) => this.normalizeRefundStatus(refund.status) === 'PENDING');

            if (successfulExistingRefund || pendingExistingRefund) {
                await supabase.from('returns').update({
                    refund_status: successfulExistingRefund ? REFUND_STATUS.REFUNDED : REFUND_STATUS.REFUND_INITIATED,
                    updated_at: new Date().toISOString()
                }).eq('id', returnId);

                logger.info(`[RefundService] Skipping automated reconciliation for return ${returnId} because item-level refunds already exist.`);
                return;
            }

            // 2. DOMAIN GUARD: Ensure items are ready and status is eligible
            const order = returnObj.orders;
            if (!TransitionGuards.canProcessRefund(order, returnObj)) {
                logger.info(`[RefundService] Return ${returnId} is not yet eligible for refund. Skipping.`);
                return;
            }

            // 3. ITEM INTEGRITY: Ensure ALL items in the return are audited
            const { data: returnItems } = await supabase.from('return_items').select('id').eq('return_id', returnId);
            const auditedItemIds = new Set(returnObj.qc_audits?.map(a => a.return_item_id) || []);
            
            if (auditedItemIds.size < (returnItems?.length || 0)) {
                logger.warn(`[RefundService] Partial audit detected for return ${returnId}. Waiting for all items.`);
                return;
            }

            // 4. ATOMIC TRIGGER: Lock the status to 'REFUND_INITIATED'
            const canProceed = await this.triggerRefundTransition(returnId);
            if (!canProceed) {
                logger.info(`[RefundService] Refund already initiated for return ${returnId}. Skipping duplicate trigger.`);
                return;
            }

            // 5. CALCULATION: Aggregate deductions
            const totalDeductions = returnObj.qc_audits.reduce((sum, a) => sum + Number(a.deduction_amount || 0), 0);
            const totalLogistics = returnObj.qc_audits.reduce((sum, a) => sum + Number(a.reverse_logistics_cost || 0), 0);
            
            // Standard policy calculation
            const baseCalculation = this.calculateRefundAmount(order, REFUND_TYPES.BUSINESS_REFUND, order.order_items);
            const finalRefundAmount = Math.max(0, baseCalculation.amount - totalDeductions - totalLogistics);

            if (finalRefundAmount <= 0) {
                logger.info(`[RefundService] Final refund amount is 0 for return ${returnId}. Setting ZERO_REFUND outcome.`);
                await supabase.from('returns').update({ 
                    refund_status: REFUND_STATUS.REFUNDED,
                    return_outcome: 'ZERO_REFUND' 
                }).eq('id', returnId);
                return;
            }

            // 6. EXECUTION: Razorpay with Idempotency
            await this.asyncProcessRefund(order.id, REFUND_TYPES.BUSINESS_REFUND, 'SYSTEM', 'Automated Return Refund', false, finalRefundAmount);

        } catch (error) {
            logger.error(`[RefundService] Reconciliation failed for return ${returnId}: ${error.message}`);
        }
    }

    /**
     * Calculate Refund Amount based on policy
     */
    static calculateRefundAmount(order, refundType, items = []) {
        const totalAmount = Number(order.total_amount || 0);

        if (refundType === REFUND_TYPES.TECHNICAL_REFUND) {
            return {
                amount: totalAmount,
                excludedCharge: 0,
                excludedGst: 0,
                isFullRefund: true
            };
        }

        let refundableCharge = 0;
        let refundableGst = 0;

        items.forEach(item => {
            const snapshot = item.delivery_calculation_snapshot || {};
            const deliveryCharge = Number(item.delivery_charge || 0);
            const deliveryGst = Number(item.delivery_gst || 0);

            if (snapshot.delivery_refund_policy === 'REFUNDABLE') {
                refundableCharge += deliveryCharge;
                refundableGst += deliveryGst;
                return;
            }

            if (snapshot.delivery_refund_policy === 'PARTIAL') {
                refundableCharge += Math.max(0, deliveryCharge - Number(snapshot.non_refundable_delivery_charge || 0));
                refundableGst += Math.max(0, deliveryGst - Number(snapshot.non_refundable_delivery_gst || 0));
            }
        });

        const excludedCharge = Math.max(0, Number(order.delivery_charge || 0) - refundableCharge);
        const excludedGst = Math.max(0, Number(order.delivery_gst || 0) - refundableGst);
        const refundAmount = totalAmount - excludedCharge - excludedGst;
        return {
            amount: Math.max(0, Math.round(refundAmount * 100) / 100),
            excludedCharge: Math.round(excludedCharge * 100) / 100,
            excludedGst: Math.round(excludedGst * 100) / 100,
            isFullRefund: (excludedCharge + excludedGst) === 0
        };
    }

    /**
     * Orchestrate Razorpay Refund with Idempotency
     */
    static async asyncProcessRefund(orderId, refundType, initiatedBy = 'SYSTEM', reason = '', isInternalPaymentId = false, overrideAmount = null) {
        try {
            let order = null;
            let payment = null;
            let paymentId = null;
            let resolvedOrderId = orderId;

            if (isInternalPaymentId) {
                paymentId = orderId;

                const { data: paymentRecord, error: paymentError } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('id', paymentId)
                    .single();

                if (paymentError || !paymentRecord) {
                    throw new Error(ORDER.RAZORPAY_ID_MISSING);
                }

                payment = paymentRecord;
                resolvedOrderId = payment.order_id || null;

                if (resolvedOrderId) {
                    const { data: linkedOrder, error: linkedOrderError } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('id', resolvedOrderId)
                        .maybeSingle();

                    if (linkedOrderError) {
                        throw linkedOrderError;
                    }

                    order = linkedOrder;
                }
            } else {
                const { data: orderRecord, error: oError } = await supabase
                    .from('orders')
                    .select('*, payments(*)')
                    .eq('id', orderId)
                    .single();

                if (oError || !orderRecord) throw new Error(ORDER.ORDER_NOT_FOUND);
                order = orderRecord;

                payment = order.payments?.[0];
                if (!payment?.razorpay_payment_id) {
                    logger.info({ orderId }, '[RefundService] Missing eager payment relation, using payments fallback lookup');
                    const { data: fallbackPayment } = await supabase
                        .from('payments')
                        .select('*')
                        .eq('order_id', orderId)
                        .maybeSingle();

                    if (fallbackPayment?.razorpay_payment_id) {
                        payment = fallbackPayment;
                        logger.info({ orderId, paymentId: payment.id }, '[RefundService] Payment fallback lookup succeeded');
                    } else {
                        throw new Error(ORDER.RAZORPAY_ID_MISSING);
                    }
                }
            }

            if (!payment?.razorpay_payment_id) {
                throw new Error(ORDER.RAZORPAY_ID_MISSING);
            }

            const amount = overrideAmount
                || (refundType === REFUND_TYPES.TECHNICAL_REFUND
                    ? Number(payment.amount || order?.total_amount || 0)
                    : Number(order?.total_amount || payment.amount || 0));

            if (amount <= 0) {
                logger.warn({ orderId: resolvedOrderId, paymentId: payment?.id, amount }, "Attempted to process zero or negative refund. Skipping.");
                return { success: false, reason: 'ZERO_AMOUNT' };
            }
            
            const idempotencyKey = this.buildRefundIdempotencyKey({
                orderId: resolvedOrderId,
                paymentId: payment.id,
                refundType
            });

            // 3. Create Record and Guard against duplicates
            const { data: refundRecord, error: rError } = await supabase
                .from('refunds')
                .insert({
                    order_id: resolvedOrderId,
                    payment_id: payment.id,
                    amount: amount,
                    status: 'PENDING',
                    refund_type: refundType,
                    razorpay_refund_status: 'PENDING',
                    idempotency_key: idempotencyKey,
                    reason,
                    metadata: {
                        initiated_by: initiatedBy,
                        reference_type: isInternalPaymentId ? 'payment' : 'order',
                        technical_refund: refundType === REFUND_TYPES.TECHNICAL_REFUND
                    }
                })
                .select()
                .single();

            if (rError) {
                if (rError.code === '23505') { // Unique violation
                    logger.info(`[RefundService] Duplicate refund detected for order ${orderId}. Skipping Razorpay call.`);
                    return { success: true, reason: 'DUPLICATE_SKIPPED' };
                }
                throw rError;
            }

            // 4. Razorpay Call
            const refundOptions = {
                amount: Math.round(amount * 100), // Convert to paise
                speed: 'normal',
                notes: {
                    order_id: resolvedOrderId || '',
                    payment_id: payment.id,
                    refund_type: refundType,
                    idempotency_key: idempotencyKey
                }
            };

            const rpRefund = await razorpay.payments.refund(payment.razorpay_payment_id, refundOptions);

            // 5. Finalize
            await supabase.from('refunds').update({
                razorpay_refund_id: rpRefund.id,
                status: 'PROCESSED',
                razorpay_refund_status: 'PROCESSED',
                updated_at: new Date()
            }).eq('id', refundRecord.id);

            // Sync domain state on related Return (if exists)
            if (resolvedOrderId) {
                await supabase.from('returns').update({
                    refund_status: REFUND_STATUS.REFUNDED
                }).eq('order_id', resolvedOrderId);
            }

            return { success: true, refundId: rpRefund.id, amount };

        } catch (error) {
            logger.error(`[RefundService] asyncProcessRefund failed for reference ${orderId}: ${error.message}`);
            throw error;
        }
    }

    static async deleteOrphanPaymentRecord(paymentId) {
        if (!paymentId) {
            return false;
        }

        const { error } = await supabase
            .from('payments')
            .delete()
            .eq('id', paymentId)
            .is('order_id', null);

        if (error) {
            throw error;
        }

        return true;
    }

    static async processOrphanPayments() {
        const result = {
            processed: 0,
            matched: 0,
            flagged: 0,
            refunded: 0,
            failed: 0,
        };

        const { data: orphanPayments, error } = await supabase
            .from('payments')
            .select('id, order_id, amount, status, razorpay_payment_id, razorpay_order_id, user_id, metadata, created_at')
            .is('order_id', null)
            .not('razorpay_payment_id', 'is', null)
            .in('status', ['CAPTURED_ORPHAN', 'captured', 'paid']);

        if (error) {
            throw error;
        }

        for (const payment of orphanPayments || []) {
            try {
                result.processed++;
                const ageHours = (Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60);

                // Tier 1: Match by razorpay_order_id
                const matched = await this._tryMatchOrphan(payment);
                if (matched) {
                    result.matched++;
                    logger.info(`[RefundService] Orphan ${payment.id} matched to ${matched.type} ${matched.entityId}`);
                    continue;
                }

                // Tier 2: If >72 hours unmatched, auto-refund (existing behavior)
                if (ageHours > 72) {
                    await this.asyncProcessRefund(
                        payment.id,
                        REFUND_TYPES.TECHNICAL_REFUND,
                        'SYSTEM',
                        'Orphan payment auto-refund (>72h unmatched)',
                        true
                    );
                    result.refunded++;
                    logger.info(`[RefundService] Orphan ${payment.id} auto-refunded after ${Math.round(ageHours)}h`);
                    continue;
                }

                // Tier 3: If >24 hours unmatched, flag for manual review
                if (ageHours > 24) {
                    await supabase
                        .from('payments')
                        .update({
                            status: 'FLAGGED_FOR_REVIEW',
                            metadata: {
                                ...(payment.metadata || {}),
                                flagged_reason: 'Orphan payment unmatched >24h',
                                flagged_at: new Date().toISOString(),
                            },
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', payment.id);
                    result.flagged++;
                    continue;
                }

                // <24 hours: skip, may still get a delayed webhook
            } catch (sweepError) {
                result.failed++;
                logger.error(`[RefundService] Orphan reconciliation failed for payment ${payment.id}: ${sweepError.message}`);
            }
        }

        return result;
    }

    /**
     * Attempt to match an orphan payment to an existing entity.
     * Tries: orders → event_registrations → donations
     * @returns {{ type: string, entityId: string }|null}
     */
    static async _tryMatchOrphan(payment) {
        // Match by razorpay_order_id (most reliable)
        if (payment.razorpay_order_id) {
            // Check orders
            const { data: order } = await supabase
                .from('orders')
                .select('id')
                .eq('razorpay_order_id', payment.razorpay_order_id)
                .maybeSingle();

            if (order) {
                await supabase.from('payments').update({
                    order_id: order.id,
                    status: 'SUCCESS',
                    updated_at: new Date().toISOString()
                }).eq('id', payment.id);
                return { type: 'order', entityId: order.id };
            }

            // Check event registrations
            const { data: eventReg } = await supabase
                .from('event_registrations')
                .select('id')
                .eq('razorpay_order_id', payment.razorpay_order_id)
                .maybeSingle();

            if (eventReg) {
                await supabase.from('event_registrations').update({
                    payment_status: 'SUCCESS',
                    status: 'confirmed',
                    razorpay_payment_id: payment.razorpay_payment_id,
                    updated_at: new Date().toISOString()
                }).eq('id', eventReg.id);

                await supabase.from('payments').update({
                    status: 'SUCCESS',
                    updated_at: new Date().toISOString()
                }).eq('id', payment.id);

                return { type: 'event_registration', entityId: eventReg.id };
            }

            // Check donations
            const { data: donation } = await supabase
                .from('donations')
                .select('id')
                .eq('razorpay_order_id', payment.razorpay_order_id)
                .maybeSingle();

            if (donation) {
                await supabase.from('donations').update({
                    payment_status: 'SUCCESS',
                    razorpay_payment_id: payment.razorpay_payment_id,
                    updated_at: new Date().toISOString()
                }).eq('id', donation.id);

                await supabase.from('payments').update({
                    status: 'SUCCESS',
                    updated_at: new Date().toISOString()
                }).eq('id', payment.id);

                return { type: 'donation', entityId: donation.id };
            }
        }

        // Match by metadata notes (Razorpay stores order_id in notes)
        const notesOrderId = payment.metadata?.notes?.order_id
            || payment.metadata?.notes?.registration_id;

        if (notesOrderId) {
            const { data: order } = await supabase
                .from('orders')
                .select('id')
                .eq('id', notesOrderId)
                .maybeSingle();

            if (order) {
                await supabase.from('payments').update({
                    order_id: order.id,
                    status: 'SUCCESS',
                    updated_at: new Date().toISOString()
                }).eq('id', payment.id);
                return { type: 'order', entityId: order.id };
            }
        }

        return null; // No match found
    }

    static async processPendingRefundJobs() {
        const result = {
            processed: 0,
            reconciled: 0,
            failed: 0
        };

        const { data: pendingRefunds, error } = await supabase
            .from('refunds')
            .select('*')
            .in('status', ['PENDING', 'PROCESSING', 'FAILED'])
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) {
            throw error;
        }

        for (const refundJob of pendingRefunds || []) {
            try {
                if (refundJob.order_id) {
                    await this.executeRefund(refundJob);
                    result.processed += 1;
                } else {
                    result.reconciled += 1;
                }
            } catch (refundError) {
                result.failed += 1;
                logger.error(`[RefundService] Pending refund reconciliation failed for refund ${refundJob.id}: ${refundError.message}`);
            }
        }

        return result;
    }

    static async executeRefund(refundJob, order = null, payment = null, initiatedBy = 'SYSTEM') {
        if (!refundJob?.id) {
            throw new Error('REFUND_JOB_NOT_FOUND');
        }

        const orderId = refundJob.order_id || order?.id;
        if (!orderId) {
            throw new Error('ORDER_NOT_FOUND');
        }

        const resolvedOrder = order || (await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()).data;

        if (!resolvedOrder) {
            throw new Error(ORDER.ORDER_NOT_FOUND);
        }

        let resolvedPayment = payment;
        if (!resolvedPayment?.razorpay_payment_id) {
            const paymentQuery = refundJob.payment_id
                ? supabase.from('payments').select('*').eq('id', refundJob.payment_id).maybeSingle()
                : supabase.from('payments').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            resolvedPayment = (await paymentQuery).data;
        }

        if (!resolvedPayment?.razorpay_payment_id) {
            throw new Error(ORDER.RAZORPAY_ID_MISSING);
        }

        const amount = Number(refundJob.amount || resolvedOrder.total_amount || 0);
        if (amount <= 0) {
            return { success: false, reason: 'ZERO_AMOUNT' };
        }

        try {
            const rpRefund = await razorpay.payments.refund(resolvedPayment.razorpay_payment_id, {
                amount: Math.round(amount * 100),
                speed: 'normal',
                notes: {
                    order_id: orderId,
                    refund_job_id: refundJob.id,
                    initiated_by: initiatedBy
                }
            });

            await supabase.from('refunds').update({
                payment_id: resolvedPayment.id,
                razorpay_refund_id: rpRefund.id,
                status: REFUND_STATUS.REFUNDED,
                updated_at: new Date().toISOString()
            }).eq('id', refundJob.id);

            await supabase.from('returns').update({
                refund_status: REFUND_STATUS.REFUNDED
            }).eq('order_id', orderId);

            await this.syncOrderRefunds(orderId, false, initiatedBy);

            return { success: true, refundId: rpRefund.id, amount };
        } catch (error) {
            await supabase.from('refunds').update({
                status: REFUND_STATUS.FAILED,
                reason: error.message,
                updated_at: new Date().toISOString()
            }).eq('id', refundJob.id);
            throw error;
        }
    }

    static async retryRefund(refundId, initiatedBy = 'SYSTEM') {
        const { data: refundJob, error } = await supabase
            .from('refunds')
            .select('*')
            .eq('id', refundId)
            .single();

        if (error || !refundJob) {
            throw new Error('REFUND_JOB_NOT_FOUND');
        }

        if (!this.isRetryableStatus(refundJob.status)) {
            return { success: false, reason: 'NON_RETRYABLE_STATUS' };
        }

        await supabase.from('refunds').update({
            status: 'PENDING',
            retry_count: Number(refundJob.retry_count || 0) + 1,
            updated_at: new Date().toISOString()
        }).eq('id', refundId);

        return this.executeRefund({ ...refundJob, status: 'PENDING' }, null, null, initiatedBy);
    }

    static async syncOrderRefunds(orderId, force = false, initiatedBy = 'SYSTEM') {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, total_amount, payment_status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            const error = new Error(ORDER.ORDER_NOT_FOUND);
            error.status = 404;
            throw error;
        }

        const { data: returns, error: returnError } = await supabase
            .from('returns')
            .select('id, refund_status, qc_status, return_outcome')
            .eq('order_id', orderId);

        if (returnError) {
            throw returnError;
        }

        for (const returnRequest of returns || []) {
            const normalizedRefundStatus = this.normalizeRefundStatus(returnRequest.refund_status);
            if (force || !this.isTerminalStatus(normalizedRefundStatus)) {
                await this.reconcileReturnRefund(returnRequest.id);
            }
        }

        const { data: refunds, error: refundError } = await supabase
            .from('refunds')
            .select('amount, status')
            .eq('order_id', orderId);

        if (refundError) {
            throw refundError;
        }

        const successfulRefunds = (refunds || []).filter((refund) => SUCCESSFUL_REFUND_STATUSES.has(this.normalizeRefundStatus(refund.status)));
        const pendingRefunds = (refunds || []).filter((refund) => this.normalizeRefundStatus(refund.status) === 'PENDING');

        const totalRefunded = successfulRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
        let nextPaymentStatus = order.payment_status;

        if (totalRefunded > 0) {
            nextPaymentStatus = totalRefunded >= Number(order.total_amount || 0)
                ? 'refunded'
                : 'partially_refunded';
        } else if (pendingRefunds.length > 0) {
            nextPaymentStatus = 'refund_initiated';
        }

        if (nextPaymentStatus !== order.payment_status) {
            await supabase.from('orders').update({
                payment_status: nextPaymentStatus,
                updated_at: new Date().toISOString()
            }).eq('id', orderId);

            await logStatusHistory(
                orderId,
                nextPaymentStatus,
                initiatedBy,
                nextPaymentStatus === 'refunded'
                    ? ORDER.REFUND_PROCESSED_NOTE
                    : nextPaymentStatus === 'refund_initiated'
                        ? ORDER.REFUND_INITIATED_NOTE
                        : ORDER.PARTIALLY_REFUNDED_NOTE,
                'SYSTEM'
            );
        }

        if (successfulRefunds.length > 0) {
            await supabase.from('returns').update({
                refund_status: REFUND_STATUS.REFUNDED,
                updated_at: new Date().toISOString()
            }).eq('order_id', orderId);
        } else if (pendingRefunds.length > 0) {
            await supabase.from('returns').update({
                refund_status: REFUND_STATUS.REFUND_INITIATED,
                updated_at: new Date().toISOString()
            }).eq('order_id', orderId);
        }

        return {
            success: true,
            message: successfulRefunds.length > 0
                ? 'Refund state synchronized successfully.'
                : pendingRefunds.length > 0
                    ? 'Refund synchronization completed. Refund is still pending.'
                    : 'No refunds found to synchronize.'
        };
    }
}

// Initialize the service listener singleton
RefundService.init();

module.exports = { RefundService, REFUND_TYPES };
