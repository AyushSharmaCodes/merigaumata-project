const mockSupabase = {
    from: jest.fn(),
    storage: {
        from: jest.fn()
    }
};

const mockSupabaseAdmin = {
    from: jest.fn(),
    storage: {
        from: jest.fn()
    }
};

jest.mock('../config/supabase', () => ({
    supabase: mockSupabase,
    supabaseAdmin: mockSupabaseAdmin
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

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: mockAuthenticateToken
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
            },
            t(key) {
                return key;
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

function createManagerPermissionsQuery(data) {
    const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        single: jest.fn(() => Promise.resolve({
            data,
            error: data ? null : { message: 'not found' }
        })),
        maybeSingle: jest.fn(() => Promise.resolve({
            data,
            error: data ? null : { message: 'not found' }
        }))
    };

    return query;
}

describe('Upload delete route permission wiring', () => {
    let uploadRouter;

    beforeAll(() => {
        uploadRouter = require('../routes/upload.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delete-by-url blocks managers without bucket permission before touching storage', async () => {
        mockSupabaseAdmin.from.mockReturnValueOnce(createManagerPermissionsQuery({
            is_active: true,
            can_manage_gallery: false,
            can_manage_about_us: false,
            can_manage_events: false,
            can_manage_blogs: false,
            can_manage_testimonials: false,
            can_manage_products: false,
            can_manage_carousel: false
        }));

        const response = await invokeRoute(uploadRouter, {
            method: 'DELETE',
            url: '/by-url',
            headers: {
                'x-user-role': 'manager',
                'x-user-id': 'manager-1'
            },
            body: {
                url: 'https://example.supabase.co/storage/v1/object/public/images/products/item-1.jpg'
            }
        });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'errors.auth.forbidden' });
        expect(mockSupabaseAdmin.storage.from).not.toHaveBeenCalled();
    });

    test('delete-by-id allows managers with matching bucket permission', async () => {
        mockSupabaseAdmin.from
            .mockReturnValueOnce(createManagerPermissionsQuery({
                is_active: true,
                can_manage_gallery: true,
                can_manage_about_us: false,
                can_manage_events: false,
                can_manage_blogs: false,
                can_manage_testimonials: false,
                can_manage_products: false,
                can_manage_carousel: false
            }))
            .mockReturnValueOnce({
                select: jest.fn(function () { return this; }),
                eq: jest.fn(function () { return this; }),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        image_path: 'folder/file.jpg',
                        bucket_name: 'gallery'
                    },
                    error: null
                })
            })
            .mockReturnValueOnce({
                delete: jest.fn(function () { return this; }),
                eq: jest.fn().mockResolvedValue({ error: null })
            });

        mockSupabaseAdmin.storage.from.mockReturnValue({
            remove: jest.fn().mockResolvedValue({ error: null })
        });

        const response = await invokeRoute(uploadRouter, {
            method: 'DELETE',
            url: '/photo-1',
            headers: {
                'x-user-role': 'manager',
                'x-user-id': 'manager-1'
            }
        });

        expect(response.status).toBe(204);
        expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith('gallery');
    });
});
