const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

/**
 * Admin Notification Routes
 * Handle order notifications for admin users
 */

// Use standard auth middleware
router.use(authenticateToken);
router.use(requireRole('admin'));

// Helper to get user ID
const getUserId = (req) => {
    return req.user?.id;
};

// Get admin notifications
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const { status } = req.query;
        const filters = status ? { status } : {};

        const notifications = await getAdminNotifications(userId, filters);
        res.json(notifications);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching notifications:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const count = await getUnreadCount(userId);
        res.json({ count });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching unread count:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const notification = await markAsRead(req.params.id, userId);
        res.json(notification);
    } catch (error) {
        logger.error({ err: error }, 'Error marking notification as read:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Mark all as read
router.put('/read-all', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const notifications = await markAllAsRead(userId);
        res.json({ count: notifications.length });
    } catch (error) {
        logger.error({ err: error }, 'Error marking all as read:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Archive notification
router.put('/:id/archive', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        const notification = await archiveNotification(req.params.id, userId);
        res.json(notification);
    } catch (error) {
        logger.error({ err: error }, 'Error archiving notification:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
