const logger = require('../utils/logger');
const { getErrorInfo } = require('../utils/error-messages');
const SystemMessages = require('../constants/messages/SystemMessages');
const { formatErrorResponse } = require('../utils/error-response');

/**
 * Middleware to intercept res.json and translate technical error messages
 * This acts as a safety net for routes that don't use the global error handler
 */
const friendlyErrorInterceptor = (req, res, next) => {
    const originalJson = res.json;

    res.json = function (body) {
        if (body && res.statusCode >= 400) {
            let normalizedBody = body;

            // Intercept both 'error' and 'message' fields for translation
            const errorField = body.error ? 'error' : (body.message ? 'message' : null);
            
            if (errorField) {
                const originalMessage = body[errorField];
                const errorInfo = getErrorInfo({
                    ...body,
                    message: body.message || originalMessage,
                    error: body.error || originalMessage
                }, res.statusCode);
                const translatedMessage = errorInfo.message;
                
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
                    
                    normalizedBody = {
                        ...normalizedBody,
                        code: normalizedBody.code || errorInfo.code,
                        details: normalizedBody.details || errorInfo.details,
                        [errorField]: translatedMessage
                    };
                } else if (!normalizedBody.code || (!normalizedBody.details && errorInfo.details)) {
                    normalizedBody = {
                        ...normalizedBody,
                        code: normalizedBody.code || errorInfo.code,
                        details: normalizedBody.details || errorInfo.details
                    };
                }
            }
            
            // Remove any stack trace if it somehow leaked into the body
            if (normalizedBody.stack) {
                // Log the stack before removing it
                logger.error({
                    msg: SystemMessages.STACK_TRACE_LEAK,
                    module: 'API',
                    operation: 'FRIENDLY_ERROR_INTERCEPTOR',
                    stack: normalizedBody.stack,
                    path: req.path
                });

                normalizedBody = {
                    ...normalizedBody
                };
                delete normalizedBody.stack;
            }

            return originalJson.call(this, formatErrorResponse({
                req,
                statusCode: res.statusCode,
                body: normalizedBody
            }));
        }

        return originalJson.call(this, body);
    };

    next();
};

module.exports = friendlyErrorInterceptor;
