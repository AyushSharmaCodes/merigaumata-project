/**
 * Logger utility class with New Relic integration.
 * Provides structured logging with automatic New Relic event and error reporting.
 */
const newrelic = require('newrelic');
const logger = require('./logger');

// Sensitive fields to sanitize from logs
const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'creditCard', 'ssn', 'secret', 'authorization'];

/**
 * Sanitize sensitive data from log payloads
 */
function sanitizeLogData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
        if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeLogData(sanitized[key]);
        }
    }

    return sanitized;
}

class Logger {
    /**
     * Log info level message with optional New Relic custom event
     */
    static info(message, metadata = {}) {
        const sanitizedMeta = sanitizeLogData(metadata);
        logger.info(sanitizedMeta, message);

        // Record custom event in New Relic for important info logs
        if (metadata.recordEvent !== false) {
            newrelic.recordCustomEvent('AppLog', {
                level: 'info',
                message,
                ...sanitizedMeta,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Log error with full context and report to New Relic
     */
    static error(message, error, metadata = {}) {
        const sanitizedMeta = sanitizeLogData(metadata);

        logger.error({
            err: error,
            ...sanitizedMeta
        }, message);

        // Report error to New Relic with context
        newrelic.noticeError(error, {
            message,
            ...sanitizedMeta
        });
    }

    /**
     * Log warning level message
     */
    static warn(message, metadata = {}) {
        const sanitizedMeta = sanitizeLogData(metadata);
        logger.warn(sanitizedMeta, message);

        newrelic.recordCustomEvent('AppLog', {
            level: 'warn',
            message,
            ...sanitizedMeta,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log debug level message (no New Relic event in production)
     */
    static debug(message, metadata = {}) {
        const sanitizedMeta = sanitizeLogData(metadata);
        logger.debug(sanitizedMeta, message);
    }

    /**
     * Log business events for analytics
     * @param {string} eventName - Name of the business event (e.g., 'UserRegistered', 'OrderPlaced')
     * @param {object} attributes - Event attributes
     */
    static logBusinessEvent(eventName, attributes = {}) {
        const sanitizedAttrs = sanitizeLogData(attributes);

        newrelic.recordCustomEvent(eventName, {
            ...sanitizedAttrs,
            timestamp: new Date().toISOString()
        });

        logger.info({
            eventName,
            ...sanitizedAttrs
        }, `Business Event: ${eventName}`);
    }

    /**
     * Record custom metric for monitoring
     * @param {string} name - Metric name (e.g., 'Custom/UserRegistrations')
     * @param {number} value - Metric value
     */
    static recordMetric(name, value) {
        newrelic.recordMetric(name, value);
    }

    /**
     * Set custom transaction name
     * @param {string} name - Transaction name
     */
    static setTransactionName(name) {
        newrelic.setTransactionName(name);
    }

    /**
     * Add custom attributes to current transaction
     * @param {object} attributes - Key-value pairs of attributes
     */
    static addCustomAttributes(attributes) {
        const sanitizedAttrs = sanitizeLogData(attributes);
        newrelic.addCustomAttributes(sanitizedAttrs);
    }

    /**
     * Start a custom segment for timing operations
     * @param {string} name - Segment name
     * @param {boolean} record - Whether to record in transaction trace
     * @param {Function} callback - The function to execute within the segment
     */
    static async startSegment(name, record, callback) {
        return newrelic.startSegment(name, record, callback);
    }

    /**
     * Start a background transaction
     * @param {string} name - Transaction name
     * @param {string} group - Transaction group
     * @param {Function} callback - The function to execute
     */
    static async startBackgroundTransaction(name, group, callback) {
        return newrelic.startBackgroundTransaction(name, group, callback);
    }

    /**
     * Insert distributed tracing headers for microservices communication
     * @param {object} headers - Headers object to add tracing headers to
     */
    static insertDistributedTraceHeaders(headers) {
        newrelic.insertDistributedTraceHeaders(headers);
    }
}

module.exports = Logger;
