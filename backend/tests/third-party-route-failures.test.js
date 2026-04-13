const mockDonationService = {
    createOneTimeOrder: jest.fn()
};

const mockEventRegistrationService = {
    createRegistrationOrder: jest.fn(),
    verifyPayment: jest.fn()
};

const mockAuthService = {
    authenticateGoogleUser: jest.fn(),
    exchangeCodeForSession: jest.fn()
};

jest.mock('../services/donation.service', () => mockDonationService);
jest.mock('../services/event-registration.service', () => mockEventRegistrationService);
jest.mock('../services/auth.service', () => mockAuthService);

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: jest.fn((req, res, next) => next()),
    invalidateAuthCache: jest.fn(),
    optionalAuth: jest.fn((req, res, next) => next())
}));

jest.mock('../middleware/requestLock.middleware', () => ({
    requestLock: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../middleware/idempotency.middleware', () => ({
    idempotency: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../middleware/validate.middleware', () => () => (req, res, next) => next());

jest.mock('../lib/supabase', () => ({
    supabase: { from: jest.fn() },
    supabaseAdmin: { from: jest.fn() }
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../utils/error-messages', () => ({
    getFriendlyMessage: jest.fn((error) => error.message || 'friendly-error')
}));

const donationRoutes = require('../routes/donation.routes');
const eventRegistrationRoutes = require('../routes/event-registration.routes');
const authRoutes = require('../routes/auth.routes');

function getRouteHandler(router, path, method) {
    const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) {
        throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    }
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis()
    };
}

describe('Third-party route failure handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'development';
        process.env.FRONTEND_URL = 'http://localhost:5173';
    });

    test('POST /donations/create-order returns upstream 502 message cleanly', async () => {
        const handler = getRouteHandler(donationRoutes, '/create-order', 'post');
        const req = {
            body: { amount: 500 },
            user: { id: 'user-1' }
        };
        const res = createResponse();

        const error = new Error('errors.payment.gatewayError');
        error.status = 502;
        mockDonationService.createOneTimeOrder.mockRejectedValueOnce(error);

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(502);
        expect(res.json).toHaveBeenCalledWith({
            error: 'errors.payment.gatewayError'
        });
    });

    test('POST /event-registrations/create-order sanitizes provider failures', async () => {
        const handler = getRouteHandler(eventRegistrationRoutes, '/create-order', 'post');
        const req = {
            body: { eventId: 'evt-1', fullName: 'Test', email: 'test@example.com', phone: '9999999999' },
            user: { id: 'user-1' },
            t: jest.fn((key) => key)
        };
        const res = createResponse();

        mockEventRegistrationService.createRegistrationOrder.mockRejectedValueOnce(
            new Error('Razorpay invoices.create timed out after 30000ms')
        );

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Failed to create registration. Please try again later.',
            code: undefined
        });
    });

    test('POST /event-registrations/verify-payment returns generic verification failure on upstream errors', async () => {
        const handler = getRouteHandler(eventRegistrationRoutes, '/verify-payment', 'post');
        const req = {
            body: {
                razorpay_payment_id: 'pay_123',
                registration_id: 'reg_123'
            },
            t: jest.fn((key) => key)
        };
        const res = createResponse();

        mockEventRegistrationService.verifyPayment.mockRejectedValueOnce(new Error('Razorpay payments.fetch timed out'));

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'errors.payment.verificationFailedDeducted'
        });
    });

    test('POST /auth/google/exchange returns 504-friendly error and clears oauth cookies on provider timeout', async () => {
        const handler = getRouteHandler(authRoutes, '/google/exchange', 'post');
        const req = {
            body: { code: 'auth-code', state: 'state-123' },
            cookies: {
                google_oauth_state: 'state-123',
                google_oauth_nonce: 'nonce-123',
                google_oauth_code_verifier: 'verifier-123'
            },
            headers: {},
            get: jest.fn(() => undefined)
        };
        const res = createResponse();

        const error = new Error('Google authentication timed out.');
        error.status = 504;
        error.code = 'ETIMEDOUT';
        mockAuthService.exchangeCodeForSession.mockRejectedValueOnce(error);

        await handler(req, res);

        expect(res.clearCookie).toHaveBeenCalledTimes(3);
        expect(res.status).toHaveBeenCalledWith(504);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Google authentication timed out.'
        });
    });
});
