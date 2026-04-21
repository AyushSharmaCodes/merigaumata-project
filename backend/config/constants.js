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

/**
 * Unified Payment Status Constants
 * 
 * State Machine:
 *   CREATED → PENDING → SUCCESS → REFUNDED / PARTIALLY_REFUNDED
 *                ↓
 *              FAILED
 *   CREATED → EXPIRED (timeout)
 *   PENDING → EXPIRED (timeout)
 * 
 * RULE: Only webhooks may set SUCCESS. Verify endpoints set PENDING only.
 */
const PAYMENT_STATUS = {
    // Core lifecycle states
    CREATED: 'CREATED',                       // Order/registration created, payment not yet attempted
    PENDING: 'PENDING',                       // Payment initiated, awaiting webhook confirmation
    SUCCESS: 'SUCCESS',                       // ✅ ONLY set by webhook on payment.captured
    FAILED: 'FAILED',                         // Set by webhook on payment.failed, or by timeout sweep
    EXPIRED: 'EXPIRED',                       // Set by sweep cron when CREATED/PENDING exceeds timeout
    // Refund states
    REFUNDED: 'REFUNDED',                     // Full refund processed
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED', // Partial refund processed
    // Internal / transitional
    AUTHORIZED: 'AUTHORIZED',                // Razorpay authorized but not yet captured
    CAPTURED_ORPHAN: 'CAPTURED_ORPHAN',       // Payment captured but no order/registration linked
};

/**
 * Per-module sweep timeouts (minutes).
 * After this duration, CREATED/PENDING payments are polled against Razorpay.
 */
const PAYMENT_SWEEP_TIMEOUTS = {
    ECOMMERCE: 15,        // Orders: 15 minutes
    EVENT: 10,            // Events: 10 minutes (seat locking urgency)
    DONATION: 30,         // Donations: 30 minutes (no urgency)
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
    PAYMENT_SWEEP_TIMEOUTS,
    INVOICE_STATUS,
    RAZORPAY_STATUS,
    SUBSCRIPTION_STATUS,
    TABLE_NAMES,
    ORDER_INVOICE_STATUS,
};
