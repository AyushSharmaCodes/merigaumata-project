const mockAuthService = {
    refreshToken: jest.fn(),
    getUserProfile: jest.fn(),
    logout: jest.fn()
};

jest.mock('../services/auth.service', () => mockAuthService);

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: jest.fn((req, res, next) => next()),
    invalidateAuthCache: jest.fn(),
    optionalAuth: jest.fn((req, res, next) => next())
}));

jest.mock('../middleware/validate.middleware', () => (schema, source = 'body') => (req, res, next) => next());

jest.mock('../lib/supabase', () => ({
    supabase: { from: jest.fn() },
    supabaseAdmin: { from: jest.fn() }
}));

jest.mock('../utils/error-messages', () => ({
    getFriendlyMessage: jest.fn((error) => error.message || 'friendly-error')
}));

const authRoutes = require('../routes/auth.routes');
const { AUTH, SYSTEM } = require('../constants/messages');

function getRouteHandler(path, method) {
    const layer = authRoutes.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
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

describe('auth.routes session handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'development';
        process.env.FRONTEND_URL = 'http://localhost:5173';
    });

    test('POST /refresh sets auth cookies and returns user data on success', async () => {
        const handler = getRouteHandler('/refresh', 'post');
        const req = {
            cookies: { refresh_token: 'opaque-refresh-token' },
            headers: { 'user-agent': 'jest-agent' },
            ip: '127.0.0.1'
        };
        const res = createResponse();

        mockAuthService.refreshToken.mockResolvedValue({
            userId: 'user-123',
            tokens: {
                access_token: 'new-access-token',
                refresh_token: 'opaque-refresh-token'
            }
        });
        mockAuthService.getUserProfile.mockResolvedValue({
            id: 'user-123',
            email: 'user@example.com',
            role: 'customer'
        });

        await handler(req, res);

        expect(mockAuthService.refreshToken).toHaveBeenCalledWith('opaque-refresh-token', {
            ipAddress: '127.0.0.1',
            userAgent: 'jest-agent'
        });
        expect(res.cookie).toHaveBeenCalledTimes(3);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: AUTH.AUTH_TOKEN_REFRESHED,
            user: expect.objectContaining({ id: 'user-123' }),
            tokens: expect.objectContaining({ access_token: 'new-access-token' })
        }));
    });

    test('POST /refresh clears cookies on 401 auth failure', async () => {
        const handler = getRouteHandler('/refresh', 'post');
        const req = {
            cookies: { refresh_token: 'bad-token' },
            headers: { 'user-agent': 'jest-agent' },
            ip: '127.0.0.1'
        };
        const res = createResponse();
        const error = new Error(AUTH.INVALID_REFRESH_TOKEN);
        error.status = 401;

        mockAuthService.refreshToken.mockRejectedValue(error);

        await handler(req, res);

        expect(res.clearCookie).toHaveBeenCalledTimes(3);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: AUTH.SESSION_EXPIRED_PLEASE_LOGIN,
            reason: 'unauthorized'
        }));
    });

    test('POST /refresh does not clear cookies on 500 service failure', async () => {
        const handler = getRouteHandler('/refresh', 'post');
        const req = {
            cookies: { refresh_token: 'opaque-refresh-token' },
            headers: { 'user-agent': 'jest-agent' },
            ip: '127.0.0.1'
        };
        const res = createResponse();
        const error = new Error('database unavailable');
        error.status = 500;

        mockAuthService.refreshToken.mockRejectedValue(error);

        await handler(req, res);

        expect(res.clearCookie).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: SYSTEM.INTERNAL_ERROR,
            reason: 'service_error'
        }));
    });

    test('POST /refresh does not clear cookies on 409 concurrent refresh failure', async () => {
        const handler = getRouteHandler('/refresh', 'post');
        const req = {
            cookies: { refresh_token: 'opaque-refresh-token' },
            headers: { 'user-agent': 'jest-agent' },
            ip: '127.0.0.1'
        };
        const res = createResponse();
        const error = new Error('A similar operation is already in progress. Please wait for it to complete.');
        error.status = 409;

        mockAuthService.refreshToken.mockRejectedValue(error);

        await handler(req, res);

        expect(res.clearCookie).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'concurrent_refresh'
        }));
    });

    test('POST /refresh records missing cookie failures', async () => {
        const handler = getRouteHandler('/refresh', 'post');
        const req = {
            cookies: {},
            headers: { 'user-agent': 'jest-agent' },
            ip: '127.0.0.1'
        };
        const res = createResponse();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'missing_refresh_token'
        }));
    });

    test('POST /logout clears cookies even if logout service throws', async () => {
        const handler = getRouteHandler('/logout', 'post');
        const req = {
            cookies: {
                access_token: 'access-token',
                refresh_token: 'refresh-token'
            },
            user: { id: 'user-123' }
        };
        const res = createResponse();

        mockAuthService.logout.mockRejectedValue(new Error('network issue'));

        await handler(req, res);

        expect(mockAuthService.logout).toHaveBeenCalledWith('access-token', 'refresh-token');
        expect(res.clearCookie).toHaveBeenCalledTimes(3);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: AUTH.LOGOUT_SUCCESS
        });
    });
});
