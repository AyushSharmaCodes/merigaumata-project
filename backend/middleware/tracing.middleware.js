/**
 * Tracing Middleware
 */

const crypto = require('crypto');
const { context } = require('../utils/async-context');
const logger = require('../utils/logger');

function generateTraceId() {
    return crypto.randomUUID();
}

function generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Tracing Middleware
 */
function tracingMiddleware(req, res, next) {
    const traceId = req.headers['x-trace-id'] || req.headers['X-Trace-Id'] || generateTraceId();
    const correlationId = req.headers['x-correlation-id'] || req.headers['X-Correlation-Id'] || traceId;
    const spanId = generateSpanId();
    const parentSpanId = req.headers['x-span-id'] || req.headers['X-Span-Id'] || null;

    const traceContext = {
        traceId,
        spanId,
        parentSpanId,
        correlationId,
        startTime: Date.now()
    };

    req.traceId = traceId;
    req.correlationId = correlationId;
    req.spanId = spanId;
    req.traceContext = traceContext;

    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Span-Id', spanId);

    const store = {
        ...traceContext,
        userId: req.user?.id || req.headers['x-user-id'] || req.headers['X-User-ID'] || null
    };

    context.run(store, () => {
        // Log incoming request
        logger.info(`${req.method} ${req.url} - Request Started`, {
            module: 'API',
            operation: 'HTTP_REQUEST_START',
            req
        });

        // Hook into res.end to log completion
        const start = Date.now();
        const oldEnd = res.end;
        res.end = function (...args) {
            const durationMs = Date.now() - start;
            const level = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');

            logger[level](`${req.method} ${req.url} - Request Completed`, {
                module: 'API',
                operation: 'HTTP_REQUEST_END',
                res,
                durationMs
            });

            oldEnd.apply(this, args);
        };

        next();
    });
}

module.exports = {
    tracingMiddleware,
    generateTraceId,
    generateSpanId
};
