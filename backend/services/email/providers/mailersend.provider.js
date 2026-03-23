/**
 * MailerSend Email Provider
 * Uses MailerSend API for sending transactional emails
 */
const BaseEmailProvider = require('./base.provider');
const logger = require('../../../utils/logger');

class MailerSendProvider extends BaseEmailProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'mailersend';
        this.apiKey = config.apiKey || process.env.MAILERSEND_API_KEY;
        this.fromEmail = config.fromEmail || process.env.MAILERSEND_FROM_EMAIL;
        this.fromName = config.fromName || process.env.MAILERSEND_FROM_NAME || process.env.APP_NAME || 'Antigravity';
        this.apiUrl = process.env.MAILERSEND_API_URL || 'https://api.mailersend.com/v1/email';
    }

    async send({ to, subject, html, text }) {
        if (!this.isConfigured()) {
            logger.error('MailerSend not configured');
            return {
                success: false,
                error: 'MailerSend not configured'
            };
        }

        try {
            const payload = {
                from: {
                    email: this.fromEmail,
                    name: this.fromName
                },
                to: [
                    {
                        email: to
                    }
                ],
                subject: subject,
                html: html,
                text: text || this.stripHtml(html)
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                logger.error({ statusCode: response.status }, 'MailerSend API error');
                return {
                    success: false,
                    error: errorData.message || `HTTP ${response.status}`,
                    statusCode: response.status
                };
            }

            // MailerSend returns 202 Accepted with X-Message-Id header
            const messageId = response.headers.get('X-Message-Id') || `mailersend-${Date.now()}`;

            logger.info({ messageId }, 'Email sent via MailerSend');

            return {
                success: true,
                messageId: messageId,
                provider: 'mailersend'
            };

        } catch (error) {
            logger.error({ err: error.message }, 'MailerSend send failed');
            return {
                success: false,
                error: error.message
            };
        }
    }

    isConfigured() {
        return Boolean(this.apiKey && this.fromEmail);
    }

    /**
     * Strip HTML tags for plain text version
     */
    stripHtml(html) {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 1000);
    }
}

module.exports = MailerSendProvider;

