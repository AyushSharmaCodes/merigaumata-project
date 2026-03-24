const mockReturnService = {
    getOrderReturnRequests: jest.fn(),
    cancelReturnRequest: jest.fn(),
    updateReturnStatus: jest.fn().mockResolvedValue(undefined),
    updateReturnItemStatus: jest.fn().mockResolvedValue(undefined),
    getReturnableItems: jest.fn(),
    createReturnRequest: jest.fn(),
    processReturnApproval: jest.fn().mockResolvedValue({ refundId: 'refund-1' }),
    processReturnRejection: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../services/return.service', () => mockReturnService);

const mockReviewService = {
    getProductReviews: jest.fn(),
    getAllReviews: jest.fn().mockResolvedValue({ reviews: [{ id: 'review-1' }], total: 1 }),
    createReview: jest.fn(),
    deleteReview: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../services/review.service', () => mockReviewService);
jest.mock('../middleware/validate.middleware', () => jest.fn(() => (req, res, next) => next()));
jest.mock('../schemas/review.schema', () => ({
    createReviewSchema: {}
}));

const mockSupabase = {
    from: jest.fn()
};

jest.mock('../config/supabase', () => mockSupabase);

const mockOptionalAuth = jest.fn((req, res, next) => {
    const role = req.headers['x-user-role'];
    req.user = role
        ? { id: req.headers['x-user-id'] || 'user-1', role, email: req.headers['x-user-email'] || 'user@example.com' }
        : null;
    next();
});

const mockAuthenticateToken = jest.fn((req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) {
        return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    req.user = {
        id: req.headers['x-user-id'] || 'user-1',
        role,
        email: req.headers['x-user-email'] || 'user@example.com',
        name: req.headers['x-user-name']
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
    requireRole: jest.fn(),
    checkPermission: mockCheckPermission,
    optionalAuth: mockOptionalAuth
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
            get(name) {
                return this.headers[name.toLowerCase()];
            },
            t(key, values) {
                return values?.status ? `${key}:${values.status}` : key;
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

function createTestimonialsListQuery(result) {
    const query = {
        select: jest.fn(() => query),
        order: jest.fn(() => query),
        eq: jest.fn(() => query),
        limit: jest.fn(() => Promise.resolve(result)),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };

    return query;
}

describe('Returns, reviews, and testimonials route permission wiring', () => {
    let returnRouter;
    let reviewRouter;
    let testimonialRouter;

    beforeAll(() => {
        returnRouter = require('../routes/return.routes');
        reviewRouter = require('../routes/review.routes');
        testimonialRouter = require('../routes/testimonial.routes');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('return approval and status updates require can_manage_orders', async () => {
        const deniedApproval = await invokeRoute(returnRouter, {
            method: 'POST',
            url: '/return-1/approve',
            headers: {
                'x-user-role': 'manager'
            }
        });

        expect(deniedApproval.status).toBe(403);
        expect(deniedApproval.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_orders'
        });
        expect(mockReturnService.processReturnApproval).not.toHaveBeenCalled();

        const allowedApproval = await invokeRoute(returnRouter, {
            method: 'POST',
            url: '/return-1/approve',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_orders',
                'x-user-id': 'manager-1'
            }
        });

        expect(allowedApproval.status).toBe(200);
        expect(allowedApproval.body).toEqual({
            message: 'success.return.approved',
            refundId: 'refund-1'
        });
        expect(mockReturnService.processReturnApproval).toHaveBeenCalledWith('return-1', 'manager-1');

        const deniedStatus = await invokeRoute(returnRouter, {
            method: 'POST',
            url: '/return-1/status',
            headers: {
                'x-user-role': 'manager'
            },
            body: { status: 'picked_up' }
        });

        expect(deniedStatus.status).toBe(403);

        const allowedItemStatus = await invokeRoute(returnRouter, {
            method: 'POST',
            url: '/items/item-1/status',
            headers: {
                'x-user-role': 'admin',
                'x-user-id': 'admin-1'
            },
            body: { status: 'item_returned', notes: 'received' }
        });

        expect(allowedItemStatus.status).toBe(200);
        expect(allowedItemStatus.body).toEqual({
            message: 'success.return.itemStatusUpdated:item_returned'
        });
        expect(mockReturnService.updateReturnItemStatus).toHaveBeenCalledWith('item-1', 'item_returned', 'admin-1', 'received');
    });

    test('review admin routes require can_manage_reviews while public product reviews stay open', async () => {
        mockReviewService.getProductReviews.mockResolvedValueOnce({
            reviews: [{ id: 'public-review-1' }],
            pagination: { page: 1, limit: 5, total: 1 }
        });

        const publicResponse = await invokeRoute(reviewRouter, {
            method: 'GET',
            url: '/product/prod-1',
            query: { page: '1', limit: '5' }
        });

        expect(publicResponse.status).toBe(200);
        expect(publicResponse.body).toEqual({
            reviews: [{ id: 'public-review-1' }],
            pagination: { page: 1, limit: 5, total: 1 }
        });
        expect(mockAuthenticateToken).not.toHaveBeenCalled();

        const deniedList = await invokeRoute(reviewRouter, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager'
            }
        });

        expect(deniedList.status).toBe(403);
        expect(deniedList.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_reviews'
        });

        const allowedDelete = await invokeRoute(reviewRouter, {
            method: 'DELETE',
            url: '/review-1',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_reviews'
            }
        });

        expect(allowedDelete.status).toBe(200);
        expect(allowedDelete.body).toEqual({
            success: true,
            message: 'success.review.deleted'
        });
        expect(mockReviewService.deleteReview).toHaveBeenCalledWith('review-1');
    });

    test('testimonial admin list and moderation require staff plus can_manage_testimonials', async () => {
        const publicQuery = createTestimonialsListQuery({
            data: [{ id: 't-1', approved: true }],
            error: null
        });
        const adminQuery = createTestimonialsListQuery({
            data: [{ id: 't-2', approved: false }],
            error: null
        });
        const deleteQuery = {
            delete: jest.fn(() => deleteQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        mockSupabase.from
            .mockReturnValueOnce(publicQuery)
            .mockReturnValueOnce(adminQuery)
            .mockReturnValueOnce(deleteQuery);

        const publicList = await invokeRoute(testimonialRouter, {
            method: 'GET',
            url: '/',
            query: {}
        });

        expect(publicList.status).toBe(200);
        expect(publicList.body).toEqual([{ id: 't-1', approved: true }]);
        expect(publicQuery.eq).toHaveBeenCalledWith('approved', true);

        const adminList = await invokeRoute(testimonialRouter, {
            method: 'GET',
            url: '/',
            headers: {
                'x-user-role': 'manager'
            },
            query: { isAdmin: 'true' }
        });

        expect(adminList.status).toBe(200);
        expect(adminList.body).toEqual([{ id: 't-2', approved: false }]);
        expect(adminQuery.eq).not.toHaveBeenCalledWith('approved', true);

        const deniedDelete = await invokeRoute(testimonialRouter, {
            method: 'DELETE',
            url: '/t-2',
            headers: {
                'x-user-role': 'manager'
            }
        });

        expect(deniedDelete.status).toBe(403);
        expect(deniedDelete.body).toEqual({
            error: 'FORBIDDEN',
            permissionName: 'can_manage_testimonials'
        });

        const allowedDelete = await invokeRoute(testimonialRouter, {
            method: 'DELETE',
            url: '/t-2',
            headers: {
                'x-user-role': 'manager',
                'x-permissions': 'can_manage_testimonials'
            }
        });

        expect(allowedDelete.status).toBe(204);
        expect(deleteQuery.delete).toHaveBeenCalled();
    });
});
