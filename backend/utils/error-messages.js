/**
 * i18n Compatible Error Keys mapping
 * Keys follow the structure: error.<category>.<code_name>
 */
const AuthMessages = require('../constants/messages/AuthMessages');
const CartMessages = require('../constants/messages/CartMessages');
const CheckoutMessages = require('../constants/messages/CheckoutMessages');
const InventoryMessages = require('../constants/messages/InventoryMessages');
const PaymentMessages = require('../constants/messages/PaymentMessages');
const ProfileMessages = require('../constants/messages/ProfileMessages');
const OrderMessages = require('../constants/messages/OrderMessages');
const ReturnMessages = require('../constants/messages/ReturnMessages');
const SystemMessages = require('../constants/messages/SystemMessages');
const CommonMessages = require('../constants/messages/CommonMessages');

const I18N_MESSAGES = {
    // Auth Errors
    'AUTHENTICATION_REQUIRED': AuthMessages.AUTHENTICATION_REQUIRED,
    'UNAUTHORIZED': AuthMessages.AUTHENTICATION_REQUIRED, // Aligning with auth required
    'FORBIDDEN': AuthMessages.FORBIDDEN,
    'INVALID_PASSWORD': AuthMessages.INVALID_PASSWORD,
    'ACCOUNT_NOT_FOUND': AuthMessages.ACCOUNT_NOT_FOUND,
    'ACCOUNT_BLOCKED': AuthMessages.ACCOUNT_BLOCKED,
    'ACCOUNT_DELETED': AuthMessages.ACCOUNT_DELETED,
    'GOOGLE_AUTH_BLOCKED': AuthMessages.GOOGLE_ONLY_VERIFICATION,
    'REFRESH_TOKEN_REQUIRED': AuthMessages.REFRESH_TOKEN_REQUIRED,
    'EMAIL_ALREADY_EXISTS': AuthMessages.ACCOUNT_ALREADY_EXISTS,
    'ACCOUNT_ALREADY_EXISTS': AuthMessages.ACCOUNT_ALREADY_EXISTS,
    'INVALID_CREDENTIALS': AuthMessages.INVALID_PASSWORD,

    // Auth Success
    'LOGIN_SUCCESS': AuthMessages.LOGIN_SUCCESS,
    'REGISTER_SUCCESS': AuthMessages.REGISTER_SUCCESS,
    'OTP_SENT': AuthMessages.OTP_SENT,
    'EMAIL_VERIFIED': AuthMessages.EMAIL_VERIFIED,
    'PASSWORD_UPDATED': AuthMessages.PASSWORD_UPDATED,
    'LOGOUT_SUCCESS': AuthMessages.LOGOUT_SUCCESS,
    'SESSION_SYNCED': AuthMessages.AUTH_SESSION_SYNCED,
    'TOKEN_REFRESHED': AuthMessages.AUTH_TOKEN_REFRESHED,

    // Order & Returns
    'ORDER_STATUS_UPDATED': OrderMessages.STATUS_UPDATED,
    'ORDER_STATUS_UPDATED_REFUND': OrderMessages.STATUS_UPDATED, // Reuse or specific
    'ORDER_CANCELLED': OrderMessages.CANCELLED,
    'ORDER_CANCELLED_REFUND': OrderMessages.CANCELLED,
    'RETURN_REQUESTED': ReturnMessages.RETURN_REQUESTED,

    // Checkout & Payment Errors
    'PAYMENT_FAILED': PaymentMessages.PAYMENT_FAILED,
    'RAZORPAY_ERROR': PaymentMessages.RAZORPAY_ERROR,
    'INVALID_PAYMENT_SIGNATURE': PaymentMessages.INVALID_SIGNATURE,
    'INVALID_COUPON': CheckoutMessages.INVALID_SESSION, // Fallback or new specific? INVALID_SESSION used for now
    'ORDER_CREATION_FAILED': PaymentMessages.ORDER_CREATION_FAILED,
    'GATEWAY_ERROR': PaymentMessages.GATEWAY_ERROR,
    'REFUND_FAILED_NO_ID': PaymentMessages.REFUND_FAILED_NO_ID,
    'PAYMENT_REFUNDED_FAILURE': PaymentMessages.PAYMENT_REFUNDED_FAILURE,
    'SIGNATURE_INVALID': PaymentMessages.SIGNATURE_INVALID,
    'VERIFICATION_FAILED': PaymentMessages.VERIFICATION_FAILED,
    'ORDER_FAILED_REFUNDED': PaymentMessages.ORDER_FAILED_REFUNDED,
    'EMPTY_CART': CartMessages.EMPTY_CART,
    'BILLING_ADDRESS_NOT_FOUND': CheckoutMessages.BILLING_ADDRESS_NOT_FOUND,
    'SHIPPING_ADDRESS_NOT_FOUND': CheckoutMessages.SHIPPING_ADDRESS_NOT_FOUND,
    'PRODUCT_REQUIRED': CheckoutMessages.PRODUCT_REQUIRED,
    'INVALID_QUANTITY': InventoryMessages.INVALID_QUANTITY,
    'INVALID_SESSION': CheckoutMessages.INVALID_SESSION,
    'PROFILE_INCOMPLETE': ProfileMessages.PROFILE_INCOMPLETE,
    'SYSTEM_ERROR': SystemMessages.INTERNAL_ERROR,
    'ORDER_NUMBER_FAILED': CheckoutMessages.ORDER_NUMBER_FAILED,

    // Inventory & Products
    'INSUFFICIENT_STOCK': InventoryMessages.INSUFFICIENT_STOCK,
    'PRODUCT_NOT_FOUND': InventoryMessages.PRODUCT_NOT_FOUND,

    // General System Errors
    'INTERNAL_ERROR': SystemMessages.INTERNAL_ERROR,
    'DATABASE_ERROR': SystemMessages.DATABASE_ERROR,
    'VALIDATION_ERROR': SystemMessages.VALIDATION_ERROR,

    // Profile
    'PROFILE_UPDATED': ProfileMessages.UPDATED,
    'AVATAR_UPLOADED': ProfileMessages.AVATAR_UPLOADED,
    'AVATAR_DELETED': ProfileMessages.AVATAR_DELETED,
    'PROFILE_NOT_FOUND': ProfileMessages.NOT_FOUND,
    'FIRST_NAME_REQUIRED': ProfileMessages.FIRST_NAME_REQUIRED,
    'INVALID_GENDER': ProfileMessages.INVALID_GENDER,
    'INVALID_PHONE': ProfileMessages.INVALID_PHONE,
    'NO_IMAGE': ProfileMessages.NO_IMAGE,
    'NO_AVATAR_TO_DELETE': ProfileMessages.NO_AVATAR_TO_DELETE,
    // 'PROFILE_INCOMPLETE' is mapped above

    // Fallback
    'GENERIC_ERROR': SystemMessages.GENERIC_ERROR
};

/**
 * Technical patterns to exclude or translate
 */
const TECHNICAL_PATTERNS = [
    /column ".*" does not exist/i,
    /relation ".*" does not exist/i,
    /violates foreign key constraint/i,
    /violates not-null constraint/i,
    /syntax error at or near/i,
    /null reference/i,
    /undefined reference/i,
    /stack trace/i,
    /razorpay_.*_id/i,
    /gst_rate_.*_error/i,
    /supabase/i,
    /postgresql/i,
    /error code: \d+/i,
    /unexpected token/i,
    /failed to fetch/i,
    /axios/i,
    /fetch/i,
    /internal server error/i,
    /read property/i,
    /is not a function/i,
    /cannot read/i,
    /property of null/i,
    /property of undefined/i,
    /invalid input/i
];

/**
 * Translates an error or message into a user-friendly key
 * @param {Error|string} err 
 * @param {number} statusCode 
 * @returns {string}
 */
const getFriendlyMessage = (err, statusCode) => {
    const message = typeof err === 'string' ? err : (err.message || '');
    const code = err.code || '';

    // If it's a known error key already, return it
    if (Object.values(I18N_MESSAGES).includes(message)) {
        return message;
    }

    // Map by code
    if (I18N_MESSAGES[code]) return I18N_MESSAGES[code];

    // If it looks like a valid translation key already, let it pass through
    const messageLower = message.toLowerCase();
    const isTranslatable = 
        messageLower.startsWith('errors.') || 
        messageLower.startsWith('success.') || 
        messageLower.startsWith('validation.') || 
        messageLower.startsWith('common.');

    if (isTranslatable) return message;

    // Check for technical leakage
    const isTechnical = TECHNICAL_PATTERNS.some(pattern => pattern.test(message));

    // Status code fallbacks
    if (statusCode === 401) return I18N_MESSAGES.AUTHENTICATION_REQUIRED;
    if (statusCode === 403) return I18N_MESSAGES.FORBIDDEN;
    if (statusCode === 404) return I18N_MESSAGES.PRODUCT_NOT_FOUND;

    if (statusCode >= 400 && statusCode < 500) {
        if (!isTechnical && message) return message;
        return I18N_MESSAGES.GENERIC_ERROR;
    }

    if (statusCode >= 500) {
        // If it's technical OR empty, return generic
        if (isTechnical || !message) return I18N_MESSAGES.INTERNAL_ERROR;
        
        // If it's already a known key (checked via Object.values above), it will have returned already
        // If it's a specific custom error (like "Calculation Failed"), return it
        return message;
    }

    return !isTechnical && message ? message : I18N_MESSAGES.GENERIC_ERROR;
};

/**
 * Get i18n key for a literal name
 * @param {string} keyName 
 * @returns {string}
 */
const getI18nKey = (keyName) => {
    return I18N_MESSAGES[keyName] || keyName;
};

module.exports = {
    I18N_MESSAGES,
    getFriendlyMessage,
    getI18nKey
};
