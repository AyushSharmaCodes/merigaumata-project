
const { tracingMiddleware } = require('../middleware/tracing.middleware');
const { getContext } = require('../utils/async-context');
const logger = require('../utils/logger');

// Mock logger
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

describe('Tracing Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            method: 'GET',
            url: '/test',
            headers: {}
        };
        res = {
            setHeader: jest.fn(),
            end: jest.fn(),
            statusCode: 200,
            on: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should generate traceId, spanId, and correlationId if not present', () => {
        // We need to use a real next function that checks the context
        const nextWithContextCheck = () => {
            const context = getContext();
            expect(context).toBeDefined();
            expect(context.traceId).toBeDefined();
            expect(context.spanId).toBeDefined();
            expect(context.correlationId).toBeDefined();
            expect(context.traceId).toBe(req.traceId);
        };

        tracingMiddleware(req, res, nextWithContextCheck);

        expect(req.traceId).toBeDefined();
        expect(req.spanId).toBeDefined();
        expect(req.correlationId).toBeDefined();
        expect(res.setHeader).toHaveBeenCalledWith('X-Trace-Id', req.traceId);
        expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', req.correlationId);
        expect(res.setHeader).toHaveBeenCalledWith('X-Span-Id', req.spanId);
    });

    it('should use existing traceId and correlationId from headers', () => {
        const existingTraceId = 'existing-trace-id';
        const existingCorrelationId = 'existing-correlation-id';
        req.headers['x-trace-id'] = existingTraceId;
        req.headers['x-correlation-id'] = existingCorrelationId;

        const nextWithContextCheck = () => {
            const context = getContext();
            expect(context.traceId).toBe(existingTraceId);
            expect(context.correlationId).toBe(existingCorrelationId);
        };

        tracingMiddleware(req, res, nextWithContextCheck);

        expect(req.traceId).toBe(existingTraceId);
        expect(req.correlationId).toBe(existingCorrelationId);
        // spanId should still be new
        expect(req.spanId).toBeDefined();
    });

    it('should log request start with trace context', () => {
        tracingMiddleware(req, res, next);

        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Request Started'),
            expect.objectContaining({
                module: 'API',
                operation: 'HTTP_REQUEST_START'
            })
        );
    });
});
