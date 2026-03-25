const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { clientErrorLogRateLimit } = require('../middleware/rateLimit.middleware');

const MAX_LOG_STRING_LENGTH = 4000;
const MAX_CONTEXT_KEYS = 20;

function truncateString(value) {
    const normalized = String(value || '');
    return normalized.length > MAX_LOG_STRING_LENGTH
        ? `${normalized.slice(0, MAX_LOG_STRING_LENGTH)}...[truncated]`
        : normalized;
}

function sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
        return {};
    }

    return Object.entries(context)
        .slice(0, MAX_CONTEXT_KEYS)
        .reduce((acc, [key, value]) => {
            if (typeof value === 'string') {
                acc[key] = truncateString(value);
            } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                acc[key] = value;
            } else {
                acc[key] = '[redacted-object]';
            }
            return acc;
        }, {});
}

/**
 * @route POST /api/logs/client-error
 * @desc Receive and log frontend errors
 * @access Public
 */
router.post('/client-error', clientErrorLogRateLimit, (req, res) => {
    try {
        const { message, stack, component, action, correlationId, traceId, spanId, ...rest } = req.body || {};

        if (!message) {
            // If body parsing failed or message missing, just ignore silently
            return res.status(204).send();
        }

        logger.error(`Frontend Error: ${truncateString(message)}`, {
            module: component || 'Frontend',
            operation: action || 'CLIENT_ERROR',
            context: {
                ...sanitizeContext(rest),
                correlationId,
                traceId,
                spanId,
                stack: truncateString(stack)
            }
        });

        res.status(204).send();
    } catch (error) {
        // Fallback: Ensure we don't break the client flow even if logging fails
        logger.error({ err: error }, 'Failed to process client error log');
        res.status(204).send();
    }
});

module.exports = router;
