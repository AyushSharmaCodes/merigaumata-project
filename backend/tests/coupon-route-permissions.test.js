jest.mock('../lib/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../services/coupon.service', () => ({
    getActiveCoupons: jest.fn().mockResolvedValue([{ id: 'coupon-1', code: 'SAVE10' }]),
    invalidateCouponCache: jest.fn()
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) {
        return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    req.user = {
        id: req.headers['x-user-id'] || 'user-1',
        role
    };
    next();
});

const mockCheckPermission = jest.fn((permissionName) => (req, res, next) => {
    if (req.user?.role === 'admin') {
        return next();
    }

    if (req.user?.role !== 'manager') {
        return res.status(403).json({ error: 'FORBIDDEN', permissionName });
    }

    const permissions = String(req.headers['x-permissions'] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    if (!permissions.includes(permissionName)) {
        return res.status(403).json({ error: 'FORBIDDEN', permissionName });
    }

    next();
});

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: mockAuthenticateToken,
    checkPermission: mockCheckPermission
}));

const supabase = require('../lib/supabase');

function createCouponListQuery(result) {
    const query = {
        select: jest.fn(() => query),
        range: jest.fn(() => query),
        order: jest.fn(() => query),
        eq: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };

    return query;
}

function invokeRoute(router, { method, url, headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const req = {
            method,
            url,
            originalUrl: url,
            path: url,
            headers,
            body,
            cookies: {},
            query: {},
            params: {},
            get(name) {
                return this.headers[name.toLowerCase()];
            }
        };

        const res = {
            statusCode: 200,
            headers: {},
            body: undefined,
            locals: {},
            setHeader(name, value) {
                this.headers[name.toLowerCase()] = value;
            },
            getHeader(name) {
                return this.headers[name.toLowerCase()];
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                resolve({ status: this.statusCode, body: payload });
                return this;
            },
            send(payload) {
                this.body = payload;
                resolve({ status: this.statusCode, body: payload });
                return this;
            },
            end(payload) {
                this.body = payload;
                resolve({ status: this.statusCode, body: payload });
                return this;
            }
        };

        router.handle(req, res, reject);
    });
}

describe('Coupon routes permission wiring', () => {
    let router;

    beforeAll(() => {
        router = require('../routes/coupon.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requires can_manage_coupons for protected coupon list access', async () => {
        supabase.from.mockReturnValue(createCouponListQuery({
            data: [{ id: 'coupon-1', code: 'SAVE10' }],
            count: 1,
            error: null
        }));

        const denied = await invokeRoute(router, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager'
            }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_coupons'
        });
        expect(supabase.from).not.toHaveBeenCalled();

        const allowed = await invokeRoute(router, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_coupons'
            }
        });

        expect(allowed.status).toBe(200);
        expect(allowed.body).toEqual({
            coupons: [{ id: 'coupon-1', code: 'SAVE10' }],
            pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            }
        });
        expect(supabase.from).toHaveBeenCalledWith('coupons');
    });

    test('keeps active coupons public', async () => {
        const response = await invokeRoute(router, {
            method: 'GET',
            url: '/active'
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: 'coupon-1', code: 'SAVE10' }]);
        expect(mockAuthenticateToken).not.toHaveBeenCalled();
    });
});
