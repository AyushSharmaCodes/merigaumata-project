/**
 * SMTP Email Provider
 * Uses Nodemailer for sending emails via SMTP
 * 
 * Supports:
 * - Gmail (smtp.gmail.com)
 * - Outlook/Office365 (smtp.office365.com)
 * - Any custom SMTP server
 * 
 * Configuration via environment variables:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use TLS (true for port 465, false for 587 with STARTTLS)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASSWORD: SMTP password or app-specific password
 * - SMTP_FROM_NAME: Display name for sender
 * - SMTP_FROM_EMAIL: Sender email address
 */
const nodemailer = require('nodemailer');
const BaseEmailProvider = require('./base.provider');
const logger = require('../../../utils/logger');
const emailConfig = require('../../../config/email.config');

class SmtpProvider extends BaseEmailProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'smtp';
        this.smtpConfig = emailConfig.smtp;
        this.transporter = null;

        // Initialize transport if configured
        if (this.isConfigured()) {
            this._initializeTransport();
        }
    }

    /**
     * Initialize the Nodemailer transporter
     * @private
     */
    _initializeTransport() {
        try {
            const transportOptions = this.smtpConfig.getTransportOptions();
            this.transporter = nodemailer.createTransport(transportOptions);

            logger.info({
                host: this.smtpConfig.host,
                port: this.smtpConfig.port,
                secure: this.smtpConfig.secure,
                user: this.smtpConfig.auth.user ? '***configured***' : 'not set'
            }, 'SMTP transporter initialized');
        } catch (error) {
            logger.error({ err: error.message }, 'Failed to initialize SMTP transporter');
            this.transporter = null;
        }
    }

    /**
     * Verify SMTP connection
     * @returns {Promise<boolean>}
     */
    async verifyConnection() {
        if (!this.transporter) {
            return false;
        }

        try {
            await this.transporter.verify();
            logger.info('SMTP connection verified successfully');
            return true;
        } catch (error) {
            logger.error({ err: error.message }, 'SMTP connection verification failed');
            return false;
        }
    }

    /**
     * Send an email via SMTP
     * @param {Object} options
     * @param {string} options.to - Recipient email address
     * @param {string} options.subject - Email subject
     * @param {string} options.html - HTML content
     * @param {string} [options.text] - Plain text content (optional, auto-generated from HTML if not provided)
     * @param {Array} [options.attachments] - Attachments array (optional)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async send({ to, subject, html, text, attachments = [] }) {
        if (!this.isConfigured()) {
            logger.error('SMTP not configured');
            return {
                success: false,
                error: 'SMTP not configured. Please check SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.'
            };
        }

        if (!this.transporter) {
            this._initializeTransport();
            if (!this.transporter) {
                return {
                    success: false,
                    error: 'Failed to initialize SMTP transporter'
                };
            }
        }

        try {
            // Prepare mail options
            const mailOptions = {
                from: {
                    name: this.smtpConfig.from.name,
                    address: this.smtpConfig.from.email
                },
                to: to,
                subject: subject,
                html: html,
                text: text || this.stripHtml(html)
            };

            // Add attachments if provided
            if (attachments && attachments.length > 0) {
                mailOptions.attachments = attachments.map(attachment => {
                    // Support both file paths and buffer content
                    if (attachment.path) {
                        return {
                            filename: attachment.filename || attachment.path.split('/').pop(),
                            path: attachment.path,
                            contentType: attachment.contentType
                        };
                    } else if (attachment.content) {
                        return {
                            filename: attachment.filename,
                            content: attachment.content,
                            contentType: attachment.contentType
                        };
                    }
                    return attachment;
                });
            }

            // Send the email
            const info = await this.transporter.sendMail(mailOptions);

            logger.info({
                messageId: info.messageId,
                to: to,
                subject: subject
            }, 'Email sent via SMTP');

            return {
                success: true,
                messageId: info.messageId,
                provider: 'smtp',
                response: info.response
            };

        } catch (error) {
            // Handle specific SMTP errors
            const errorMessage = this._parseSmtpError(error);

            logger.error({
                err: error.message,
                code: error.code,
                to: to,
                subject: subject
            }, 'SMTP send failed');

            return {
                success: false,
                error: errorMessage,
                code: error.code
            };
        }
    }

    /**
     * Parse SMTP errors into user-friendly messages
     * @private
     * @param {Error} error
     * @returns {string}
     */
    _parseSmtpError(error) {
        const errorCode = error.code || '';
        const errorMessage = error.message || 'Unknown SMTP error';

        // Common SMTP error codes
        const errorMap = {
            'EAUTH': 'SMTP authentication failed. Please check your credentials.',
            'ESOCKET': 'Unable to connect to SMTP server. Please check host and port.',
            'ECONNECTION': 'Connection to SMTP server failed.',
            'EENVELOPE': 'Invalid email envelope (from/to addresses).',
            'EMESSAGE': 'Message could not be sent.',
            'ETIMEDOUT': 'SMTP connection timed out.',
            'ECONNREFUSED': 'SMTP connection refused. Server may be down or port blocked.',
            'SELF_SIGNED_CERT_IN_CHAIN': 'SSL certificate error. Contact your SMTP provider.'
        };

        return errorMap[errorCode] || errorMessage;
    }

    /**
     * Check if SMTP provider is configured
     * @returns {boolean}
     */
    isConfigured() {
        return this.smtpConfig.isConfigured();
    }

    /**
     * Strip HTML tags for plain text version
     * @param {string} html
     * @returns {string}
     */
    stripHtml(html) {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);
    }

    /**
     * Close the SMTP transporter
     */
    close() {
        if (this.transporter) {
            this.transporter.close();
            this.transporter = null;
            logger.info('SMTP transporter closed');
        }
    }
}

module.exports = SmtpProvider;
