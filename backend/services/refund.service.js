const Razorpay = require('razorpay');
const { supabaseAdmin: supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { logStatusHistory } = require('./history.service');
const { ORDER, LOGS } = require('../constants/messages');
const { ORDER_STATUS } = require('../config/constants');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const REFUND_TYPES = {
    BUSINESS_REFUND: 'BUSINESS_REFUND',
    TECHNICAL_REFUND: 'TECHNICAL_REFUND'
};

/**
 * Refund Service
 * Handles complex refund logic distinguishing between business and technical refunds.
 */
class RefundService {
    /**
     * Calculate's the eligible refund amount based on business rules.
     * @param {object} order - The order object from DB
     * @param {string} refundType - BUSINESS_REFUND or TECHNICAL_REFUND
     * @param {Array} items - Optional: Order items with snapshots for granular calculation
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

        // BUSINESS_REFUND: Check policy
        // If items are provided, use granular item-level policy
        if (items && items.length > 0) {
            let excludedCharge = 0;
            let excludedGst = 0;
            let hasSnapshots = false;

            items.forEach(item => {
                const snapshot = item.delivery_calculation_snapshot;

                if (snapshot && Object.keys(snapshot).length > 0) {
                    hasSnapshots = true;
                    // Priority 1: Full policy exclusion (Surcharge Non-Refundable OR Global Non-Refundable)
                    if (snapshot.delivery_refund_policy === 'NON_REFUNDABLE') {
                        excludedCharge += Number(item.delivery_charge || 0);
                        excludedGst += Number(item.delivery_gst || 0);
                    }
                    // Priority 2: Explicit partial component (Hybrid: Refundable Surcharge + Non-Refundable Global)
                    else if (snapshot.non_refundable_delivery_charge) {
                        excludedCharge += Number(snapshot.non_refundable_delivery_charge || 0);
                        excludedGst += Number(snapshot.non_refundable_delivery_gst || 0);
                    }
                }
            });

            // Fallback for older orders without snapshots
            if (!hasSnapshots && order.is_delivery_refundable === false) {
                excludedCharge = Number(order.delivery_charge || 0);
                excludedGst = Number(order.delivery_gst || 0);
            }

            const refundAmount = totalAmount - excludedCharge - excludedGst;

            return {
                amount: Math.max(0, Math.round(refundAmount * 100) / 100),
                excludedCharge,
                excludedGst,
                isFullRefund: (excludedCharge + excludedGst) === 0
            };
        }

        // Fallback: Use order-level flag (Legacy/Simpler behavior)
        const deliveryCharge = Number(order.delivery_charge || 0);
        const deliveryGst = Number(order.delivery_gst || 0);
        const isDeliveryRefundable = order.is_delivery_refundable !== false; // Default true

        if (!isDeliveryRefundable) {
            const excludedCharge = deliveryCharge;
            const excludedGst = deliveryGst;
            const refundAmount = totalAmount - excludedCharge - excludedGst;

            return {
                amount: Math.max(0, Math.round(refundAmount * 100) / 100),
                excludedCharge,
                excludedGst,
                isFullRefund: false
            };
        }

        return {
            amount: totalAmount,
            excludedCharge: 0,
            excludedGst: 0,
            isFullRefund: true
        };
    }

    /**
     * Orchestrates the refund process: calculation, Razorpay call, and audit logging.
     * @param {string} identifier - orderId or paymentId (internal UUIDs)
     * @param {string} refundType 
     * @param {string} initiatedBy - 'SYSTEM', 'ADMIN', 'USER'
     * @param {string} reason 
     * @param {boolean} isInternalPaymentId - If true, identifier is paymentId instead of orderId
     * @param {number} overrideAmount - Optional custom amount (for partial returns)
     */
    static async asyncProcessRefund(identifier, refundType, initiatedBy = 'SYSTEM', reason = '', isInternalPaymentId = false, overrideAmount = null) {
        try {
            logger.info(`[RefundService] Starting ${refundType} for identifier: ${identifier}${overrideAmount ? ` (Override: ${overrideAmount})` : ''}`);

            let order = null;
            let payment = null;

            // 1. Fetch Order and Payment Details
            if (isInternalPaymentId) {
                const { data: paymentRecord, error: pError } = await supabase
                    .from('payments')
                    .select('*, orders!payments_order_id_fkey(*, order_items(*))')
                    .eq('id', identifier)
                    .maybeSingle();

                if (pError || !paymentRecord) {
                    throw new Error(ORDER.PAYMENT_FETCH_FAILED);
                }
                payment = paymentRecord;
                order = paymentRecord.orders;
            } else {
                const { data: orderRecord, error: oError } = await supabase
                    .from('orders')
                    .select('*, order_items(*)')
                    .eq('id', identifier)
                    .maybeSingle();

                if (oError || !orderRecord) {
                    throw new Error(ORDER.ORDER_FETCH_FAILED);
                }

                const { data: linkedPayments } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('order_id', identifier);

                order = orderRecord;
                payment = (linkedPayments && linkedPayments.length > 0)
                    ? (linkedPayments.find(p => p.status === 'captured' || p.status === 'authorized') || linkedPayments[0])
                    : null;
            }

            if (!payment || !payment.razorpay_payment_id) {
                throw new Error(ORDER.RAZORPAY_ID_MISSING);
            }

            // 2. Calculate Refund Amount
            let calculation;
            if (overrideAmount !== null) {
                calculation = {
                    amount: Number(overrideAmount),
                    excludedCharge: 0,
                    excludedGst: 0,
                    isFullRefund: false
                };
            } else if (refundType === REFUND_TYPES.TECHNICAL_REFUND && !order) {
                calculation = {
                    amount: Number(payment.amount),
                    excludedCharge: 0,
                    excludedGst: 0,
                    isFullRefund: true
                };
            } else if (order) {
                calculation = this.calculateRefundAmount(order, refundType, order.order_items);
            } else {
                throw new Error(ORDER.ORDER_DATA_REQUIRED);
            }

            if (calculation.amount <= 0) {
                logger.warn(`[RefundService] Calculated refund amount is 0 or less. Skipping Razorpay call.`);
                return { success: false, reason: 'Zero refund amount' };
            }

            let finalReason = reason || '';
            const totalExcluded = (calculation.excludedCharge || 0) + (calculation.excludedGst || 0);
            if (totalExcluded > 0) {
                // Use i18n key with parameter for the frontend to resolve
                const deductionNote = `${ORDER.DEDUCTION_NOTICE}:${totalExcluded.toFixed(2)}`;
                finalReason = finalReason ? `${finalReason} | ${deductionNote}` : deductionNote;
            }
            finalReason = finalReason.substring(0, 255);

            // 3. Create Pending Refund Record (Job Tracking)
            let refundRecord = null;
            const { data: job, error: jobError } = await supabase
                .from('refunds')
                .insert({
                    order_id: order?.id || null,
                    payment_id: payment.id,
                    amount: calculation.amount,
                    status: 'PENDING',
                    refund_type: refundType,
                    reason: finalReason,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (jobError) {
                logger.error(`[RefundService] Failed to create pending refund record: ${jobError.message}`);
                // If tracking fails, we still try to proceed but without record verification
            } else {
                refundRecord = job;
            }

            // 4. Delegate to the execution engine
            return await this.executeRefund(refundRecord, order, payment, initiatedBy);

        } catch (error) {
            logger.error(`[RefundService] Refund orchestration failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sweeps the payments table for 'captured' payments that have no associated order_id
     * older than 15 minutes, representing a frontend dropout after successful payment.
     * Automatically initiates a technical refund.
     */
    static async processOrphanPayments() {
        try {
            logger.info('[RefundService] Starting Orphan Payment Sweep...');

            // 1. Find orphan payments older than 15 mins
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

            // Using maybeSingle() or select() to get array of orphans
            const { data: orphans, error: fetchError } = await supabase
                .from('payments')
                .select('*, profiles(email)')
                .in('status', ['captured', 'PAYMENT_SUCCESS', 'CAPTURED_ORPHAN'])
                .is('order_id', null)
                .lt('created_at', fifteenMinsAgo);

            if (fetchError) throw fetchError;

            if (!orphans || orphans.length === 0) {
                logger.info('[RefundService] No orphan payments found.');
                return { processed: 0, failed: 0 };
            }

            logger.info(`[RefundService] Found ${orphans.length} orphan payments. Processing refunds...`);

            let processed = 0;
            let failed = 0;

            for (const payment of orphans) {
                try {
                    // 2. Initiate Razorpay Refund
                    const refundOptions = {
                        amount: Math.round(payment.amount * 100),
                        speed: 'normal',
                        notes: {
                            order_id: 'ORPHAN',
                            refund_type: REFUND_TYPES.TECHNICAL_REFUND,
                            initiated_by: 'CRON_SWEEPER',
                            reason: 'Orphan Payment Sweeper - Auto Refund',
                            db_payment_id: payment.id
                        }
                    };

                    const rpRefund = await razorpay.payments.refund(payment.razorpay_payment_id, refundOptions);

                    // 3. Update payment status to REFUNDED_ORPHAN
                    await supabase
                        .from('payments')
                        .update({
                            status: 'REFUNDED_ORPHAN',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', payment.id);

                    // 4. Log in Refunds table
                    await supabase
                        .from('refunds')
                        .insert([{
                            payment_id: payment.id,
                            amount: payment.amount,
                            reason: 'Orphan payment detected by sweeper',
                            status: 'processed',
                            refund_type: REFUND_TYPES.TECHNICAL_REFUND,
                            razorpay_refund_id: rpRefund.id,
                            razorpay_refund_status: 'processed'
                        }]);

                    // Log firmly in Financial Audit
                    logger.info(`[RefundService] Successfully swept and refunded orphan payment: ${payment.razorpay_payment_id}`);
                    processed++;

                } catch (paymentErr) {
                    logger.error(`[RefundService] Failed to process orphan payment ${payment.razorpay_payment_id}: ${paymentErr.message}`);
                    failed++;
                }
            }

            return { processed, failed };

        } catch (error) {
            logger.error(`[RefundService] Orphan Payment Sweep failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Core Refund Execution Engine
     * Handles the actual Razorpay call and database updates.
     */
    static async executeRefund(refundRecord, order, payment, initiatedBy = 'SYSTEM') {
        try {
            if (!refundRecord || !payment || !payment.razorpay_payment_id) {
                throw new Error('Incomplete refund context');
            }

            logger.info(`[RefundService] Executing Razorpay refund: ${refundRecord.amount} for Payment: ${payment.razorpay_payment_id}`);

            // 1. Initiate Razorpay Refund
            const refundOptions = {
                amount: Math.round(refundRecord.amount * 100), // Razorpay expects paise
                speed: 'normal',
                notes: {
                    order_id: order?.id || 'N/A',
                    refund_type: refundRecord.refund_type,
                    initiated_by: initiatedBy,
                    reason: refundRecord.reason,
                    db_payment_id: payment.id
                }
            };

            const rpRefund = await razorpay.payments.refund(payment.razorpay_payment_id, refundOptions);
            logger.info(`[RefundService] Razorpay refund successful ID: ${rpRefund.id}`);

            // 2. Update Refund Record
            const { error: updateError } = await supabase
                .from('refunds')
                .update({
                    razorpay_refund_id: rpRefund.id,
                    status: 'processing', // Webhook will update to 'processed'
                    razorpay_refund_status: 'PENDING',
                    updated_at: new Date().toISOString()
                })
                .eq('id', refundRecord.id);

            if (updateError) {
                logger.error(`[RefundService] Failed to update refund record ${refundRecord.id}: ${updateError.message}`);
            }

            // 3. Update Statuses
            if (order) {
                await supabase
                    .from('orders')
                    .update({
                        payment_status: 'refund_initiated',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);

                try {
                    await logStatusHistory(
                        order.id,
                        'refund_initiated',
                        (initiatedBy === 'ADMIN' || initiatedBy === 'SYSTEM') ? 'SYSTEM' : order.user_id,
                        ORDER.REFUND_INITIATED_NOTE,
                        initiatedBy
                    );
                } catch (histError) {
                    logger.warn(`[RefundService] Failed to log history: ${histError.message}`);
                }
            }

            await supabase
                .from('payments')
                .update({
                    status: 'refund_initiated',
                    refund_type: refundRecord.refund_type,
                    updated_at: new Date().toISOString()
                })
                .eq('id', payment.id);

            return {
                success: true,
                refundId: rpRefund.id,
                amount: refundRecord.amount
            };

        } catch (error) {
            logger.error(`[RefundService] Execution failed: ${error.message}`);

            if (refundRecord?.id) {
                await supabase
                    .from('refunds')
                    .update({
                        status: 'FAILED',
                        reason: `${refundRecord.reason} | ERROR: ${error.message}`.substring(0, 255),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', refundRecord.id);
            }

            throw error;
        }
    }

    /**
     * Retry a failed refund job
     */
    static async retryRefund(refundId, initiatedBy = 'ADMIN') {
        try {
            logger.info(`[RefundService] Retrying refund: ${refundId}`);

            // 1. Fetch existing record
            const { data: refundRecord, error: rError } = await supabase
                .from('refunds')
                .select('*, payments(*)')
                .eq('id', refundId)
                .single();

            if (rError || !refundRecord) {
                throw new Error('Refund record not found');
            }

            if (refundRecord.status === 'processed' || refundRecord.status === 'COMPLETED') {
                throw new Error('Refund already completed');
            }

            const payment = refundRecord.payments;
            if (!payment) throw new Error('Payment record not found for refund');

            // 2. Fetch Order (if exists)
            let order = null;
            if (refundRecord.order_id) {
                const { data: orderRec } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', refundRecord.order_id)
                    .single();
                order = orderRec;
            }

            // 3. Increment retry count and reset status
            await supabase
                .from('refunds')
                .update({
                    status: 'PENDING',
                    retry_count: (refundRecord.retry_count || 0) + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', refundId);

            // 4. Re-execute
            return await this.executeRefund({ ...refundRecord, status: 'PENDING' }, order, payment, initiatedBy);

        } catch (error) {
            logger.error(`[RefundService] Retry failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Manually syncs and optionally forces order refunds if Razorpay webhooks were missed.
     * @param {string} orderId 
     * @param {boolean} force - If true, bypassing Razorpay api and forces the refund.
     * @param {string} adminId
     */
    static async syncOrderRefunds(orderId, force = false, adminId = 'SYSTEM') {
        try {
            logger.info(`[RefundService] Syncing refunds for order: ${orderId} (Force: ${force})`);

            // Fetch the payment
            const { data: dbPayment, error: paymentError } = await supabase
                .from('payments')
                .select('*')
                .eq('order_id', orderId)
                .in('status', ['refund_initiated', 'refund_failed', 'captured', 'PAYMENT_SUCCESS', 'REFUND_PARTIAL', 'REFUND_COMPLETED'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (paymentError || !dbPayment) {
                throw new Error(`Payment record not found for sync: ${paymentError?.message || 'Not found'}`);
            }

            // Fetch all refunds meant for sync
            const { data: refunds, error: refundsError } = await supabase
                .from('refunds')
                .select('*')
                .eq('payment_id', dbPayment.id);

            if (refundsError) {
                throw new Error(`Refund fetch error: ${refundsError.message}`);
            }

            let syncOccurred = false;

            if (refunds && refunds.length > 0) {
                // 1. Process sync or force on pending/processing refunds
                for (const refund of refunds) {
                    if (refund.status === 'processed' || refund.status === 'COMPLETED') {
                        continue;
                    }

                    let isProcessed = false;

                    if (force) {
                        isProcessed = true;
                        logger.info(`[RefundService] Forcing processed state for refund: ${refund.id}`);
                    } else if (refund.razorpay_refund_id) {
                        try {
                            const rpRefund = await razorpay.refunds.fetch(refund.razorpay_refund_id);
                            if (rpRefund.status === 'processed') {
                                isProcessed = true;
                                logger.info(`[RefundService] Razorpay confirmed processed for refund: ${refund.razorpay_refund_id}`);
                            } else {
                                logger.info(`[RefundService] Razorpay status for ${refund.razorpay_refund_id} is ${rpRefund.status}`);
                            }
                        } catch (rpError) {
                            logger.error(`[RefundService] Razorpay fetch failed for refund ${refund.razorpay_refund_id}: ${rpError.message}`);
                        }
                    }

                    if (isProcessed) {
                        await supabase
                            .from('refunds')
                            .update({
                                status: 'processed',
                                razorpay_refund_status: 'processed',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', refund.id);
                        syncOccurred = true;
                    }
                }
            }

            // 2. Aggregate all processed refunds
            const { data: allRefunds, error: allRefundsFetchError } = await supabase
                .from('refunds')
                .select('amount')
                .eq('payment_id', dbPayment.id)
                .in('status', ['processed', 'COMPLETED']);

            if (allRefundsFetchError) {
                throw new Error(`All refunds fetch error: ${allRefundsFetchError.message}`);
            }

            const totalRefunded = allRefunds?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
            const totalPaid = Number(dbPayment.amount);

            // 3. Update payment and order states if refunded >= 0
            // We proceed even if totalRefunded is 0 but force is true? No, if force is true but no refunds exist...
            // the button only appears if status is refund_initiated or we are partially refunded.
            if (syncOccurred || totalRefunded > 0) {
                let isFullRefund = totalRefunded >= totalPaid;

                if (!isFullRefund) {
                    const { data: fullOrder } = await supabase
                        .from('orders')
                        .select('*, order_items(*)')
                        .eq('id', orderId)
                        .single();

                    if (fullOrder && totalRefunded > 0) {
                        const calc = this.calculateRefundAmount(fullOrder, 'BUSINESS_REFUND', fullOrder.order_items);
                        if (totalRefunded >= calc.amount) {
                            isFullRefund = true;
                        }

                        // Consistency: Also check returnable items and cancellation status
                        if (!isFullRefund) {
                            const returnableItems = (fullOrder.order_items || []).filter(i => i.is_returnable !== false);
                            const allReturnableAccountedFor = returnableItems.length > 0 && returnableItems.every(i => (i.returned_quantity || 0) >= i.quantity);

                            if (allReturnableAccountedFor || fullOrder.status === ORDER_STATUS.CANCELLED) {
                                isFullRefund = true;
                            }
                        }
                    }
                }

                const newPaymentStatus = isFullRefund ? 'REFUND_COMPLETED' : 'REFUND_PARTIAL';
                const newOrderStatus = isFullRefund ? 'refunded' : 'partially_refunded';

                // Prevent writing if already in accurate state
                if (dbPayment.status !== newPaymentStatus || Number(dbPayment.total_refunded_amount || 0) !== totalRefunded) {
                    await supabase
                        .from('payments')
                        .update({
                            status: newPaymentStatus,
                            total_refunded_amount: totalRefunded,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', dbPayment.id);
                }

                const { data: orderData } = await supabase.from('orders').select('payment_status, status').eq('id', orderId).single();

                if (orderData && (orderData.payment_status !== newOrderStatus || (isFullRefund && orderData.status !== ORDER_STATUS.RETURNED && orderData.status !== ORDER_STATUS.CANCELLED && orderData.status !== ORDER_STATUS.REFUNDED))) {
                    // Make sure order status is logical
                    const nextStatus = isFullRefund ? (orderData.status === ORDER_STATUS.RETURNED || orderData.status === ORDER_STATUS.CANCELLED ? orderData.status : ORDER_STATUS.REFUNDED) : orderData.status;

                    await supabase
                        .from('orders')
                        .update({
                            payment_status: newOrderStatus,
                            status: nextStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', orderId);

                    await logStatusHistory(
                        orderId,
                        newOrderStatus,
                        adminId,
                        ORDER.REFUND_PROCESSED_NOTE,
                        'ADMIN',
                        force ? 'REFUND_FORCED' : (isFullRefund ? 'REFUND_COMPLETED' : 'REFUND_PARTIAL')
                    );
                }

                return { success: true, message: `Refunds synced successfully. Total refunded: Rs.${totalRefunded}.` };
            }

            return { success: true, message: 'No fully processed refunds found. Status unchanged.' };

        } catch (error) {
            logger.error(`[RefundService] Sync Order Refunds failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = {
    RefundService,
    REFUND_TYPES
};
