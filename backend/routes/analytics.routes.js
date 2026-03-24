const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');
const AnalyticsService = require('../services/analytics.service');

// Middleware to check if user is admin or manager
const isAdmin = authorizeRole('admin', 'manager');

/**
 * GET /api/analytics/dashboard
 * Fetch dashboard statistics
 * Query params: ordersPage (default 1), ordersLimit (default 10)
 */
router.get('/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        const ordersPage = parseInt(req.query.ordersPage) || 1;
        const ordersLimit = req.query.ordersLimit !== undefined ? parseInt(req.query.ordersLimit) : 10;
        const stats = await AnalyticsService.getDashboardStats({ ordersPage, ordersLimit, user: req.user });
        res.json(stats);
    } catch (error) {
        logger.error({ err: error }, 'Dashboard analytics error:');
        res.status(500).json({ error: req.t('errors.analytics.fetchFailed') });
    }
});

module.exports = router;
