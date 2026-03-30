/**
 * Amazon SES Email Provider
 * Uses the AWS SES v2 API for transactional email delivery.
 */
const { SESv2Client, SendEmailCommand, SendTemplatedEmailCommand } = require('@aws-sdk/client-sesv2');
const BaseEmailProvider = require('./base.provider');
const logger = require('../../../utils/logger');
const emailConfig = require('../../../config/email.config');

class SesProvider extends BaseEmailProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'ses';
        this.sesConfig = emailConfig.ses;
        this.client = null;

        if (this.isConfigured()) {
            this._initializeClient();
        }
    }

    _initializeClient() {
        try {
            const clientOptions = this.sesConfig.getClientOptions();
            this.client = new SESv2Client(clientOptions);

            logger.info({
                region: this.sesConfig.region,
                fromEmail: this.sesConfig.from.email,
                fromName: this.sesConfig.from.name,
                credentialsConfigured: this.sesConfig.hasStaticCredentials()
            }, 'SES client initialized');
        } catch (error) {
            logger.error({ err: error.message }, 'Failed to initialize SES client');
            this.client = null;
        }
    }

    async verifyConnection() {
        return this.isConfigured();
    }

    async send({ to, subject, html, text }) {
        if (!this.isConfigured()) {
            logger.error('SES not configured');
            return {
                success: false,
                error: 'SES not configured. Please check AWS_SES_REGION and sender configuration.'
            };
        }

        if (!this.client) {
            this._initializeClient();
            if (!this.client) {
                return {
                    success: false,
                    error: 'Failed to initialize SES client'
                };
            }
        }

        try {
            const command = new SendEmailCommand({
                FromEmailAddress: this.sesConfig.from.email,
                Destination: {
                    ToAddresses: [to]
                },
                Content: {
                    Simple: {
                        Subject: {
                            Data: subject,
                            Charset: 'UTF-8'
                        },
                        Body: {
                            Html: {
                                Data: html,
                                Charset: 'UTF-8'
                            },
                            Text: {
                                Data: text || this.stripHtml(html),
                                Charset: 'UTF-8'
                            }
                        }
                    }
                },
                EmailTags: [
                    { Name: 'provider', Value: 'ses' },
                    { Name: 'app', Value: process.env.APP_NAME || 'app' }
                ],
                ReplyToAddresses: this.sesConfig.replyTo ? [this.sesConfig.replyTo] : undefined
            });

            const response = await this.client.send(command);
            const messageId = response.MessageId || `ses-${Date.now()}`;

            logger.info({ messageId, to, subject }, 'Email sent via SES');

            return {
                success: true,
                messageId,
                provider: 'ses'
            };
        } catch (error) {
            const errorMessage = this._parseSesError(error);

            logger.error({
                err: error.message,
                code: error.name || error.Code,
                to,
                subject
            }, 'SES send failed');

            return {
                success: false,
                error: errorMessage,
                code: error.name || error.Code
            };
        }
    }

    _parseSesError(error) {
        const errorCode = error.name || error.Code || '';
        const errorMessage = error.message || 'Unknown SES error';

        const errorMap = {
            AccessDeniedException: 'SES access denied. Check IAM permissions.',
            MessageRejected: 'SES rejected the message. Verify sender/recipient identities and account state.',
            MailFromDomainNotVerifiedException: 'SES MAIL FROM domain is not verified.',
            SendingPausedException: 'SES sending is currently paused for this account.',
            TooManyRequestsException: 'SES rate limit exceeded. Retry shortly.',
            ThrottlingException: 'SES request throttled. Retry shortly.'
        };

        return errorMap[errorCode] || errorMessage;
    }

    isConfigured() {
        return this.sesConfig.isConfigured();
    }

    /**
     * Send an email using an SES Template
     * @param {Object} options
     * @param {string} options.to - Recipient email
     * @param {string} options.templateName - Name of the SES template (e.g. mgm_order_placed)
     * @param {Object} options.templateData - JSON data to inject into template
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendTemplated({ to, templateName, templateData = {} }) {
        if (!this.isConfigured()) {
            return { success: false, error: 'SES Provider is not fully configured' };
        }

        if (!this.client) {
            this._initializeClient();
            if (!this.client) {
                return { success: false, error: 'Failed to initialize SES client' };
            }
        }

        try {
            const command = new SendEmailCommand({
                FromEmailAddress: this.sesConfig.from.email,
                Destination: {
                    ToAddresses: [to]
                },
                Content: {
                    Template: {
                        TemplateName: templateName,
                        TemplateData: JSON.stringify(templateData)
                    }
                },
                ReplyToAddresses: this.sesConfig.replyTo ? [this.sesConfig.replyTo] : [],
                EmailTags: [
                    { Name: 'provider', Value: 'ses' },
                    { Name: 'app', Value: process.env.APP_NAME || 'app' },
                    { Name: 'template', Value: templateName }
                ]
            });

            const response = await this.client.send(command);

            logger.info({ messageId: response.MessageId, to, templateName }, 'Email sent via SES Template');

            return {
                success: true,
                messageId: response.MessageId
            };
        } catch (error) {
            const errorMessage = this._parseSesError(error);
            logger.error({ 
                err: error.message, 
                code: error.name || error.Code, 
                to, 
                templateName 
            }, 'SES templated send failed');

            return {
                success: false,
                error: errorMessage || 'Failed to send templated email via SES',
                details: error.name
            };
        }
    }

    stripHtml(html) {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);
    }
}

module.exports = SesProvider;
