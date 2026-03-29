const logger = require('../utils/logger');
const { getFriendlyMessage } = require('../utils/error-messages');
const SystemMessages = require('../constants/messages/SystemMessages');

/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;
    const friendlyMessage = getFriendlyMessage(err, statusCode);

    // Log the error using structured logger
    logger.error({
        msg: SystemMessages.UNHANDLED_EXCEPTION,
        module: 'API',
        operation: 'ERROR_HANDLER',
        err,
        req,
        statusCode,
        friendlyMessage
    });

    res.status(statusCode).json({
        error: friendlyMessage,
        code: err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
        correlationId: req.correlationId,
        // Detailed error for development troubleshooting
        message: process.env.NODE_ENV !== 'production' ? err.message : undefined,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        // Only include details if it's a validation error and contains safe info
        details: statusCode === 400 && err.details ? err.details : undefined
    });
};

module.exports = errorHandler;
