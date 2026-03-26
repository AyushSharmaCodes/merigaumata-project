/**
 * Logging Standards Utility
 * 
 * Provides consistent, structured logging across all services.
 * Automatically includes trace context (traceId, spanId, correlationId).
 * 
 * Log Levels:
 * - DEBUG: Detailed flow info, request/response bodies
 * - INFO: Key operations, state changes
 * - WARN: Recoverable issues, degraded operations
 * - ERROR: Failures requiring attention
 */

const logger = require('./logger');
const { getTraceContext, createChildSpan, getDuration } = require('./async-context');

/**
 * Creates a scoped logger for a specific module
 * All logs will automatically include module name and trace context
 * 
 * @param {string} moduleName - Name of the module (e.g., 'CheckoutService', 'OrderService')
 * @returns {Object} Scoped logger with operation methods
 */
function createModuleLogger(moduleName) {
    const baseContext = () => {
        const trace = getTraceContext();
        return {
            module: moduleName,
            traceId: trace.traceId,
            spanId: trace.spanId,
            parentSpanId: trace.parentSpanId,
            correlationId: trace.correlationId,
            userId: trace.userId
        };
    };

    return {
        /**
         * Log operation start (DEBUG level)
         * @param {string} operation - Operation name (e.g., 'CREATE_ORDER')
         * @param {Object} details - Operation details (sanitized)
         */
        operationStart(operation, details = {}) {
            logger.debug({
                ...baseContext(),
                operation,
                phase: 'START',
                ...sanitizeDetails(details)
            }, `[${moduleName}] Starting ${operation}`);
        },

        /**
         * Log operation success (INFO level)
         * @param {string} operation - Operation name
         * @param {Object} result - Operation result (sanitized)
         * @param {number} durationMs - Operation duration in milliseconds
         */
        operationSuccess(operation, result = {}, durationMs = null) {
            logger.info({
                ...baseContext(),
                operation,
                phase: 'SUCCESS',
                durationMs: durationMs || getDuration(),
                ...sanitizeDetails(result)
            }, `[${moduleName}] ${operation} completed successfully`);
        },

        /**
         * Log operation failure (ERROR level)
         * @param {string} operation - Operation name
         * @param {Error} error - Error object
         * @param {Object} context - Additional context
         */
        operationError(operation, error, context = {}) {
            logger.error({
                ...baseContext(),
                operation,
                phase: 'ERROR',
                durationMs: getDuration(),
                err: {
                    message: error.message,
                    code: error.code,
                    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
                },
                ...sanitizeDetails(context)
            }, `[${moduleName}] ${operation} failed: ${error.message}`);
        },

        /**
         * Log warning for recoverable issues (WARN level)
         * @param {string} operation - Operation name
         * @param {string} message - Warning message
         * @param {Object} context - Additional context
         */
        warn(operation, message, context = {}) {
            logger.warn({
                ...baseContext(),
                operation,
                phase: 'WARN',
                ...sanitizeDetails(context)
            }, `[${moduleName}] ${operation}: ${message}`);
        },

        /**
         * Log debug information (DEBUG level)
         * @param {string} operation - Operation name
         * @param {string} message - Debug message
         * @param {Object} details - Debug details
         */
        debug(operation, message, details = {}) {
            logger.debug({
                ...baseContext(),
                operation,
                ...sanitizeDetails(details)
            }, `[${moduleName}] ${operation}: ${message}`);
        },

        /**
         * Log info level message
         * @param {string} operation - Operation name
         * @param {string} message - Info message
         * @param {Object} details - Additional details
         */
        info(operation, message, details = {}) {
            logger.info({
                ...baseContext(),
                operation,
                ...sanitizeDetails(details)
            }, `[${moduleName}] ${operation}: ${message}`);
        },

        /**
         * Log external API call (DEBUG on success, WARN on retry/fail)
         * @param {string} service - External service name (e.g., 'Razorpay', 'Supabase')
         * @param {string} endpoint - API endpoint
         * @param {string} status - 'success', 'retry', 'error'
         * @param {Object} details - Call details
         */
        externalCall(service, endpoint, status, details = {}) {
            const level = status === 'error' ? 'error' : status === 'retry' ? 'warn' : 'debug';
            logger[level]({
                ...baseContext(),
                operation: 'EXTERNAL_CALL',
                service,
                endpoint,
                status,
                ...sanitizeDetails(details)
            }, `[${moduleName}] External call to ${service}/${endpoint}: ${status}`);
        },

        /**
         * Create a child span for nested operations
         * @param {string} operationName - Name of the nested operation
         * @returns {Object} Child span context
         */
        createSpan(operationName) {
            return createChildSpan(`${moduleName}.${operationName}`);
        }
    };
}

/**
 * Sanitize details to remove sensitive information
 * @param {Object} details - Details object
 * @returns {Object} Sanitized details
 */
function sanitizeDetails(details) {
    if (!details || typeof details !== 'object') return {};

    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'key'];

    for (const key of Object.keys(sanitized)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(s => lowerKey.includes(s))) {
            sanitized[key] = '[REDACTED]';
        }
        // Truncate very long strings (e.g., base64 images)
        if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
            sanitized[key] = sanitized[key].substring(0, 100) + `...[truncated ${sanitized[key].length - 100} chars]`;
        }
    }

    return sanitized;
}

/**
 * Log HTTP request details (for use in route handlers)
 * @param {Object} req - Express request object
 * @param {string} moduleName - Module name
 * @returns {Object} Request log context
 */
function logRequestContext(req, moduleName) {
    return {
        module: moduleName,
        request: {
            method: req.method,
            path: req.path,
            params: req.params,
            query: sanitizeDetails(req.query)
        },
        traceId: req.traceContext?.traceId || req.id,
        spanId: req.traceContext?.spanId,
        parentSpanId: req.traceContext?.parentSpanId || null,
        correlationId: req.traceContext?.correlationId || req.id,
        userId: req.user?.id || req.headers['x-user-id']
    };
}

/**
 * Log HTTP response details
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body (sanitized)
 * @param {number} durationMs - Request duration
 * @returns {Object} Response log context
 */
function logResponseContext(statusCode, body = {}, durationMs = 0) {
    return {
        response: {
            statusCode,
            ...sanitizeDetails(body)
        },
        durationMs
    };
}

module.exports = {
    createModuleLogger,
    sanitizeDetails,
    logRequestContext,
    logResponseContext
};
