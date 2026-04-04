const { protectCookieAuthMutations } = require('../middleware/csrf.middleware');

describe('protectCookieAuthMutations', () => {
    const createRes = () => ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    });

    const next = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ALLOWED_ORIGINS = 'https://app.example.com';
        process.env.FRONTEND_URL = 'https://app.example.com';
    });

    test('allows safe methods without origin checks', () => {
        const req = {
            method: 'GET',
            cookies: { access_token: 'token' },
            get: jest.fn()
        };
        const res = createRes();

        protectCookieAuthMutations(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test('allows cookie-authenticated mutation from allowed origin', () => {
        const req = {
            method: 'POST',
            originalUrl: '/api/orders/order-1/cancel',
            cookies: { access_token: 'token' },
            get: jest.fn((header) => {
                if (header === 'origin') return 'https://app.example.com';
                return undefined;
            }),
            t: (key) => key
        };
        const res = createRes();

        protectCookieAuthMutations(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test('rejects cookie-authenticated mutation without trusted origin', () => {
        const req = {
            method: 'POST',
            originalUrl: '/api/orders/order-1/cancel',
            cookies: { access_token: 'token' },
            get: jest.fn((header) => {
                if (header === 'origin') return 'https://evil.example.com';
                return undefined;
            }),
            t: (key) => key
        };
        const res = createRes();

        protectCookieAuthMutations(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'CSRF_ORIGIN_MISMATCH'
        }));
    });

    test('does not enforce csrf checks for bearer-token style requests without cookies', () => {
        const req = {
            method: 'POST',
            originalUrl: '/api/orders/order-1/cancel',
            cookies: {},
            get: jest.fn()
        };
        const res = createRes();

        protectCookieAuthMutations(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
