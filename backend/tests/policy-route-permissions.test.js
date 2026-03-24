const mockUploadPolicy = jest.fn((req, res) => {
    res.status(201).json({ ok: true, route: 'policy-upload', policyType: req.body.policyType });
});

const mockGetAllLanguageVersions = jest.fn((req, res) => {
    res.json({ ok: true, route: 'policy-languages', policyType: req.params.policyType });
});

jest.mock('../controllers/policy.controller', () => ({
    uploadPolicy: mockUploadPolicy,
    getAllLanguageVersions: mockGetAllLanguageVersions,
    getPolicyVersion: jest.fn((req, res) => res.json({ version: 1, policyType: req.params.policyType })),
    getPublicPolicy: jest.fn((req, res) => res.json({ policyType: req.params.policyType }))
}));

jest.mock('multer', () => {
    const multer = () => ({
        single: () => (req, _res, next) => {
            req.file = {
                originalname: 'policy.pdf',
                mimetype: 'application/pdf',
                buffer: Buffer.from('fake')
            };
            next();
        }
    });
    multer.memoryStorage = jest.fn(() => ({}));
    return multer;
});

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

function invokeRoute(router, { method, url, headers = {}, body, query = {} } = {}) {
    return new Promise((resolve, reject) => {
        const req = {
            method,
            url,
            originalUrl: url,
            path: url,
            headers,
            body,
            query,
            cookies: {},
            params: {},
            t(key) {
                return key;
            },
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

describe('Policy routes permission wiring', () => {
    let router;

    beforeAll(() => {
        router = require('../routes/policy.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requires can_manage_policies for uploads', async () => {
        const denied = await invokeRoute(router, {
            method: 'POST',
            url: '/upload',
            headers: {
                'x-user-role': 'manager'
            },
            body: { policyType: 'privacy' }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_policies'
        });
        expect(mockUploadPolicy).not.toHaveBeenCalled();

        const allowed = await invokeRoute(router, {
            method: 'POST',
            url: '/upload',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_policies'
            },
            body: { policyType: 'privacy' }
        });

        expect(allowed.status).toBe(201);
        expect(allowed.body).toEqual({
            ok: true,
            route: 'policy-upload',
            policyType: 'privacy'
        });
        expect(mockUploadPolicy).toHaveBeenCalledTimes(1);
    });

    test('requires can_manage_policies for language-version admin view', async () => {
        const denied = await invokeRoute(router, {
            method: 'GET',
            url: '/admin/privacy/languages',
            headers: {
                'x-user-role': 'manager'
            }
        });

        expect(denied.status).toBe(403);
        expect(mockGetAllLanguageVersions).not.toHaveBeenCalled();

        const allowed = await invokeRoute(router, {
            method: 'GET',
            url: '/admin/privacy/languages',
            headers: {
                'x-user-role': 'admin'
            }
        });

        expect(allowed.status).toBe(200);
        expect(allowed.body).toEqual({
            ok: true,
            route: 'policy-languages',
            policyType: 'privacy'
        });
        expect(mockGetAllLanguageVersions).toHaveBeenCalledTimes(1);
    });
});
