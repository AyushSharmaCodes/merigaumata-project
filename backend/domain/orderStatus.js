/**
 * Order Status Lifecycle - SCRUBBED (Lifecycle Only)
 * DO NOT add QC, Refund, or Outcome states here.
 */
const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    PACKED: 'packed',
    SHIPPED: 'shipped',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    DELIVERY_UNSUCCESSFUL: 'delivery_unsuccessful',
    DELIVERY_REATTEMPT_SCHEDULED: 'delivery_reattempt_scheduled',
    RTO_IN_TRANSIT: 'rto_in_transit',
    RETURNED_TO_ORIGIN: 'returned_to_origin',
    RETURN_REQUESTED: 'return_requested',
    RETURN_APPROVED: 'return_approved',
    PICKUP_SCHEDULED: 'pickup_scheduled',
    PICKUP_ATTEMPTED: 'pickup_attempted',
    PICKUP_COMPLETED: 'pickup_completed',
    PICKUP_FAILED: 'pickup_failed',
    PICKED_UP: 'picked_up',
    IN_TRANSIT_TO_WAREHOUSE: 'in_transit_to_warehouse',
    PARTIALLY_RETURNED: 'partially_returned',
    RETURNED: 'returned',
    CANCELLED_BY_ADMIN: 'cancelled_by_admin',
    CANCELLED_BY_CUSTOMER: 'cancelled_by_customer',
    CANCELLED: 'cancelled',
    RETURN_REJECTED: 'return_rejected',
    RETURN_CANCELLED: 'return_cancelled',
    QC_INITIATED: 'qc_initiated',
    QC_PASSED: 'qc_passed',
    QC_FAILED: 'qc_failed',
    REFUND_INITIATED: 'refund_initiated',
    PARTIAL_REFUND: 'partial_refund',
    ZERO_REFUND: 'zero_refund',
    GATEWAY_PROCESSING: 'gateway_processing',
    RETURN_BACK_TO_CUSTOMER: 'return_back_to_customer',
    DISPOSE_OR_LIQUIDATE: 'dispose_liquidate',
    REFUNDED: 'refunded'
};

module.exports = { ORDER_STATUS };
