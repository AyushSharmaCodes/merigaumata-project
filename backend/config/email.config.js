/**
 * Email Configuration Module
 * Centralized configuration for all email providers with validation
 * 
 * EMAIL NOTIFICATION POLICY:
 * ===========================
 * Customer-facing order emails are STRICTLY LIMITED to 6 definitive states:
 * 1. ORDER_PLACED (pending) - Customer completes payment
 * 2. ORDER_CONFIRMED (confirmed) - Admin confirms order
 * 3. ORDER_SHIPPED (shipped) - Order is shipped
 * 4. ORDER_DELIVERED (delivered) - Order is delivered
 * 5. ORDER_CANCELLED (cancelled) - Order is cancelled
 * 6. ORDER_RETURNED (returned) - Return is completed
 * 
 * DEPRECATED EMAIL TYPES (No longer sent):
 * - PAYMENT_CONFIRMED - Redundant with ORDER_PLACED
 * - GST_INVOICE_GENERATED - Available via download on order details page
 * - RETURN_REQUESTED - Customer can check status on order details page
 * - RETURN_APPROVED - Customer can check status on order details page
 * - RETURN_REJECTED - Customer can check status on order details page
 * - REFUND_INITIATED - Customer can check status on order details page
 * - REFUND_COMPLETED - Customer can check status on order details page
 * 
 * Supported Providers:
 * - MailerSend API
 * - SMTP (Gmail, Outlook, Custom)
 * - Console (development fallback)
 */

const logger = require('../utils/logger');

/**
 * Validate required environment variables for a provider
 * @param {string[]} requiredVars - List of required environment variable names
 * @param {string} providerName - Name of the provider for error messages
 * @returns {{valid: boolean, missing: string[]}}
 */
function validateRequiredVars(requiredVars, providerName) {
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        logger.warn({ provider: providerName, missing }, `Missing required environment variables for ${providerName}`);
    }
    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * SMTP Configuration
 * Supports Gmail, Outlook, and custom SMTP servers
 */
const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    // SMTP_SECURE should be 'true' for port 465, 'false' for other ports (uses STARTTLS)
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    },
    from: {
        name: process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'Antigravity',
        email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
    },

    /**
     * Check if SMTP is fully configured
     */
    isConfigured() {
        return Boolean(
            this.host &&
            this.port &&
            this.auth.user &&
            this.auth.pass
        );
    },

    /**
     * Validate SMTP configuration
     */
    validate() {
        return validateRequiredVars(
            ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'],
            'SMTP'
        );
    },

    /**
     * Get Nodemailer transport options
     */
    getTransportOptions() {
        return {
            host: this.host,
            port: this.port,
            secure: this.secure,
            auth: this.auth,
            // Connection timeout of 10 seconds
            connectionTimeout: 10000,
            // Socket timeout of 30 seconds
            socketTimeout: 30000,
            // Enable debug logging in development
            debug: process.env.NODE_ENV === 'development',
            // TLS options for self-signed certificates (optional)
            tls: {
                // Do not fail on invalid certs in development
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        };
    }
};

/**
 * MailerSend Configuration
 */
const mailersendConfig = {
    apiKey: process.env.MAILERSEND_API_KEY,
    from: {
        name: process.env.MAILERSEND_FROM_NAME || process.env.APP_NAME || 'Antigravity',
        email: process.env.MAILERSEND_FROM_EMAIL
    },
    apiUrl: 'https://api.mailersend.com/v1/email',

    /**
     * Check if MailerSend is fully configured
     */
    isConfigured() {
        return Boolean(this.apiKey && this.from.email);
    },

    /**
     * Validate MailerSend configuration
     */
    validate() {
        return validateRequiredVars(
            ['MAILERSEND_API_KEY', 'MAILERSEND_FROM_EMAIL'],
            'MailerSend'
        );
    }
};

/**
 * Get the active email provider from environment
 * @returns {'mailersend' | 'smtp' | 'console'}
 */
function getActiveProvider() {
    const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();
    const validProviders = ['mailersend', 'smtp', 'console'];

    if (!validProviders.includes(provider)) {
        logger.error({ provider, validProviders }, `Invalid EMAIL_PROVIDER: "${provider}". Falling back to console.`);
        return 'console';
    }

    return provider;
}

/**
 * Validate the active provider configuration at startup
 * Logs warnings for missing configuration but does not throw
 */
function validateActiveProvider() {
    const provider = getActiveProvider();

    switch (provider) {
        case 'smtp':
            if (!smtpConfig.isConfigured()) {
                const { missing } = smtpConfig.validate();
                logger.error({ provider, missing }, 'SMTP provider selected but not configured. Will fall back to console.');
                return false;
            }
            logger.info({
                provider,
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                fromEmail: smtpConfig.from.email
            }, 'SMTP provider configuration validated');
            return true;

        case 'mailersend':
            if (!mailersendConfig.isConfigured()) {
                const { missing } = mailersendConfig.validate();
                logger.error({ provider, missing }, 'MailerSend provider selected but not configured. Will fall back to console.');
                return false;
            }
            logger.info({
                provider,
                fromEmail: mailersendConfig.from.email,
                fromName: mailersendConfig.from.name
            }, 'MailerSend provider configuration validated');
            return true;

        case 'console':
        default:
            logger.debug({ provider }, 'Using console email provider (development mode)');
            return true;
    }
}

module.exports = {
    smtp: smtpConfig,
    mailersend: mailersendConfig,
    getActiveProvider,
    validateActiveProvider,
    validateRequiredVars
};
