jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
    req.user = { id: 'user-1', role: 'admin' };
    next();
});

const mockCheckPermission = jest.fn(() => (req, res, next) => next());
const mockOptionalAuth = jest.fn((req, res, next) => {
    const role = req.headers['x-user-role'];
    req.user = role ? { id: 'user-1', role } : null;
    next();
});

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: mockAuthenticateToken,
    checkPermission: mockCheckPermission,
    optionalAuth: mockOptionalAuth
}));

jest.mock('../services/photo.service', () => ({
    deletePhotoByUrl: jest.fn()
}));

jest.mock('../utils/error-messages', () => ({
    getFriendlyMessage: jest.fn((error, statusCode) => {
        if (statusCode === 404) return 'NOT_FOUND';
        return error?.message || 'ERROR';
    })
}));

const supabase = require('../config/supabase');

function createQuery(result) {
    const state = {
        eqCalls: []
    };

    const query = {
        select: jest.fn(() => query),
        eq: jest.fn((column, value) => {
            state.eqCalls.push([column, value]);
            return query;
        }),
        ilike: jest.fn(() => query),
        range: jest.fn(() => query),
        order: jest.fn(() => query),
        maybeSingle: jest.fn(() => Promise.resolve(result)),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        __state: state
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
            language: 'en',
            get(name) {
                return this.headers[name.toLowerCase()];
            }
        };

        const res = {
            statusCode: 200,
            body: undefined,
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
            }
        };

        router.handle(req, res, reject);
    });
}

describe('Blog public visibility', () => {
    let router;

    beforeAll(() => {
        router = require('../routes/blog.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('guest list requests are forced to published blogs', async () => {
        const query = createQuery({
            data: [{ id: 'blog-1', title: 'Published', published: true }],
            count: 1,
            error: null
        });
        supabase.from.mockReturnValue(query);

        const response = await invokeRoute(router, {
            method: 'GET',
            url: '/'
        });

        expect(response.status).toBe(200);
        expect(query.__state.eqCalls).toContainEqual(['published', true]);
    });

    test('guest cannot fetch an unpublished blog by id', async () => {
        const query = createQuery({
            data: null,
            error: null
        });
        supabase.from.mockReturnValue(query);

        const response = await invokeRoute(router, {
            method: 'GET',
            url: '/draft-1'
        });

        expect(response.status).toBe(404);
        expect(query.__state.eqCalls).toContainEqual(['published', true]);
    });
});
