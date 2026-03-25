const express = require('express');
const logger = require('../utils/logger');
const AdminAlertService = require('../services/admin-alert.service');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const router = express.Router();

/**
 * Admin Alert Routes
 */

// Get all unread alerts
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const alerts = await AdminAlertService.getUnreadAlerts();
        res.json(alerts);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching admin alerts:');
        res.status(500).json({ error: req.t('errors.admin.alertsFetchFailed') });
    }
});

// Mark an alert as read (dismiss)
router.put('/:id/read', authenticateToken, requireRole('admin'), requestLock((req) => `admin-alert-read:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const alert = await AdminAlertService.markAsRead(req.params.id);
        res.json(alert);
    } catch (error) {
        logger.error({ err: error, id: req.params.id }, 'Error marking alert as read:');
        res.status(500).json({ error: req.t('errors.admin.alertUpdateFailed') });
    }
});

// Mark all as read
router.put('/read-all', authenticateToken, requireRole('admin'), requestLock('admin-alert-read-all'), idempotency(), async (req, res) => {
    try {
        const alerts = await AdminAlertService.markAllAsRead();
        res.json({ count: (alerts || []).length });
    } catch (error) {
        logger.error({ err: error }, 'Error marking all alerts as read:');
        res.status(500).json({ error: req.t('errors.admin.alertsUpdateFailed') });
    }
});

// Mark as read by reference (e.g. from contact detail page)
router.put('/by-reference/:type/:id/read', authenticateToken, requireRole('admin'), requestLock((req) => `admin-alert-read-ref:${req.params.type}:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        await AdminAlertService.markAsReadByReference(req.params.type, req.params.id);
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error, type: req.params.type, id: req.params.id }, 'Error marking alert as read by reference:');
        res.status(500).json({ error: req.t('errors.system.internalError') });
    }
});

module.exports = router;
