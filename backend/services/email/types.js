/**
 * Email Event Types
 * Centralized enum for all email events in the application
 * 
 * POLICY: Order-related emails are STRICTLY LIMITED to 6 definitive states:
 * 1. ORDER_PLACED (pending) - Customer completes payment
 * 2. ORDER_CONFIRMED (confirmed) - Admin confirms order
 * 3. ORDER_SHIPPED (shipped) - Order is shipped
 * 4. ORDER_DELIVERED (delivered) - Order is delivered
 * 5. ORDER_CANCELLED (cancelled) - Order is cancelled
 * 6. ORDER_RETURNED (returned) - Return is completed
 */
const EmailEventTypes = {
    // User Authentication
    USER_REGISTRATION: 'USER_REGISTRATION',
    EMAIL_CONFIRMATION: 'EMAIL_CONFIRMATION',
    PASSWORD_CHANGED: 'PASSWORD_CHANGED',
    PASSWORD_RESET: 'PASSWORD_RESET',
    PASSWORD_CHANGE_OTP: 'PASSWORD_CHANGE_OTP',

    // Orders - ALLOWED EMAILS (6 states)
    // POLICY: Each status MUST have a unique event type for template resolution
    ORDER_PLACED: 'ORDER_PLACED',
    ORDER_CONFIRMED: 'ORDER_CONFIRMED',
    ORDER_SHIPPED: 'ORDER_SHIPPED',
    ORDER_DELIVERED: 'ORDER_DELIVERED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    ORDER_RETURNED: 'ORDER_RETURNED',

    // Payment & Invoice - DEPRECATED
    PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',       // ✗ DEPRECATED: No longer sent
    GST_INVOICE_GENERATED: 'GST_INVOICE_GENERATED', // ✗ DEPRECATED: Invoice available via download only

    // Returns - DEPRECATED
    RETURN_REQUESTED: 'RETURN_REQUESTED',         // ✗ DEPRECATED: No email on return request
    RETURN_APPROVED: 'RETURN_APPROVED',           // ✗ DEPRECATED: No email on return approval
    RETURN_REJECTED: 'RETURN_REJECTED',           // ✗ DEPRECATED: No email on return rejection

    // Refunds - DEPRECATED
    REFUND_INITIATED: 'REFUND_INITIATED',         // ✗ DEPRECATED: No email on refund initiation
    REFUND_COMPLETED: 'REFUND_COMPLETED',         // ✗ DEPRECATED: No email on refund completion

    // Events
    EVENT_REGISTRATION: 'EVENT_REGISTRATION',
    EVENT_CANCELLATION: 'EVENT_CANCELLATION',
    EVENT_UPDATE: 'EVENT_UPDATE',

    // Donations
    DONATION_RECEIPT: 'DONATION_RECEIPT',

    // Subscriptions
    SUBSCRIPTION_STARTED: 'SUBSCRIPTION_STARTED',
    SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
    SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',

    // Contact
    CONTACT_FORM: 'CONTACT_FORM',

    // Account Management
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    ACCOUNT_DELETION_SCHEDULED: 'ACCOUNT_DELETION_SCHEDULED',
    ACCOUNT_DELETION_OTP: 'ACCOUNT_DELETION_OTP',
    MANAGER_WELCOME: 'MANAGER_WELCOME',

    // OTP (legacy support)
    OTP_VERIFICATION: 'OTP_VERIFICATION'
};

/**
 * Order states that are allowed to trigger customer-facing emails
 * Maps order status to allowed email event types
 */
const ALLOWED_ORDER_EMAIL_STATES = {
    'pending': EmailEventTypes.ORDER_PLACED,
    'confirmed': EmailEventTypes.ORDER_CONFIRMED,
    'shipped': EmailEventTypes.ORDER_SHIPPED,
    'delivered': EmailEventTypes.ORDER_DELIVERED,
    'cancelled': EmailEventTypes.ORDER_CANCELLED,
    'returned': EmailEventTypes.ORDER_RETURNED
};

/**
 * Deprecated email types that should no longer be sent
 */
const DEPRECATED_EMAIL_TYPES = [
    EmailEventTypes.PAYMENT_CONFIRMED,
    EmailEventTypes.GST_INVOICE_GENERATED,
    EmailEventTypes.RETURN_REQUESTED,
    EmailEventTypes.RETURN_APPROVED,
    EmailEventTypes.RETURN_REJECTED,
    EmailEventTypes.REFUND_INITIATED,
    EmailEventTypes.REFUND_COMPLETED
];

module.exports = {
    EmailEventTypes,
    ALLOWED_ORDER_EMAIL_STATES,
    DEPRECATED_EMAIL_TYPES
};
