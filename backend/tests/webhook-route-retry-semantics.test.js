const mockProcessWebhookEvent = jest.fn();
const mockGetRecentLogs = jest.fn();

jest.mock('../services/razorpay-webhook-logger.service', () => ({
    RazorpayWebhookLogger: {
        processWebhookEvent: (...args) => mockProcessWebhookEvent(...args),
        getRecentLogs: (...args) => mockGetRecentLogs(...args)
    }
}));

jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        operationError: jest.fn()
    }))
}));

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: jest.fn((req, res, next) => next()),
    requireRole: jest.fn(() => (req, res, next) => next())
}));

const webhookRoutes = require('../routes/webhook.routes');

function getRouteHandler(path, method) {
    const layer = webhookRoutes.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) {
        throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    }
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

describe('webhook.routes retry semantics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST /razorpay returns 500 with retry=true for retryable processing failures', async () => {
        const handler = getRouteHandler('/razorpay', 'post');
        const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
        const req = {
            headers: { 'x-razorpay-signature': 'sig' },
            body: Buffer.from(rawBody),
            t: jest.fn((key) => key)
        };
        const res = createResponse();

        mockProcessWebhookEvent.mockResolvedValueOnce({
            success: false,
            verified: true,
            shouldRetry: true,
            error: 'Temporary database outage'
        });

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            error: 'Temporary database outage',
            retry: true
        });
    });

    test('POST /razorpay returns 200 for verified logical failures to prevent duplicate retries', async () => {
        const handler = getRouteHandler('/razorpay', 'post');
        const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
        const req = {
            headers: { 'x-razorpay-signature': 'sig' },
            body: Buffer.from(rawBody),
            t: jest.fn((key) => key)
        };
        const res = createResponse();

        mockProcessWebhookEvent.mockResolvedValueOnce({
            success: false,
            verified: true,
            shouldRetry: false,
            error: 'Already processed'
        });

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: 'logged',
            error: 'Already processed'
        });
    });
});
