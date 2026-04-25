const { supabase, supabaseAdmin } = require('../lib/supabase');
const logger = require('../utils/logger');
const { ORDER_STATUS } = require('../config/constants');


const ALLOWED_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED_BY_ADMIN, ORDER_STATUS.CANCELLED_BY_CUSTOMER],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED_BY_ADMIN, ORDER_STATUS.CANCELLED_BY_CUSTOMER],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED_BY_ADMIN, ORDER_STATUS.CANCELLED_BY_CUSTOMER],
    [ORDER_STATUS.PACKED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED_BY_ADMIN, ORDER_STATUS.CANCELLED_BY_CUSTOMER],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERY_UNSUCCESSFUL],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERY_UNSUCCESSFUL],
    [ORDER_STATUS.DELIVERY_UNSUCCESSFUL]: [ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED, ORDER_STATUS.RTO_IN_TRANSIT],
    [ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.RTO_IN_TRANSIT],
    [ORDER_STATUS.RTO_IN_TRANSIT]: [ORDER_STATUS.RETURNED_TO_ORIGIN],
    [ORDER_STATUS.RETURNED_TO_ORIGIN]: [ORDER_STATUS.REFUND_INITIATED],
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURN_REQUESTED],
    [ORDER_STATUS.RETURN_REQUESTED]: [ORDER_STATUS.RETURN_APPROVED, ORDER_STATUS.RETURN_REJECTED],
    [ORDER_STATUS.RETURN_APPROVED]: [ORDER_STATUS.PICKUP_SCHEDULED, ORDER_STATUS.RETURN_CANCELLED], 
    [ORDER_STATUS.PICKUP_SCHEDULED]: [ORDER_STATUS.PICKUP_ATTEMPTED, ORDER_STATUS.PICKUP_COMPLETED, ORDER_STATUS.PICKUP_FAILED],
    [ORDER_STATUS.PICKUP_ATTEMPTED]: [ORDER_STATUS.PICKUP_SCHEDULED, ORDER_STATUS.PICKUP_FAILED],
    [ORDER_STATUS.PICKUP_COMPLETED]: [ORDER_STATUS.PICKED_UP],
    [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.IN_TRANSIT_TO_WAREHOUSE],
    [ORDER_STATUS.IN_TRANSIT_TO_WAREHOUSE]: [ORDER_STATUS.PARTIALLY_RETURNED, ORDER_STATUS.RETURNED],
    [ORDER_STATUS.PICKUP_FAILED]: [ORDER_STATUS.DELIVERED], // Reversion as per PF --> G
    [ORDER_STATUS.PARTIALLY_RETURNED]: [ORDER_STATUS.QC_INITIATED],
    [ORDER_STATUS.RETURNED]: [ORDER_STATUS.QC_INITIATED],
    [ORDER_STATUS.QC_INITIATED]: [ORDER_STATUS.QC_PASSED, ORDER_STATUS.QC_FAILED],
    [ORDER_STATUS.QC_PASSED]: [ORDER_STATUS.REFUND_INITIATED],
    [ORDER_STATUS.QC_FAILED]: [ORDER_STATUS.PARTIAL_REFUND, ORDER_STATUS.ZERO_REFUND, ORDER_STATUS.RETURN_BACK_TO_CUSTOMER, ORDER_STATUS.DISPOSE_OR_LIQUIDATE],
    [ORDER_STATUS.PARTIAL_REFUND]: [ORDER_STATUS.REFUND_INITIATED],
    [ORDER_STATUS.REFUND_INITIATED]: [ORDER_STATUS.GATEWAY_PROCESSING],
    [ORDER_STATUS.GATEWAY_PROCESSING]: [ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.CANCELLED_BY_ADMIN]: [ORDER_STATUS.REFUND_INITIATED],
    [ORDER_STATUS.CANCELLED_BY_CUSTOMER]: [ORDER_STATUS.REFUND_INITIATED],
    [ORDER_STATUS.RETURN_REJECTED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.RETURN_CANCELLED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.ZERO_REFUND]: [], // Terminal NO_REFUND
    [ORDER_STATUS.RETURN_BACK_TO_CUSTOMER]: [], // Terminal
    [ORDER_STATUS.DISPOSE_OR_LIQUIDATE]: [], // Terminal
    [ORDER_STATUS.REFUNDED]: [] // Terminal
};

const STATUS_MESSAGES = {
    [ORDER_STATUS.PENDING]: 'Order placed successfully. Awaiting confirmation.',
    [ORDER_STATUS.CONFIRMED]: 'Order has been confirmed.',
    [ORDER_STATUS.PROCESSING]: 'Order is being processed and prepared for packing.',
    [ORDER_STATUS.PACKED]: 'Order has been packed and is ready for dispatch.',
    [ORDER_STATUS.SHIPPED]: 'Order has been shipped and is on its way.',
    [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Order is out for delivery. You will receive it soon!',
    [ORDER_STATUS.DELIVERED]: 'Order has been delivered successfully.',
    [ORDER_STATUS.DELIVERY_REATTEMPT_SCHEDULED]: 'A reattempt delivery has been scheduled for this order.',
    [ORDER_STATUS.CANCELLED]: 'Order has been cancelled.',
    [ORDER_STATUS.RETURN_REQUESTED]: 'Return request submitted. Awaiting approval.',
    [ORDER_STATUS.RETURN_APPROVED]: 'Return request approved. We have initiated the processing of your request.',
    [ORDER_STATUS.PICKUP_SCHEDULED]: 'Pickup has been scheduled.',
    [ORDER_STATUS.PICKUP_ATTEMPTED]: 'A pickup attempt was made.',
    [ORDER_STATUS.PICKUP_COMPLETED]: 'Pickup has been completed by the logistics team.',
    [ORDER_STATUS.PICKED_UP]: 'Product has been picked up from customer.',
    [ORDER_STATUS.IN_TRANSIT_TO_WAREHOUSE]: 'Product is in transit to our warehouse.',
    [ORDER_STATUS.RETURN_PICKED_UP]: 'Return items have been picked up from your location.',
    [ORDER_STATUS.RETURN_REJECTED]: 'Return request has been rejected.',
    [ORDER_STATUS.RETURNED]: 'Returned items received at warehouse. QC initiated.',
    [ORDER_STATUS.QC_INITIATED]: 'Quality check is in progress at the warehouse.',
    [ORDER_STATUS.QC_PASSED]: 'Quality check passed. Initiating refund.',
    [ORDER_STATUS.QC_FAILED]: 'Quality check failed. Reviewing outcome.',
    [ORDER_STATUS.PARTIAL_REFUND]: 'Partial refund approved after QC assessment.',
    [ORDER_STATUS.ZERO_REFUND]: 'No refund eligible due to QC failure.',
    [ORDER_STATUS.REFUND_INITIATED]: 'Refund has been initiated through our payment gateway.',
    [ORDER_STATUS.REFUNDED]: 'The refund has been successfully completed and credited back.',
    [ORDER_STATUS.DELIVERY_UNSUCCESSFUL]: 'Delivery attempt was unsuccessful. Next logistics action is being reviewed.',
    [ORDER_STATUS.RTO_IN_TRANSIT]: 'Order is now in transit back to origin after failed delivery attempts.',
    [ORDER_STATUS.RETURNED_TO_ORIGIN]: 'Order has been returned to origin after unsuccessful delivery attempts.',
    [ORDER_STATUS.PARTIALLY_RETURNED]: 'Some items have been returned and received at warehouse.',
    [ORDER_STATUS.RETURN_BACK_TO_CUSTOMER]: 'Item fails QC and is being returned back to customer.',
    [ORDER_STATUS.DISPOSE_OR_LIQUIDATE]: 'Item fails QC and will be disposed or liquidated.',
    [ORDER_STATUS.PICKUP_FAILED]: 'Pickup failed after maximum attempts. Order reverted to previous state.'
};

/**
 * Validates if the transition from current to new status is allowed.
 * @param {string} currentStatus 
 * @param {string} newStatus 
 * @returns {boolean}
 */
function isValidTransition(currentStatus, newStatus) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(newStatus);
}

/**
 * Logs a status change to the order_status_history table.
 * @param {string} orderId 
 * @param {string} statusOrEventType - Status or specific Event Type
 * @param {string} updatedBy - User ID or 'SYSTEM'
 * @param {string} notes 
 * @param {string} actor - 'SYSTEM', 'ADMIN', 'USER'
 * @param {string} eventType - Optional explicit event type
 * @param {object} metadata - Optional rich event data (refund info, etc.)
 */
async function logStatusHistory(orderId, statusOrEventType, updatedBy, notes = '', actor = 'SYSTEM', eventType = null, metadata = {}, returnId = null) {
    // Mapping of internal statuses to descriptive timeline event types
    const EVENT_TYPE_MAP = {
        'pending': 'ORDER_PLACED',
        'confirmed': 'ORDER_CONFIRMED',
        'processing': 'ORDER_PROCESSING',
        'packed': 'ORDER_PACKED',
        'shipped': 'ORDER_SHIPPED',
        'out_for_delivery': 'OUT_FOR_DELIVERY',
        'delivered': 'ORDER_DELIVERED',
        'cancelled': 'ORDER_CANCELLED',
        'cancelled_by_admin': 'CANCELLED_BY_ADMIN',
        'cancelled_by_customer': 'CANCELLED_BY_CUSTOMER',
        'delivery_reattempt_scheduled': 'DELIVERY_REATTEMPT_SCHEDULED',
        'rto_in_transit': 'RTO_IN_TRANSIT',
        'returned_to_origin': 'RETURNED_TO_ORIGIN',
        'returned': 'ORDER_RETURNED',
        'partially_returned': 'PARTIALLY_RETURNED',
        'delivery_unsuccessful': 'DELIVERY_UNSUCCESSFUL',
        'return_requested': 'RETURN_REQUESTED',
        'return_approved': 'RETURN_APPROVED',
        'return_rejected': 'RETURN_REJECTED',
        'refund_initiated': 'REFUND_INITIATED',
        'refunded': 'REFUND_COMPLETED',
        'partially_refunded': 'REFUND_PARTIAL',
        'pickup_scheduled': 'PICKUP_SCHEDULED',
        'return_pickup_scheduled': 'PICKUP_SCHEDULED',
        'pickup_attempted': 'PICKUP_ATTEMPTED',
        'pickup_completed': 'PICKUP_COMPLETED',
        'pickup_failed': 'PICKUP_FAILED',
        'return_picked_up': 'RETURN_PICKED_UP',
        'return_completed': 'ORDER_RETURNED',
        'return_cancelled': 'RETURN_CANCELLED',
        'qc_initiated': 'QC_INITIATED',
        'qc_passed': 'QC_PASSED',
        'qc_failed': 'QC_FAILED',
        'gateway_processing': 'GATEWAY_PROCESSING',
        'return_to_customer': 'RETURN_BACK_TO_CUSTOMER',
        'dispose_liquidate': 'DISPOSE_OR_LIQUIDATE',
        'picked_up': 'PICKED_UP',
        'in_transit_to_warehouse': 'IN_TRANSIT_TO_WAREHOUSE',
        'partial_refund': 'PARTIAL_REFUND',
        'zero_refund': 'ZERO_REFUND',
        'ITEM_RETURNED': 'ITEM_RETURNED',
        'PAYMENT_SUCCESS': 'PAYMENT_SUCCESS',
        'PAYMENT_FAILED': 'PAYMENT_FAILED'
    };

    // Determine actual status and event type
    const status = (statusOrEventType in EVENT_TYPE_MAP)
        ? statusOrEventType
        : (eventType ? statusOrEventType : 'STATUS_CHANGE');

    const finalEventType = eventType || EVENT_TYPE_MAP[statusOrEventType] || 'STATUS_CHANGE';

    // Auto-detect actor if not provided but user is
    let finalActor = actor;
    if (actor === 'SYSTEM' && updatedBy && updatedBy !== 'SYSTEM') {
        finalActor = 'USER';
    }

    try {
        // Use direct insert to bypass any proxy issues if needed, or stick to standard supabase client
        // but ensure we use the one with service role key (which is our standard proxied client)
        let { error } = await supabaseAdmin
            .from('order_status_history')
            .insert({
                order_id: orderId,
                status: status,
                event_type: finalEventType,
                metadata: metadata || {},
                actor: finalActor,
                return_id: returnId,
                updated_by: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedBy) ? updatedBy : null,
                notes: (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedBy) || updatedBy === 'SYSTEM') ? notes : `${notes} (Updated by: ${updatedBy})`,
                created_at: new Date().toISOString()
            });

        if (error) {
            logger.warn(`Failed to log history for order ${orderId} with user ${updatedBy}. Error: ${error.message}. Code: ${error.code}`);

            // Handle FK violation (23503), Invalid UUID (22P02), OR RLS violation (42501)
            if (error.code === '23503' || error.code === '22P02' || error.code === '42501') {
                logger.info(`Retrying log history for order ${orderId} as System (null user) due to error ${error.code}`);
                const retryResult = await supabaseAdmin.from('order_status_history').insert({
                    order_id: orderId,
                    status: status,
                    event_type: finalEventType,
                    metadata: metadata || {},
                    actor: finalActor, // Keep the final actor (ADMIN/SYSTEM/USER)
                    return_id: returnId,
                    updated_by: null,
                    notes: notes + (error.code === '42501' ? ' [RLS Bypass]' : error.code === '22P02' ? ' [Invalid UUID]' : ' [User ID invalid]'),
                    created_at: new Date().toISOString()
                });

                if (retryResult.error) {
                    logger.error({ err: retryResult.error, orderId }, 'Retry also failed for history logging');
                } else {
                    logger.info({ orderId, status, actor: finalActor }, 'Successfully logged status history via retry');
                }
            }
        } else {
            logger.info({ orderId, status, actor: finalActor }, 'Successfully logged status history');
        }
    } catch (err) {
        logger.error({ err }, 'Exception in logStatusHistory');
    }
}

module.exports = {
    ORDER_STATUS,
    ALLOWED_TRANSITIONS,
    STATUS_MESSAGES,
    isValidTransition,
    logStatusHistory
};
