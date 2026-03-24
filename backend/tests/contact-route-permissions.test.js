const mockGetMessages = jest.fn((req, res) => {
    res.json({ ok: true, route: 'contact-messages' });
});
const mockGetMessageDetail = jest.fn((req, res) => {
    res.json({ ok: true, route: 'contact-message-detail', id: req.params.id });
});
const mockUpdateMessageStatus = jest.fn((req, res) => {
    res.json({ ok: true, route: 'contact-message-status', id: req.params.id });
});

jest.mock('../controllers/contact.controller', () => ({
    submitContactForm: jest.fn((req, res) => res.status(201).json({ ok: true, route: 'contact-submit' })),
    getMessages: mockGetMessages,
    getMessageDetail: mockGetMessageDetail,
    updateMessageStatus: mockUpdateMessageStatus
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

describe('Contact routes permission wiring', () => {
    let router;

    beforeAll(() => {
        router = require('../routes/contact.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requires can_manage_contact_messages for admin contact list', async () => {
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
            permissionName: 'can_manage_contact_messages'
        });
        expect(mockGetMessages).not.toHaveBeenCalled();

        const allowed = await invokeRoute(router, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_contact_messages'
            }
        });

        expect(allowed.status).toBe(200);
        expect(allowed.body).toEqual({
            ok: true,
            route: 'contact-messages'
        });
        expect(mockGetMessages).toHaveBeenCalledTimes(1);
    });

    test('uses the same permission gate for status updates', async () => {
        const denied = await invokeRoute(router, {
            method: 'PATCH',
            url: '/msg-1/status',
            headers: {
                'content-type': 'application/json',
                'x-user-role': 'manager'
            },
            body: { status: 'READ' }
        });

        expect(denied.status).toBe(403);
        expect(mockUpdateMessageStatus).not.toHaveBeenCalled();

        const allowed = await invokeRoute(router, {
            method: 'PATCH',
            url: '/msg-1/status',
            headers: {
                'content-type': 'application/json',
                'x-user-role': 'admin'
            },
            body: { status: 'READ' }
        });

        expect(allowed.status).toBe(200);
        expect(allowed.body).toEqual({
            ok: true,
            route: 'contact-message-status',
            id: 'msg-1'
        });
        expect(mockUpdateMessageStatus).toHaveBeenCalledTimes(1);
    });
});
