jest.mock('../lib/supabase', () => ({
    from: jest.fn(),
    storage: {
        from: jest.fn()
    }
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

jest.mock('../utils/i18n.util', () => ({
    applyTranslations: jest.fn((value) => value)
}));

const supabase = require('../lib/supabase');

function createInsertQuery(result) {
    const query = {
        insert: jest.fn(() => query),
        select: jest.fn(() => query),
        single: jest.fn(() => Promise.resolve(result))
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
            files: undefined,
            file: undefined,
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

describe('About routes permission wiring', () => {
    let router;

    beforeAll(() => {
        router = require('../routes/about.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requires can_manage_about_us for card creation', async () => {
        const query = createInsertQuery({
            data: { id: 'card-1', title: 'Mission', display_order: 1 },
            error: null
        });
        supabase.from.mockReturnValue(query);

        const denied = await invokeRoute(router, {
            method: 'POST',
            url: '/cards',
            headers: {
                'content-type': 'application/json',
                'x-user-role': 'manager'
            },
            body: { title: 'Mission', order: 1 }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_about_us'
        });
        expect(supabase.from).not.toHaveBeenCalled();

        const allowed = await invokeRoute(router, {
            method: 'POST',
            url: '/cards',
            headers: {
                'content-type': 'application/json',
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_about_us'
            },
            body: { title: 'Mission', order: 1 }
        });

        expect(allowed.status).toBe(200);
        expect(allowed.body).toEqual({
            id: 'card-1',
            title: 'Mission',
            display_order: 1,
            order: 1
        });
        expect(supabase.from).toHaveBeenCalledWith('about_cards');
        expect(query.insert).toHaveBeenCalledWith({
            title: 'Mission',
            display_order: 1,
            title_i18n: { en: 'Mission' }
        });
    });
});
