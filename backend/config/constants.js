/**
 * Application-wide constants to avoid magic strings
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
    PICKED_UP: 'picked_up',
    IN_TRANSIT_TO_WAREHOUSE: 'in_transit_to_warehouse',
    PARTIALLY_RETURNED: 'partially_returned',
    RETURNED: 'returned',
    CANCELLED_BY_ADMIN: 'cancelled_by_admin',
    CANCELLED_BY_CUSTOMER: 'cancelled_by_customer'
};

const PAYMENT_STATUS = {
    CREATED: 'created',
    AUTHORIZED: 'authorized',
    CAPTURED: 'captured',
    PAID: 'paid',
    FAILED: 'failed',
    PENDING: 'pending',
    REFUNDED: 'refunded',
    SUCCESS: 'success',
    PROCESSED: 'processed',
    PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    REFUND_COMPLETED: 'REFUND_COMPLETED',
    REFUND_PARTIAL: 'REFUND_PARTIAL',
};

const INVOICE_STATUS = {
    PENDING: 'PENDING',
    GENERATED: 'GENERATED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
};

const RAZORPAY_STATUS = {
    CAPTURED: 'captured',
    FAILED: 'failed',
    AUTHORIZED: 'authorized',
    DRAFT: 'draft',
    ISSUED: 'issued',
    PROCESSED: 'processed',
};

const SUBSCRIPTION_STATUS = {
    CANCELLED: 'cancelled',
    HALTED: 'halted',
    PAUSED: 'paused',
    ACTIVE: 'active',
};

const TABLE_NAMES = {
    ORDERS: 'orders',
    DONATION_SUBSCRIPTIONS: 'donation_subscriptions',
    ACCOUNT_DELETION_JOBS: 'account_deletion_jobs',
    EVENT_CANCELLATION_JOBS: 'event_cancellation_jobs',
    DELETION_AUTHORIZATION_TOKENS: 'deletion_authorization_tokens',
};

const ORDER_INVOICE_STATUS = {
    PENDING: 'pending',
    GENERATED: 'generated',
    RECEIPT_GENERATED: 'receipt_generated',
    FAILED: 'failed',
    PENDING_GENERATION: 'pending_generation',
};

module.exports = {
    ORDER_STATUS,
    PAYMENT_STATUS,
    INVOICE_STATUS,
    RAZORPAY_STATUS,
    SUBSCRIPTION_STATUS,
    TABLE_NAMES,
    ORDER_INVOICE_STATUS,
};
