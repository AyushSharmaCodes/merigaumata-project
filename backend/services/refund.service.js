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

/**
 * Refund Service - Hardened
 */
class RefundService {
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
            return { amount: totalAmount, isFullRefund: true };
        }

        // Standard Business Logic (existing implementation)
        let excludedCharge = 0;
        let excludedGst = 0;
        
        items.forEach(item => {
            const snapshot = item.delivery_calculation_snapshot;
            if (snapshot?.delivery_refund_policy === 'NON_REFUNDABLE') {
                excludedCharge += Number(item.delivery_charge || 0);
                excludedGst += Number(item.delivery_gst || 0);
            }
        });

        const refundAmount = totalAmount - excludedCharge - excludedGst;
        return {
            amount: Math.max(0, Math.round(refundAmount * 100) / 100),
            isFullRefund: (excludedCharge + excludedGst) === 0
        };
    }

    /**
     * Orchestrate Razorpay Refund with Idempotency
     */
    static async asyncProcessRefund(orderId, refundType, initiatedBy = 'SYSTEM', reason = '', isInternalPaymentId = false, overrideAmount = null) {
        try {
            // 1. Fetch context with payment details
            const { data: order, error: oError } = await supabase
                .from('orders')
                .select('*, payments(*)')
                .eq('id', orderId)
                .single();

            if (oError || !order) throw new Error(ORDER.ORDER_NOT_FOUND);

            // RESOLVE PAYMENT ID (RESTORED logic)
            let payment = order.payments?.[0];
            if (!payment?.razorpay_payment_id) {
                logger.info({ orderId }, LOGS.ORDER_PAYMENT_FALLBACK);
                const { data: fallbackPayment } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('order_id', orderId)
                    .maybeSingle();
                
                if (fallbackPayment?.razorpay_payment_id) {
                    payment = fallbackPayment;
                    logger.info({ orderId, paymentId: payment.id }, LOGS.ORDER_PAYMENT_FOUND);
                } else {
                    throw new Error(ORDER.RAZORPAY_ID_MISSING);
                }
            }

            const amount = overrideAmount || order.total_amount;
            if (amount <= 0) {
                logger.warn({ orderId, amount }, "Attempted to process zero or negative refund. Skipping.");
                return { success: false, reason: 'ZERO_AMOUNT' };
            }
            
            // 2. IDEMPOTENCY KEY: Stable format prevents duplicates
            const idempotencyKey = `refund_${orderId}`;

            // 3. Create Record and Guard against duplicates
            const { data: refundRecord, error: rError } = await supabase
                .from('refunds')
                .insert({
                    order_id: orderId,
                    payment_id: payment.id,
                    amount: amount,
                    status: REFUND_STATUS.REFUND_INITIATED,
                    idempotency_key: idempotencyKey,
                    reason,
                    metadata: { initiated_by: initiatedBy }
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
                notes: { order_id: orderId, idempotency_key: idempotencyKey }
            };

            const rpRefund = await razorpay.payments.refund(payment.razorpay_payment_id, refundOptions);

            // 5. Finalize
            await supabase.from('refunds').update({
                razorpay_refund_id: rpRefund.id,
                status: REFUND_STATUS.REFUNDED,
                updated_at: new Date()
            }).eq('id', refundRecord.id);

            // Sync domain state on related Return (if exists)
            await supabase.from('returns').update({
                refund_status: REFUND_STATUS.REFUNDED
            }).eq('order_id', orderId);

            return { success: true, refundId: rpRefund.id, amount };

        } catch (error) {
            logger.error(`[RefundService] asyncProcessRefund failed for order ${orderId}: ${error.message}`);
            throw error;
        }
    }
}

// Initialize the service listener singleton
RefundService.init();

module.exports = { RefundService, REFUND_TYPES };
