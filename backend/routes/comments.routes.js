const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const commentService = require('../services/comment.service');
const moderationService = require('../services/moderation.service');
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { checkCommentRateLimit } = require('../middleware/rateLimit.middleware');
const { validateCommentInput, validateFlagInput } = require('../middleware/comment-validation.middleware');
const { requireAdminOrManager } = require('../middleware/adminOnly.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// --- Public / Authenticated User Routes ---

/**
 * @route GET /api/comments/:blogId
 * @desc Get comments for a blog post (threaded)
 * @access Public
 */
router.get('/:blogId', optionalAuth, async (req, res) => {
    try {
        const { blogId } = req.params;
        const { page, limit, sortBy } = req.query;

        logger.info({
            blogId,
            page,
            limit,
            sortBy,
            userId: req.user?.id,
            traceId: req.traceId
        }, 'Fetching comments for blog post');

        const result = await commentService.getComments(
            blogId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
            sortBy
        );

        res.json(result);
    } catch (error) {
        logger.error({
            err: error,
            blogId: req.params.blogId,
            traceId: req.traceId
        }, 'Error fetching comments:');
        res.status(500).json({ error: 'Failed to fetch comments', requestId: req.traceId });
    }
});

/**
 * @route POST /api/comments
 * @desc Create a new comment or reply
 * @access Authenticated
 */
router.post('/',
    authenticateToken,
    requestLock('comment-create'),
    idempotency(),
    validateCommentInput,
    checkCommentRateLimit,
    async (req, res) => {
        try {
            const { blogId, content, parentId } = req.body;
            const userId = req.user.id; // Using req.user.id from authenticateToken

            logger.info({
                userId,
                blogId,
                parentId: !!parentId,
                traceId: req.traceId,
                correlationId: req.correlationId
            }, 'Creating new comment');

            const comment = await commentService.createComment(userId, blogId, content, parentId);

            logger.info({
                commentId: comment.id,
                userId,
                traceId: req.traceId
            }, 'Comment created successfully');

            res.status(201).json(comment);
        } catch (error) {
            const status = error.message.includes('Parent comment not found')
                || error.message.includes('same blog post')
                || error.message.includes('no longer active')
                ? 400
                : 500;

            logger.error({
                err: error,
                userId: req.user?.id,
                traceId: req.traceId
            }, 'Error creating comment:');
            res.status(status).json({
                error: getFriendlyMessage(error, status),
                requestId: req.traceId
            });
        }
    }
);

/**
 * @route PUT /api/comments/:id
 * @desc Update a comment (owner only, 15m limit)
 * @access Authenticated
 */
router.put('/:id', authenticateToken, requestLock((req) => `comment-update:${req.params.id}`), idempotency(), validateCommentInput, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        logger.info({
            commentId: id,
            userId,
            traceId: req.traceId
        }, 'Attempting to update comment');

        const comment = await commentService.updateComment(id, userId, content);

        logger.info({
            commentId: id,
            userId,
            traceId: req.traceId
        }, 'Comment updated successfully');

        res.json(comment);
    } catch (error) {
        const status = error.message === 'errors.comment.updateFailed'
            || error.message.includes('Unauthorized')
            || error.message.includes('Time limit')
            ? 403
            : 500;
        const friendlyMessage = getFriendlyMessage(error, status);

        logger.warn({
            err: error.message,
            commentId: req.params.id,
            userId: req.user?.id,
            traceId: req.traceId
        }, 'Failed to update comment');

        res.status(status).json({
            error: friendlyMessage,
            requestId: req.traceId
        });
    }
});

/**
 * @route DELETE /api/comments/:id
 * @desc Soft delete a comment (owner or admin/manager)
 * @access Authenticated
 */
router.delete('/:id', authenticateToken, requestLock((req) => `comment-delete:${req.params.id}`), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        logger.info({
            commentId: id,
            userId,
            userRole,
            traceId: req.traceId
        }, 'Attempting to delete comment');

        let token = req.headers.authorization;
        if (!token && req.cookies && req.cookies.access_token) {
            token = `Bearer ${req.cookies.access_token}`;
        }

        logger.info({
            msg: 'Token resolution for delete',
            hasToken: !!token,
            isHeader: !!req.headers.authorization,
            isCookie: !!req.cookies?.access_token
        });

        const comment = await commentService.deleteComment(id, userId, userRole, token);

        logger.info({
            commentId: id,
            deletedBy: userId,
            traceId: req.traceId
        }, req.t('success.comments.deleted'));

        res.json({ message: req.t('success.comments.deleted'), comment });
    } catch (error) {
        const status = error.message.includes('Unauthorized') ? 403 : 500;
        const friendlyMessage = getFriendlyMessage(error, status);

        logger.warn({
            err: error.message,
            commentId: req.params.id,
            userId: req.user?.id,
            traceId: req.traceId
        }, 'Failed to delete comment');

        res.status(status).json({
            error: friendlyMessage,
            requestId: req.traceId
        });
    }
});

/**
 * @route POST /api/comments/:id/flag
 * @desc Flag a comment for moderation
 * @access Authenticated
 */
router.post('/:id/flag', authenticateToken, requestLock((req) => `comment-flag:${req.params.id}`), idempotency(), validateFlagInput, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, details } = req.body;
        const userId = req.user.id;

        logger.info({
            commentId: id,
            flaggerId: userId,
            reason,
            traceId: req.traceId
        }, 'Flagging comment');

        const flag = await commentService.flagComment(id, userId, reason, details);

        logger.info({
            flagId: flag.id,
            commentId: id,
            traceId: req.traceId
        }, req.t('success.comments.flagged'));

        res.status(201).json({ message: req.t('success.comments.flagged'), flag });
    } catch (error) {
        const status = error.message.includes('already flagged') ? 400 : 500;
        const friendlyMessage = getFriendlyMessage(error, status);

        logger.error({
            err: error,
            commentId: req.params.id,
            userId: req.user?.id,
            traceId: req.traceId
        }, 'Error flagging comment');

        res.status(status).json({
            error: friendlyMessage,
            requestId: req.traceId
        });
    }
});

// --- Admin / Manager Routes ---

/**
 * @route GET /api/comments/admin/flagged
 * @desc Get all flagged comments (Admin only)
 * @access Authenticated, Admin/Manager
 */
router.get('/admin/flagged', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { page, limit, status } = req.query;

        logger.info({
            adminId: req.user.id,
            page,
            limit,
            status,
            traceId: req.traceId
        }, 'Admin: Fetching flagged comments');

        const result = await moderationService.getFlaggedComments(
            parseInt(page) || 1,
            parseInt(limit) || 20,
            status
        );
        res.json(result);
    } catch (error) {
        logger.error({
            err: error,
            adminId: req.user?.id,
            traceId: req.traceId
        }, 'Admin: Error fetching flagged comments');
        res.status(500).json({ error: 'Failed to fetch flagged comments', requestId: req.traceId });
    }
});

/**
 * @route POST /api/comments/:id/approve
 * @desc Clear flags from a comment
 * @access Authenticated, Admin/Manager
 */
router.post('/:id/approve', authenticateToken, requireAdminOrManager, requestLock((req) => `comment-approve:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        logger.info({
            commentId: id,
            adminId,
            traceId: req.traceId
        }, 'Admin: Approving comment');

        const comment = await moderationService.approveComment(id, adminId);
        res.json({ message: req.t('success.comments.approved'), comment });
    } catch (error) {
        logger.error({
            err: error,
            commentId: req.params.id,
            adminId: req.user?.id,
            traceId: req.traceId
        }, 'Admin: Error approving comment');
        res.status(500).json({ error: 'Failed to approve comment', requestId: req.traceId });
    }
});

/**
 * @route POST /api/comments/:id/hide
 * @desc Hide a comment from public (Admin only)
 * @access Authenticated, Admin/Manager
 */
router.post('/:id/hide', authenticateToken, requireAdminOrManager, requestLock((req) => `comment-hide:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        logger.info({
            commentId: id,
            adminId,
            traceId: req.traceId
        }, 'Admin: Hiding comment');

        const comment = await moderationService.hideComment(id, adminId);
        res.json({ message: req.t('success.comments.hidden'), comment });
    } catch (error) {
        logger.error({
            err: error,
            commentId: req.params.id,
            adminId: req.user?.id,
            traceId: req.traceId
        }, 'Admin: Error hiding comment');
        res.status(500).json({ error: 'Failed to hide comment', requestId: req.traceId });
    }
});

/**
 * @route POST /api/comments/:id/restore
 * @desc Restore a hidden/deleted comment
 * @access Authenticated, Admin/Manager
 */
router.post('/:id/restore', authenticateToken, requireAdminOrManager, requestLock((req) => `comment-restore:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        logger.info({
            commentId: id,
            adminId,
            traceId: req.traceId
        }, 'Admin: Restoring comment');

        const comment = await moderationService.restoreComment(id, adminId);
        res.json({ message: req.t('success.comments.restored'), comment });
    } catch (error) {
        logger.error({
            err: error,
            commentId: req.params.id,
            adminId: req.user?.id,
            traceId: req.traceId
        }, 'Admin: Error restoring comment');
        res.status(500).json({ error: 'Failed to restore comment', requestId: req.traceId });
    }
});

/**
 * @route DELETE /api/comments/:id/permanent
 * @desc Permanently delete a comment from DB
 * @access Authenticated, Admin/Manager
 */
router.delete('/:id/permanent', authenticateToken, requireAdminOrManager, requestLock((req) => `comment-delete-permanent:${req.params.id}`), async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        logger.info({
            commentId: id,
            adminId,
            traceId: req.traceId
        }, 'Admin: Permanently deleting comment');

        await moderationService.deleteCommentPermanently(id, adminId);
        res.json({ message: req.t('success.comments.permanentlyDeleted') });
    } catch (error) {
        logger.error({
            err: error,
            commentId: req.params.id,
            adminId: req.user?.id,
            traceId: req.traceId
        }, 'Admin: Error permanently deleting comment');
        res.status(500).json({ error: 'Failed to delete comment permanently', requestId: req.traceId });
    }
});

/**
 * @route GET /api/comments/:id/history
 * @desc Get moderation history for a comment
 * @access Authenticated, Admin/Manager
 */
router.get('/:id/history', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { id } = req.params;

        logger.info({
            commentId: id,
            traceId: req.traceId
        }, 'Admin: Fetching moderation history');

        const history = await moderationService.getModerationHistory(id);
        res.json(history);
    } catch (error) {
        logger.error({
            err: error,
            commentId: req.params.id,
            adminId: req.user?.id,
            traceId: req.traceId
        }, 'Admin: Error fetching moderation history');
        res.status(500).json({ error: 'Failed to fetch moderation history', requestId: req.traceId });
    }
});

module.exports = router;

module.exports = router;
