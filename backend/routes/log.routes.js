const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * @route POST /api/logs/client-error
 * @desc Receive and log frontend errors
 * @access Public
 */
router.post('/client-error', (req, res) => {
    try {
        const { message, stack, component, action, correlationId, traceId, spanId, ...rest } = req.body || {};

        if (!message) {
            // If body parsing failed or message missing, just ignore silently
            return res.status(204).send();
        }

        logger.error(`Frontend Error: ${message}`, {
            module: component || 'Frontend',
            operation: action || 'CLIENT_ERROR',
            context: {
                ...rest,
                correlationId,
                traceId,
                spanId,
                stack
            }
        });

        res.status(204).send();
    } catch (error) {
        // Fallback: Ensure we don't break the client flow even if logging fails
        console.error('Failed to process client error log:', error.message);
        res.status(204).send();
    }
});

module.exports = router;
