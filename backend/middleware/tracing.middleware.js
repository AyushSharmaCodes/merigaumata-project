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
    req.parentSpanId = parentSpanId;
    req.traceContext = traceContext;

    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Span-Id', spanId);
    if (parentSpanId) {
        res.setHeader('X-Parent-Span-Id', parentSpanId);
    }

    const store = {
        ...traceContext,
        userId: req.user?.id || req.headers['x-user-id'] || req.headers['X-User-ID'] || null
    };

    context.run(store, () => {
        const requestStartedAt = Date.now();
        logger.info(`${req.method} ${req.originalUrl || req.url} - Request Started`, {
            module: 'API',
            operation: 'HTTP_REQUEST_START',
            req,
            context: {
                route: req.route?.path || null,
                queryKeys: Object.keys(req.query || {}),
                bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
                contentLength: req.headers['content-length'] || null
            }
        });

        res.on('finish', () => {
            const durationMs = Date.now() - requestStartedAt;
            const level = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');

            logger[level](`${req.method} ${req.originalUrl || req.url} - Request Completed`, {
                module: 'API',
                operation: 'HTTP_REQUEST_END',
                req,
                res,
                durationMs,
                context: {
                    route: req.route?.path || null,
                    statusCode: res.statusCode,
                    contentLength: res.getHeader('content-length') || null
                }
            });
        });

        res.on('close', () => {
            if (res.writableEnded) return;
            const durationMs = Date.now() - requestStartedAt;
            logger.warn(`${req.method} ${req.originalUrl || req.url} - Request Aborted`, {
                module: 'API',
                operation: 'HTTP_REQUEST_ABORTED',
                req,
                durationMs,
                context: {
                    route: req.route?.path || null
                }
            });
        });

        next();
    });
}

module.exports = {
    tracingMiddleware,
    generateTraceId,
    generateSpanId
};
