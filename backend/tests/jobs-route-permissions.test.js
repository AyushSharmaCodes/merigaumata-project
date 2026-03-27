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

jest.mock('../services/deletion-job-processor', () => ({
    DeletionJobProcessor: {
        retryJob: jest.fn(),
        processJob: jest.fn()
    }
}));

jest.mock('../services/event-cancellation.service', () => ({
    processPendingJobs: jest.fn()
}));

jest.mock('../services/refund.service', () => ({
    RefundService: {
        normalizeRefundStatus: jest.fn((status) => status)
    }
}));

jest.mock('../utils/background-task', () => ({
    scheduleBackgroundTask: jest.fn()
}));

jest.mock('../config/supabase', () => ({
    from: jest.fn(() => ({
        select: jest.fn(() => ({
            order: jest.fn(() => ({
                range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
            }))
        }))
    }))
}));

function invokeRoute(router, { method, url, headers = {}, query = {} } = {}) {
    return new Promise((resolve, reject) => {
        const req = {
            method,
            url,
            originalUrl: url,
            path: url,
            headers,
            body: {},
            cookies: {},
            query,
            params: {},
            t: jest.fn((key) => key),
            get(name) {
                return this.headers[name.toLowerCase()];
            }
        };

        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                resolve({ status: this.statusCode, body: payload });
                return this;
            },
            send(payload) {
                resolve({ status: this.statusCode, body: payload });
                return this;
            }
        };

        router.handle(req, res, reject);
    });
}

describe('Jobs routes permission wiring', () => {
    let router;

    beforeAll(() => {
        router = require('../routes/jobs.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requires can_manage_background_jobs for manager access', async () => {
        const denied = await invokeRoute(router, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager'
            },
            query: { type: 'ACCOUNT_DELETION' }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_background_jobs'
        });

        const allowed = await invokeRoute(router, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_background_jobs'
            },
            query: { type: 'ACCOUNT_DELETION' }
        });

        expect(allowed.status).toBe(200);
        expect(Array.isArray(allowed.body.jobs)).toBe(true);
    });
});
