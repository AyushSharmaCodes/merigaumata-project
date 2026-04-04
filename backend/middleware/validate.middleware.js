const { z } = require('zod');
const logger = require('../utils/logger');

/**
 * Middleware factory for Zod validation
 * @param {z.ZodSchema} schema - Zod schema to validate request against
 * @param {'body'|'query'|'params'} source - Request property to validate (default: body)
 */
const validate = (schema, source = 'body') => (req, res, next) => {
    try {
        // Parse the request data against the schema
        // This will strip unknown keys if strict() is not used (which is good for flexibility)
        // Or we can use parse() which throws.

        const dataToValidate = req[source];
        const validData = schema.parse(dataToValidate);

        // Replace request data with validated (and potentially transformed) data
        req[source] = validData;

        next();
    } catch (error) {
        if ((error instanceof z.ZodError) || error.name === 'ZodError') {
            // Format Zod errors into a readable structure
            // If error.errors is missing but it's a ZodError, try parsing the message if it looks like JSON
            let errors = [];
            if (error.errors) {
                errors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: req.t ? req.t(err.message) : err.message
                }));
            } else {
                // Fallback if errors array is missing
                try {
                    const parsed = JSON.parse(error.message);
                    if (Array.isArray(parsed)) {
                        errors = parsed.map(err => ({
                            field: err.path?.join('.') || 'unknown',
                            message: req.t ? req.t(err.message) : err.message
                        }));
                    } else {
                        errors = [{ field: 'unknown', message: req.t ? req.t(error.message) : error.message }];
                    }
                } catch (e) {
                    errors = [{ field: 'unknown', message: req.t ? req.t(error.message) : error.message }];
                }
            }

            logger.warn({
                path: req.path,
                validationErrors: errors
            }, 'Validation Error');

            const summaryMessage = errors.length === 1
                ? errors[0].message
                : (req.t ? req.t('errors.auth.fixErrors') : 'Please correct the highlighted fields and try again.');

            return res.status(400).json({
                error: summaryMessage,
                code: 'VALIDATION_ERROR',
                details: errors
            });
        }

        next(error);
    }
};

module.exports = validate;
