/**
 * SES Template Name Map
 * Maps EmailEventType → SES template name
 *
 * Naming Convention: mgm_{category}_{action}
 *   - mgm        = MeriGauMata prefix
 *   - category   = auth | registration | order | event | donation | subscription | contact | account | manager
 *   - action     = descriptive action (e.g. welcome, otp, placed, confirmed)
 *
 * All SES templates are English-only.
 */

const { EmailEventTypes } = require('./types');

const SES_TEMPLATE_MAP = {
    // Registration
    [EmailEventTypes.USER_REGISTRATION]:        'mgm_registration_welcome',
    [EmailEventTypes.EMAIL_CONFIRMATION]:        'mgm_registration_confirmation',

    // Authentication
    [EmailEventTypes.OTP_VERIFICATION]:          'mgm_auth_otp',
    [EmailEventTypes.PASSWORD_CHANGE_OTP]:       'mgm_auth_password_change_otp',
    [EmailEventTypes.PASSWORD_RESET]:            'mgm_auth_password_reset',

    // Orders
    [EmailEventTypes.ORDER_PLACED]:              'mgm_order_placed',
    [EmailEventTypes.ORDER_CONFIRMED]:           'mgm_order_confirmed',
    [EmailEventTypes.ORDER_SHIPPED]:             'mgm_order_shipped',
    [EmailEventTypes.ORDER_DELIVERED]:            'mgm_order_delivered',
    [EmailEventTypes.ORDER_CANCELLED]:           'mgm_order_cancelled',
    [EmailEventTypes.ORDER_RETURNED]:            'mgm_order_returned',

    // Events
    [EmailEventTypes.EVENT_REGISTRATION]:        'mgm_event_registration',
    [EmailEventTypes.EVENT_CANCELLATION]:         'mgm_event_cancellation',
    [EmailEventTypes.EVENT_UPDATE]:              'mgm_event_update',

    // Donations
    [EmailEventTypes.DONATION_RECEIPT]:          'mgm_donation_receipt',

    // Subscriptions
    [EmailEventTypes.SUBSCRIPTION_STARTED]:      'mgm_subscription_confirmation',
    [EmailEventTypes.SUBSCRIPTION_CANCELLED]:    'mgm_subscription_cancellation',

    // Contact
    [EmailEventTypes.CONTACT_FORM]:              'mgm_contact_form',
    [EmailEventTypes.CONTACT_NOTIFICATION]:      'mgm_contact_form',
    [EmailEventTypes.CONTACT_AUTO_REPLY]:         'mgm_contact_auto_reply',

    // Account Management
    [EmailEventTypes.ACCOUNT_DELETED]:           'mgm_account_deleted',
    [EmailEventTypes.ACCOUNT_DELETION_SCHEDULED]:'mgm_account_deletion_scheduled',
    [EmailEventTypes.ACCOUNT_DELETION_OTP]:      'mgm_account_deletion_otp',

    // Manager
    [EmailEventTypes.MANAGER_WELCOME]:           'mgm_manager_welcome',
};

/**
 * Get the SES template name for an event type
 * @param {string} eventType - EmailEventTypes value
 * @returns {string|null} SES template name or null if not mapped
 */
function getSesTemplateName(eventType) {
    return SES_TEMPLATE_MAP[eventType] || null;
}

/**
 * Get all registered SES template names (for deploy script)
 * @returns {string[]}
 */
function getAllTemplateNames() {
    return [...new Set(Object.values(SES_TEMPLATE_MAP))];
}

module.exports = {
    SES_TEMPLATE_MAP,
    getSesTemplateName,
    getAllTemplateNames
};
