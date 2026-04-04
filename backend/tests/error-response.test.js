jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
}));

jest.mock('../utils/error-messages', () => ({
    getErrorInfo: jest.fn((input, statusCode) => ({
        statusCode,
        code: input?.code || 'ERROR',
        message: `friendly:${input?.message || input?.error || input}`,
        details: input?.details
    }))
}));

const errorHandler = require('../middleware/error.middleware');
const friendlyErrorInterceptor = require('../middleware/friendly-error.middleware');

describe('error response formatting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('global error handler returns a consistent error envelope with request context', () => {
        const req = {
            correlationId: 'corr-123',
            traceId: 'trace-123',
            spanId: 'span-123',
            parentSpanId: 'parent-span-123',
            user: { id: 'user-123' },
            headers: {
                'x-idempotency-key': 'idem-123'
            }
        };
        const res = {
            headersSent: false,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const err = new Error('Database exploded');
        err.statusCode = 503;
        err.code = 'DB_UNAVAILABLE';

        errorHandler(err, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            code: 'DB_UNAVAILABLE',
            error: 'friendly:Database exploded',
            message: 'friendly:Database exploded',
            userId: 'user-123',
            idempotencyKey: 'idem-123',
            correlationId: 'corr-123',
            traceId: 'trace-123',
            spanId: 'span-123',
            parentSpanId: 'parent-span-123',
            requestId: 'trace-123'
        }));
    });

    test('friendly error interceptor enriches manually returned error JSON', () => {
        const req = {
            path: '/api/comments',
            method: 'POST',
            traceId: 'trace-777',
            correlationId: 'corr-777',
            spanId: 'span-777',
            user: { id: 'user-777' },
            headers: {
                'x-idempotency-key': 'idem-777'
            }
        };
        const payloads = [];
        const res = {
            statusCode: 409,
            json: jest.fn((body) => {
                payloads.push(body);
                return body;
            })
        };

        friendlyErrorInterceptor(req, res, jest.fn());
        res.json({
            error: 'errors.comment.updateFailed',
            retry: false
        });

        expect(payloads).toHaveLength(1);
        expect(payloads[0]).toEqual(expect.objectContaining({
            success: false,
            code: 'ERROR',
            error: 'friendly:errors.comment.updateFailed',
            message: 'friendly:errors.comment.updateFailed',
            retry: false,
            userId: 'user-777',
            idempotencyKey: 'idem-777',
            correlationId: 'corr-777',
            traceId: 'trace-777',
            spanId: 'span-777',
            requestId: 'trace-777'
        }));
    });
});
