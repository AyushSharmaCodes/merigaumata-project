const logger = require('../utils/logger');
const { getFriendlyMessage } = require('../utils/error-messages');
const SystemMessages = require('../constants/messages/SystemMessages');

/**
 * Middleware to intercept res.json and translate technical error messages
 * This acts as a safety net for routes that don't use the global error handler
 */
const friendlyErrorInterceptor = (req, res, next) => {
    const originalJson = res.json;

    res.json = function (body) {
        if (body && body.error && res.statusCode >= 400) {
            const originalMessage = body.error;
            const translatedMessage = getFriendlyMessage(originalMessage, res.statusCode);

            // If the message was changed, log it for developers
            if (originalMessage !== translatedMessage) {
                logger.warn({
                    msg: SystemMessages.TECHNICAL_ERROR_INTERCEPTED,
                    module: 'API',
                    operation: 'FRIENDLY_ERROR_INTERCEPTOR',
                    originalMessage,
                    friendlyMessage: translatedMessage,
                    statusCode: res.statusCode,
                    path: req.path,
                    method: req.method
                });

                body.error = translatedMessage;
            }

            // Remove any stack trace if it somehow leaked into the body
            if (body.stack) {
                // Log the stack before removing it
                logger.error({
                    msg: SystemMessages.STACK_TRACE_LEAK,
                    module: 'API',
                    operation: 'FRIENDLY_ERROR_INTERCEPTOR',
                    stack: body.stack,
                    path: req.path
                });
                delete body.stack;
            }
        }
        return originalJson.call(this, body);
    };

    next();
};

module.exports = friendlyErrorInterceptor;
