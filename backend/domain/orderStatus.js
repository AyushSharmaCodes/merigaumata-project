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
    RETURN_REQUESTED: 'return_requested',
    RETURN_APPROVED: 'return_approved',
    PICKUP_SCHEDULED: 'pickup_scheduled',
    PICKUP_ATTEMPTED: 'pickup_attempted',
    PICKUP_COMPLETED: 'pickup_completed',
    PICKUP_FAILED: 'pickup_failed',
    IN_TRANSIT_TO_WAREHOUSE: 'in_transit_to_warehouse',
    PARTIALLY_RETURNED: 'partially_returned',
    RETURNED: 'returned',
    CANCELLED_BY_ADMIN: 'cancelled_by_admin',
    CANCELLED_BY_CUSTOMER: 'cancelled_by_customer'
};

module.exports = { ORDER_STATUS };
