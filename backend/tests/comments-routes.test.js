jest.mock('../services/comment.service', () => ({
    updateComment: jest.fn()
}));

jest.mock('../services/moderation.service', () => ({}));

jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: (req, res, next) => next(),
    optionalAuth: (req, res, next) => next()
}));

jest.mock('../middleware/requestLock.middleware', () => ({
    requestLock: () => (req, res, next) => next()
}));

jest.mock('../middleware/idempotency.middleware', () => ({
    idempotency: () => (req, res, next) => next()
}));

jest.mock('../middleware/rateLimit.middleware', () => ({
    checkCommentRateLimit: (req, res, next) => next()
}));

jest.mock('../middleware/validation.middleware', () => ({
    validateCommentInput: (req, res, next) => next(),
    validateFlagInput: (req, res, next) => next()
}));

jest.mock('../middleware/adminOnly.middleware', () => ({
    requireAdminOrManager: (req, res, next) => next()
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

const router = require('../routes/comments.routes');
const commentService = require('../services/comment.service');

function getRouteHandler(path, method) {
    const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('comments routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns 403 when the edit window has expired', async () => {
        commentService.updateComment.mockRejectedValue(new Error('errors.comment.updateFailed'));

        const handler = getRouteHandler('/:id', 'put');
        const req = {
            params: { id: 'comment-1' },
            body: { content: 'Updated content' },
            user: { id: 'user-1' },
            traceId: 'trace-1'
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: 'errors.comment.updateFailed',
            requestId: 'trace-1'
        });
    });
});
