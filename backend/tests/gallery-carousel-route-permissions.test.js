jest.mock('../lib/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../services/photo.service', () => ({
    deletePhotosByUrls: jest.fn().mockResolvedValue(undefined)
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

function createSingleResultQuery(result) {
    const query = {
        insert: jest.fn(() => query),
        update: jest.fn(() => query),
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        neq: jest.fn(() => Promise.resolve(result)),
        single: jest.fn(() => Promise.resolve(result))
    };

    return query;
}

describe('Gallery and carousel route permission wiring', () => {
    let galleryFolderRouter;
    let carouselRouter;

    beforeAll(() => {
        galleryFolderRouter = require('../routes/gallery-folder.routes');
        carouselRouter = require('../routes/carousel.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('gallery folder creation requires can_manage_gallery', async () => {
        const insertQuery = createSingleResultQuery({
            data: { id: 'folder-1', name: 'Summer', is_active: true },
            error: null
        });
        supabase.from.mockReturnValue(insertQuery);

        const denied = await invokeRoute(galleryFolderRouter, {
            method: 'POST',
            url: '/',
            headers: {
                'x-user-role': 'manager'
            },
            body: { name: 'Summer', slug: 'summer' }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_gallery'
        });
        expect(supabase.from).not.toHaveBeenCalled();

        const allowed = await invokeRoute(galleryFolderRouter, {
            method: 'POST',
            url: '/',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_gallery'
            },
            body: { name: 'Summer', slug: 'summer' }
        });

        expect(allowed.status).toBe(201);
        expect(allowed.body).toEqual({ id: 'folder-1', name: 'Summer', is_active: true });
        expect(supabase.from).toHaveBeenCalledWith('gallery_folders');
    });

    test('setting a gallery folder as carousel requires can_manage_carousel', async () => {
        const resetQuery = createSingleResultQuery({ error: null });
        const updateQuery = createSingleResultQuery({
            data: { id: 'folder-1', is_home_carousel: true },
            error: null
        });

        supabase.from
            .mockReturnValueOnce(resetQuery)
            .mockReturnValueOnce(updateQuery);

        const denied = await invokeRoute(galleryFolderRouter, {
            method: 'PUT',
            url: '/folder-1/set-carousel',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_gallery'
            }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_carousel'
        });

        const allowed = await invokeRoute(galleryFolderRouter, {
            method: 'PUT',
            url: '/folder-1/set-carousel',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_carousel'
            }
        });

        expect(allowed.status).toBe(200);
        expect(allowed.body).toEqual({ id: 'folder-1', is_home_carousel: true });
        expect(supabase.from).toHaveBeenNthCalledWith(1, 'gallery_folders');
        expect(supabase.from).toHaveBeenNthCalledWith(2, 'gallery_folders');
    });

    test('carousel admin endpoints require can_manage_carousel while public list stays open', async () => {
        const publicQuery = {
            select: jest.fn(() => publicQuery),
            eq: jest.fn(() => publicQuery),
            order: jest.fn(() => Promise.resolve({
                data: [{ id: 'slide-1', is_active: true }],
                error: null
            }))
        };

        supabase.from.mockReturnValueOnce(publicQuery);

        const publicResponse = await invokeRoute(carouselRouter, {
            method: 'GET',
            url: '/'
        });

        expect(publicResponse.status).toBe(200);
        expect(publicResponse.body).toEqual([{ id: 'slide-1', is_active: true }]);
        expect(mockAuthenticateToken).not.toHaveBeenCalled();

        const denied = await invokeRoute(carouselRouter, {
            method: 'GET',
            url: '/admin',
            headers: {
                'x-user-role': 'manager'
            }
        });

        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_carousel'
        });
    });
});
