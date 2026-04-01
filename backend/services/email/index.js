/**
 * Email Service
 * Provider-agnostic email service with template support
 * 
 * Usage:
 *   const emailService = require('./services/email');
 *   await emailService.send(EmailEventTypes.USER_REGISTRATION, 'user@email.com', { name: 'John' });
 */

const supabase = require('../../config/supabase');
const { EmailEventTypes, DEPRECATED_EMAIL_TYPES } = require('./types');
const logger = require('../../utils/logger');
const emailConfig = require('../../config/email.config');
const { LOGS } = require('../../constants/messages');

// Providers
const ConsoleProvider = require('./providers/console.provider');
const SesProvider = require('./providers/ses.provider');
const SmtpProvider = require('./providers/smtp.provider');

// Templates
const { getRegistrationEmail, getEmailConfirmationEmail } = require('./templates/registration.template');
const { getOrderPlacedEmail, getOrderConfirmedEmail, getOrderShippedEmail, getOrderDeliveredEmail, getOrderCancellationEmail, getOrderReturnedEmail } = require('./templates/order.template');
const { getEventRegistrationEmail, getEventCancellationEmail, getEventUpdateEmail } = require('./templates/event.template');
const { getDonationReceiptEmail, getSubscriptionConfirmationEmail, getSubscriptionCancellationEmail } = require('./templates/donation.template');
const { getContactFormEmail, getContactAutoReplyEmail } = require('./templates/contact.template');
const { getAccountDeletedEmail, getAccountDeletionScheduledEmail, getAccountDeletionOTPEmail } = require('./templates/account.template');
const { getOTPEmail, getPasswordChangeOTPEmail, getPasswordResetEmail } = require('./templates/auth.template');
const { getManagerWelcomeEmail } = require('./templates/manager.template');
// DEPRECATED Templates - Kept for backward compatibility but will not send emails
// const { getGSTInvoiceEmail } = require('./templates/gst-invoice.template');
// const { getRefundInitiatedEmail, getRefundCompletedEmail } = require('./templates/refund-status.template');
// const { getReturnRequestedEmail, getReturnApprovedEmail, getReturnRejectedEmail } = require('./templates/return-status.template');

class EmailService {
    constructor() {
        this.provider = this._initializeProvider();
        logger.info({ provider: this.provider.name }, LOGS.EMAIL_SERVICE_INIT);
    }

    _shouldUseSesManagedTemplates() {
        return this.provider?.name === 'ses' && emailConfig.ses.useManagedTemplates === true;
    }

    /**
     * Initialize the email provider based on environment configuration
     */
    _initializeProvider() {
        const providerName = emailConfig.getActiveProvider();

        // Validate configuration at startup
        emailConfig.validateActiveProvider();

        switch (providerName) {
            case 'ses':
                const sesProvider = new SesProvider();
                if (sesProvider.isConfigured()) {
                    return sesProvider;
                }
                logger.warn(LOGS.EMAIL_PROVIDER_FALLBACK);
                return new ConsoleProvider();

            case 'smtp':
                const smtpProvider = new SmtpProvider();
                if (smtpProvider.isConfigured()) {
                    return smtpProvider;
                }
                logger.warn(LOGS.EMAIL_SMTP_FALLBACK);
                return new ConsoleProvider();

            case 'console':
            default:
                return new ConsoleProvider();
        }
    }

    /**
     * Get email template by event type
     */
    _getTemplate(eventType, data) {
        const templateData = { ...data };

        switch (eventType) {
            case EmailEventTypes.USER_REGISTRATION:
                return getRegistrationEmail(templateData);

            case EmailEventTypes.ORDER_PLACED:
                return getOrderPlacedEmail(templateData);

            case EmailEventTypes.ORDER_CONFIRMED:
                return getOrderConfirmedEmail(templateData);

            case EmailEventTypes.ORDER_SHIPPED:
                return getOrderShippedEmail(templateData);

            case EmailEventTypes.ORDER_DELIVERED:
                return getOrderDeliveredEmail(templateData);

            case EmailEventTypes.ORDER_RETURNED:
                return getOrderReturnedEmail(templateData);

            case EmailEventTypes.ORDER_CANCELLED:
                return getOrderCancellationEmail(templateData);

            case EmailEventTypes.EVENT_REGISTRATION:
                return getEventRegistrationEmail(templateData);

            case EmailEventTypes.EVENT_CANCELLATION:
                return getEventCancellationEmail(templateData);

            case EmailEventTypes.EVENT_UPDATE:
                return getEventUpdateEmail(templateData);

            case EmailEventTypes.DONATION_RECEIPT:
                return getDonationReceiptEmail(templateData);

            case EmailEventTypes.SUBSCRIPTION_STARTED:
                return getSubscriptionConfirmationEmail(templateData);

            case EmailEventTypes.SUBSCRIPTION_CANCELLED:
                return getSubscriptionCancellationEmail(templateData);

            case EmailEventTypes.CONTACT_FORM:
            case EmailEventTypes.CONTACT_NOTIFICATION:
                return getContactFormEmail(templateData);

            case EmailEventTypes.CONTACT_AUTO_REPLY:
                return getContactAutoReplyEmail(templateData);

            case EmailEventTypes.EMAIL_CONFIRMATION:
                return getEmailConfirmationEmail(templateData);

            case EmailEventTypes.ACCOUNT_DELETED:
                return getAccountDeletedEmail(templateData);

            case EmailEventTypes.ACCOUNT_DELETION_SCHEDULED:
                return getAccountDeletionScheduledEmail(templateData);

            case EmailEventTypes.ACCOUNT_DELETION_OTP:
                return getAccountDeletionOTPEmail(templateData);

            case EmailEventTypes.OTP_VERIFICATION:
                return getOTPEmail(templateData);

            case EmailEventTypes.PASSWORD_RESET:
                return getPasswordResetEmail(templateData);

            case EmailEventTypes.PASSWORD_CHANGE_OTP:
                return getPasswordChangeOTPEmail(templateData);

            case EmailEventTypes.MANAGER_WELCOME:
                return getManagerWelcomeEmail(templateData);

            // DEPRECATED - These email types are no longer sent
            case EmailEventTypes.GST_INVOICE_GENERATED:
            case EmailEventTypes.REFUND_INITIATED:
            case EmailEventTypes.REFUND_COMPLETED:
            case EmailEventTypes.RETURN_REQUESTED:
            case EmailEventTypes.RETURN_APPROVED:
            case EmailEventTypes.RETURN_REJECTED:
            case EmailEventTypes.PAYMENT_CONFIRMED:
                throw new Error(LOGS.EMAIL_DEPRECATED_ERROR);

            default:
                throw new Error(LOGS.EMAIL_UNKNOWN_TYPE);
        }
    }

    /**
     * Create email log entry (PENDING)
     */
    async _createLog({ to, eventType, subject, html, userId, referenceId, metadata }) {
        try {
            // Map unique internal types to existing DB enum values to avoid constraint errors
            const dbTypeMap = {
                'ORDER_PLACED': 'ORDER_CONFIRMATION',
                'ORDER_CONFIRMED': 'ORDER_STATUS_UPDATE',
                'ORDER_CANCELLED': 'ORDER_STATUS_UPDATE',
                'ORDER_RETURNED': 'ORDER_STATUS_UPDATE'
            };
            const dbEventType = dbTypeMap[eventType] || eventType;

            // Try RPC first (bypasses RLS if configured)
            const { data: logId, error } = await supabase.rpc('log_email_notification', {
                p_email_type: dbEventType,
                p_recipient_email: to,
                p_subject: subject,
                p_html_preview: html ? html.substring(0, 500) : '',
                p_user_id: userId,
                p_reference_id: referenceId,
                p_metadata: { ...metadata, internal_type: eventType, template_data: metadata.template_data }
            });

            if (!error && logId) return logId;

            // Fallback to direct insert if RPC fails (e.g. not found)
            if (error && error.code === '42883') {
                const dbTypeMap = {
                    'ORDER_PLACED': 'ORDER_CONFIRMATION',
                    'ORDER_CONFIRMED': 'ORDER_STATUS_UPDATE',
                    'ORDER_CANCELLED': 'ORDER_STATUS_UPDATE',
                    'ORDER_RETURNED': 'ORDER_STATUS_UPDATE'
                };
                const dbEventType = dbTypeMap[eventType] || eventType;

                logger.warn(LOGS.EMAIL_RPC_FALLBACK);
                const { data } = await supabase.from('email_notifications').insert([{
                    user_id: userId,
                    email_type: dbEventType,
                    recipient_email: to,
                    reference_id: referenceId,
                    status: 'PENDING',
                    metadata: { 
                        ...metadata, 
                        subject, 
                        internal_type: eventType, 
                        html_preview: html ? html.substring(0, 500) : '',
                        template_data: metadata.template_data
                    }
                }]).select('id').single();
                return data?.id;
            }

            if (error) {
                logger.error({ err: error }, LOGS.EMAIL_RPC_LOG_FAIL);
            }
            return null;
        } catch (err) {
            logger.error({ err: err.message }, LOGS.EMAIL_LOG_FAIL);
            return null;
        }
    }

    /**
     * Update log status
     */
    async _updateLog(logId, updates) {
        if (!logId) return;
        try {
            const { data: existing } = await supabase
                .from('email_notifications')
                .select('metadata, user_id')
                .eq('id', logId)
                .maybeSingle();

            const payload = {
                ...updates,
                metadata: {
                    ...(existing?.metadata || {}),
                    ...(updates.metadata || {})
                },
                updated_at: new Date().toISOString()
            };

            // Backfill user_id if provided and currently missing
            if (updates.user_id && !existing?.user_id) {
                payload.user_id = updates.user_id;
            }

            await supabase.from('email_notifications').update(payload).eq('id', logId);
        } catch (err) {
            logger.error({ err: err.message, logId }, LOGS.EMAIL_LOG_UPDATE_FAIL);
        }
    }

    /**
     * Send an email
     * @param {string} eventType - EmailEventTypes enum value
     * @param {string} to - Recipient email address
     * @param {Object} data - Template data
     * @param {Object} options - Additional options (userId, referenceId, lang)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async send(eventType, to, data, options = {}) {
        let { userId = null, referenceId = null, lang = 'en', existingLogId = null } = options;
        let logId = null;

        // If no lang provided, try to detect from user profile
        if (!options.lang && userId) {
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('preferred_language')
                    .eq('id', userId)
                    .single();
                if (profile?.preferred_language) {
                    lang = profile.preferred_language;
                }
            } catch (err) {
                logger.warn({ err: err.message, userId }, LOGS.EMAIL_USER_LANG_FAIL);
            }
        }

        // POLICY ENFORCEMENT: Block deprecated email types
        if (DEPRECATED_EMAIL_TYPES.includes(eventType)) {
            logger.warn({
                eventType,
                to,
                userId,
                referenceId
            }, LOGS.EMAIL_BLOCKED_DEPRECATED);

            return {
                success: false,
                error: LOGS.EMAIL_DEPRECATED_ERROR,
                blocked: true
            };
        }

        logger.info({ eventType, to, userId, lang, hasData: !!data }, LOGS.EMAIL_SEND_TRIGGERED);

        try {
            // Get template
            const templateResult = this._getTemplate(eventType, { ...data, lang });
            const { subject, html } = templateResult;
            logger.info({ eventType, to, subject }, LOGS.EMAIL_TEMPLATE_SUCCESS);

            // 1. Create or reuse the email log entry.
            if (existingLogId) {
                logId = existingLogId;
                await this._updateLog(logId, {
                    status: 'PENDING',
                    sent_at: null,
                    error_message: null,
                    user_id: userId,
                    metadata: {
                        provider: this.provider.name,
                        subject,
                        html_preview: html ? html.substring(0, 500) : '',
                        internal_type: eventType,
                        template_data: data
                    }
                });
            } else {
                logId = await this._createLog({
                    to,
                    eventType,
                    subject,
                    html,
                    userId,
                    referenceId,
                    metadata: {
                        provider: this.provider.name,
                        template_data: data // Save original template data for retries
                    }
                });
            }

            logger.info({
                eventType,
                to,
                referenceId,
                subject,
                provider: this.provider.name,
                logId
            }, LOGS.EMAIL_SENDING);

            // 2. Send via provider
            let result;
            let deliveryMetadata = {
                provider: this.provider.name
            };
            if (this.provider.name === 'ses') {
                const { getSesTemplateName } = require('./ses-template-map');
                const { buildSesTemplateData } = require('./ses-template-data');
                const templateName = getSesTemplateName(eventType);
                
                if (this._shouldUseSesManagedTemplates() && templateName) {
                    const { templateData, missingFields } = buildSesTemplateData(eventType, data);

                    if (missingFields.length > 0) {
                        logger.warn({
                            eventType,
                            to,
                            templateName,
                            missingFields
                        }, 'SES template data incomplete, falling back to raw HTML email');

                        deliveryMetadata = {
                            ...deliveryMetadata,
                            templateName,
                            deliveryMode: 'raw_fallback',
                            sesTemplateFallbackReason: 'missing_template_fields',
                            sesTemplateMissingFields: missingFields
                        };

                        result = await this.provider.send({
                            to,
                            subject,
                            html,
                            metadata: { eventType }
                        });
                    } else {
                        result = await this.provider.sendTemplated({
                            to,
                            templateName,
                            templateData,
                            metadata: { eventType }
                        });

                        deliveryMetadata = {
                            ...deliveryMetadata,
                            templateName,
                            deliveryMode: result.success ? 'ses_template' : 'ses_template_failed',
                            sesTemplateDataKeys: Object.keys(templateData),
                            sesManagedTemplatesEnabled: true
                        };

                        if (!result.success) {
                            logger.warn({
                                eventType,
                                to,
                                templateName,
                                error: result.error
                            }, 'SES template send failed, retrying with raw HTML fallback');

                            const fallbackResult = await this.provider.send({
                                to,
                                subject,
                                html,
                                metadata: { eventType }
                            });

                            deliveryMetadata = {
                                ...deliveryMetadata,
                                deliveryMode: fallbackResult.success ? 'raw_fallback' : 'raw_fallback_failed',
                                sesTemplateFallbackReason: 'templated_send_failed',
                                sesTemplateFallbackError: result.error
                            };

                            result = fallbackResult.success ? fallbackResult : result;
                        }
                    }
                } else {
                    deliveryMetadata = {
                        ...deliveryMetadata,
                        sesManagedTemplatesEnabled: this._shouldUseSesManagedTemplates()
                    };

                    if (this._shouldUseSesManagedTemplates() && !templateName) {
                        logger.warn({ eventType }, 'No SES template mapped, falling back to raw HTML');
                    }

                    deliveryMetadata = {
                        ...deliveryMetadata,
                        deliveryMode: this._shouldUseSesManagedTemplates()
                            ? 'raw_no_template_mapping'
                            : 'raw_custom_template_default'
                    };
                    result = await this.provider.send({ to, subject, html, metadata: { eventType } });
                }
            } else {
                result = await this.provider.send({
                    to,
                    subject,
                    html,
                    metadata: { eventType }
                });
            }

            // 3. Update Log
            if (logId) {
                await this._updateLog(logId, {
                    status: result.success ? 'SENT' : 'FAILED',
                    sent_at: result.success ? new Date().toISOString() : null,
                    error_message: result.error || null,
                    metadata: {
                        ...deliveryMetadata,
                        messageId: result.messageId,
                        requestId: result.requestId,
                        subject
                    }
                });
            }

            if (!result.success) {
                logger.error({
                    eventType,
                    to,
                    subject,
                    error: result.error,
                    provider: this.provider.name
                }, LOGS.EMAIL_SEND_FAILED);
            } else {
                logger.info({
                    eventType,
                    to,
                    subject,
                    messageId: result.messageId,
                    provider: this.provider.name
                }, LOGS.EMAIL_SEND_SUCCESS);
            }

            return result;

        } catch (error) {
            logger.error({
                eventType,
                to,
                err: error.message,
                provider: this.provider.name
            }, LOGS.EMAIL_SEND_ERROR);

            // Update log failure
            if (logId) {
                await this._updateLog(logId, {
                    status: 'FAILED',
                    error_message: error.message
                });
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send registration/welcome email
     */
    async sendRegistrationEmail(to, { name, email }, options = {}) {
        return this.send(EmailEventTypes.USER_REGISTRATION, to, { name, email }, options);
    }

    /**
     * Send order placed email (Pending)
     */
    async sendOrderPlacedEmail(to, { order, customerName, receiptUrl, paymentId }, options = {}) {
        const userId = typeof options === 'string' ? options : options.userId;
        const lang = typeof options === 'string' ? null : options.lang;
        return this.send(EmailEventTypes.ORDER_PLACED, to, { order, customerName, receiptUrl, paymentId }, { userId, lang, referenceId: order.id });
    }

    /**
     * Send order confirmed email
     */
    async sendOrderConfirmedEmail(to, { order, customerName }, options = {}) {
        const userId = typeof options === 'string' ? options : options.userId;
        const lang = typeof options === 'string' ? null : options.lang;
        return this.send(EmailEventTypes.ORDER_CONFIRMED, to, { order, customerName }, { userId, lang, referenceId: order.id });
    }

    /**
     * Send order shipped email
     */
    async sendOrderShippedEmail(to, { order, customerName }, options = {}) {
        const userId = typeof options === 'string' ? options : options.userId;
        const lang = typeof options === 'string' ? null : options.lang;
        return this.send(EmailEventTypes.ORDER_SHIPPED, to, { order, customerName }, { userId, lang, referenceId: order.id });
    }

    /**
     * Send order delivered email
     */
    async sendOrderDeliveredEmail(to, { order, customerName, invoiceUrl }, options = {}) {
        const userId = typeof options === 'string' ? options : options.userId;
        const lang = typeof options === 'string' ? null : options.lang;
        return this.send(EmailEventTypes.ORDER_DELIVERED, to, { order, customerName, invoiceUrl }, { userId, lang, referenceId: order.id });
    }

    /**
     * Send order returned email
     */
    async sendOrderReturnedEmail(to, { order, customerName }, options = {}) {
        const userId = typeof options === 'string' ? options : options.userId;
        const lang = typeof options === 'string' ? null : options.lang;
        return this.send(EmailEventTypes.ORDER_RETURNED, to, { order, customerName }, { userId, lang, referenceId: order.id });
    }

    /**
     * Send order cancellation email
     */
    async sendOrderCancellationEmail(to, { order, customerName, refundAmount }, options = {}) {
        const userId = typeof options === 'string' ? options : options.userId;
        const lang = typeof options === 'string' ? null : options.lang;
        return this.send(EmailEventTypes.ORDER_CANCELLED, to, { order, customerName, refundAmount }, { userId, lang, referenceId: order.id });
    }

    /**
     * Send event registration email
     */
    async sendEventRegistrationEmail(to, { event, registration, attendeeName, isPaid = false, paymentDetails = null }, userId = null) {
        return this.send(EmailEventTypes.EVENT_REGISTRATION, to, { event, registration, attendeeName, isPaid, paymentDetails }, { userId, referenceId: registration.id });
    }

    /**
     * Send event cancellation email
     */
    async sendEventCancellationEmail(to, { event, registration, attendeeName, refundDetails = null }, userId = null) {
        return this.send(EmailEventTypes.EVENT_CANCELLATION, to, { event, registration, attendeeName, refundDetails }, { userId, referenceId: registration.id });
    }

    /**
     * Send event schedule update email
     */
    async sendEventUpdateEmail(to, { event, attendeeName }, options = {}) {
        return this.send(EmailEventTypes.EVENT_UPDATE, to, { event, attendeeName }, { ...options, referenceId: event.id });
    }

    /**
     * Send donation receipt email
     */
    async sendDonationReceiptEmail(to, { donation, donorName, isAnonymous = false }, options = {}) {
        return this.send(EmailEventTypes.DONATION_RECEIPT, to, { donation, donorName, isAnonymous }, { ...options, referenceId: donation.id });
    }

    /**
     * Send contact form notification to admin
     */
    async sendContactFormEmail(adminEmail, { name, email, phone, subject, message }, options = {}) {
        return this.send(EmailEventTypes.CONTACT_NOTIFICATION, adminEmail, { name, email, phone, subject, message }, options);
    }

    /**
     * Alias for sendContactFormEmail (legacy support)
     */
    async sendContactNotification(messageData, options = {}) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@merigaumata.com';
        return this.sendContactFormEmail(adminEmail, messageData, options);
    }

    /**
     * Send auto-reply to user who filled contact form
     */
    async sendContactAutoReply(to, name, lang = 'en') {
        const firstName = name ? name.split(' ')[0] : 'there';
        return this.send(EmailEventTypes.CONTACT_AUTO_REPLY, to, { name: firstName }, { lang });
    }

    /**
     * Send email confirmation with verification link
     */
    async sendEmailConfirmation(to, { name, email, verificationLink }, options = {}) {
        return this.send(EmailEventTypes.EMAIL_CONFIRMATION, to, { name, email, verificationLink }, options);
    }

    /**
     * Send subscription/monthly donation confirmation email
     */
    async sendSubscriptionConfirmationEmail(to, { subscription, donorName, isAnonymous = false }, options = {}) {
        return this.send(EmailEventTypes.SUBSCRIPTION_STARTED, to, { subscription, donorName, isAnonymous }, { ...options, referenceId: subscription.donationRef });
    }

    /**
     * Send subscription cancellation email
     */
    async sendSubscriptionCancellationEmail(to, { subscription, donorName }, options = {}) {
        return this.send(EmailEventTypes.SUBSCRIPTION_CANCELLED, to, { subscription, donorName }, { ...options, referenceId: subscription.donationRef });
    }

    /**
     * Send account deletion confirmation email
     */
    async sendAccountDeletedEmail(to, { name }, options = {}) {
        return this.send(EmailEventTypes.ACCOUNT_DELETED, to, { name }, options);
    }

    /**
     * Send account deletion scheduled email
     */
    async sendAccountDeletionScheduledEmail(to, { name, scheduledDate }, options = {}) {
        return this.send(EmailEventTypes.ACCOUNT_DELETION_SCHEDULED, to, { name, scheduledDate }, options);
    }

    /**
     * Send account deletion OTP email
     */
    async sendAccountDeletionOTPEmail(to, otp, expiryMinutes, lang = 'en') {
        return this.send(EmailEventTypes.ACCOUNT_DELETION_OTP, to, { otp, expiryMinutes }, { lang });
    }

    /**
     * Send OTP email
     */
    async sendOTPEmail(to, otp, expiryMinutes, lang = 'en') {
        return this.send(EmailEventTypes.OTP_VERIFICATION, to, { otp, expiryMinutes }, { lang });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(to, resetLink, lang = 'en') {
        return this.send(EmailEventTypes.PASSWORD_RESET, to, { resetLink }, { lang });
    }

    /**
     * Send password change OTP email
     */
    async sendPasswordChangeOTPEmail(to, otp, expiryMinutes, lang = 'en') {
        return this.send(EmailEventTypes.PASSWORD_CHANGE_OTP, to, { otp, expiryMinutes }, { lang });
    }

    /**
     * Send manager welcome email with temporary password
     */
    async sendManagerWelcomeEmail(to, name, password, lang = 'en') {
        return this.send(EmailEventTypes.MANAGER_WELCOME, to, { name, email: to, password }, { lang });
    }

    close() {
        if (this.provider && typeof this.provider.close === 'function') {
            this.provider.close();
        }
    }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;
module.exports.EmailService = EmailService;
module.exports.EmailEventTypes = EmailEventTypes;
