const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');
const AnalyticsService = require('../services/analytics.service');

// Middleware to check if user is admin or manager
const isAdmin = authorizeRole('admin', 'manager');

/**
 * GET /api/analytics/dashboard
 * Fetch dashboard statistics with dynamic timeframe filtering.
 * Query params: 
 * - ordersPage: number
 * - ordersLimit: number
 * - revenueTimeframe: 'yearly' | 'monthly' | 'weekly'
 * - orderSummaryTimeframe: 'yearly' | 'monthly' | 'weekly'
 * - categoryTimeframe: 'yearly' | 'monthly' | 'weekly'
 */
router.get('/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { 
            ordersPage, 
            ordersLimit, 
            revenueTimeframe, 
            orderSummaryTimeframe, 
            categoryTimeframe,
            summaryTimeframe,
            scope
        } = req.query;

        const stats = await AnalyticsService.getDashboardStats({ 
            ordersPage: parseInt(ordersPage) || 1, 
            ordersLimit: ordersLimit !== undefined ? parseInt(ordersLimit) : 10,
            revenueTimeframe: revenueTimeframe || 'yearly',
            orderSummaryTimeframe: orderSummaryTimeframe || 'weekly',
            categoryTimeframe: categoryTimeframe || 'monthly',
            summaryTimeframe: summaryTimeframe || 'weekly',
            scope: scope || 'all',
            user: req.user 
        });

        res.json(stats);
    } catch (error) {
        logger.error({ err: error }, 'Dashboard analytics fetch failure');
        res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
});

module.exports = router;
