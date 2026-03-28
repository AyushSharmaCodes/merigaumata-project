jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../services/photo.service', () => ({
    deletePhotosByUrls: jest.fn(),
    deletePhotoByUrl: jest.fn()
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

jest.mock('../utils/error-messages', () => ({
    getFriendlyMessage: jest.fn((error, statusCode) => error?.message || String(statusCode))
}));

const supabase = require('../config/supabase');

function createQuery(result) {
    const state = {
        eqCalls: [],
        inCalls: []
    };

    const query = {
        select: jest.fn(() => query),
        eq: jest.fn((column, value) => {
            state.eqCalls.push([column, value]);
            return query;
        }),
        in: jest.fn((column, value) => {
            state.inCalls.push([column, value]);
            return query;
        }),
        order: jest.fn(() => query),
        limit: jest.fn(() => query),
        single: jest.fn(() => Promise.resolve(result)),
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

describe('Gallery public visibility', () => {
    let folderRouter;
    let videoRouter;

    beforeAll(() => {
        folderRouter = require('../routes/gallery-folder.routes');
        videoRouter = require('../routes/gallery-video.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('guest folder list only requests active, non-hidden folders', async () => {
        const query = createQuery({
            data: [{ id: 'folder-1', is_active: true, is_hidden: false }],
            error: null
        });
        supabase.from.mockImplementation((table) => {
            expect(table).toBe('gallery_folders');
            return query;
        });

        const response = await invokeRoute(folderRouter, {
            method: 'GET',
            url: '/'
        });

        expect(response.status).toBe(200);
        expect(query.__state.eqCalls).toContainEqual(['is_active', true]);
        expect(query.__state.eqCalls).toContainEqual(['is_hidden', false]);
    });

    test('guest video list is constrained to public folder ids', async () => {
        const folderQuery = createQuery({
            data: [{ id: 'folder-1' }],
            error: null
        });
        const videoQuery = createQuery({
            data: [{ id: 'video-1', folder_id: 'folder-1' }],
            error: null
        });

        supabase.from.mockImplementation((table) => {
            if (table === 'gallery_folders') return folderQuery;
            if (table === 'gallery_videos') return videoQuery;
            throw new Error(`Unexpected table ${table}`);
        });

        const response = await invokeRoute(videoRouter, {
            method: 'GET',
            url: '/'
        });

        expect(response.status).toBe(200);
        expect(videoQuery.__state.inCalls).toContainEqual(['folder_id', ['folder-1']]);
    });
});
