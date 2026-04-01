const logger = require('../utils/logger');
const { getFriendlyMessage } = require('../utils/error-messages');
const SystemMessages = require('../constants/messages/SystemMessages');
const { formatErrorResponse } = require('../utils/error-response');

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

    res.status(statusCode).json(formatErrorResponse({
        req,
        statusCode,
        fallbackMessage: friendlyMessage,
        body: {
            code: err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
            details: statusCode === 400 && err.details ? err.details : undefined
        },
        exposeDebug: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production' ? {
            originalMessage: err.message,
            stack: err.stack
        } : undefined
    }));
};

module.exports = errorHandler;
