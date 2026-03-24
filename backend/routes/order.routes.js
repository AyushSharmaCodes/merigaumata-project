const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, checkPermission } = require('../middleware/auth.middleware');
const {
    updateOrderStatus,
    getAllOrders,
    createOrder,
    getOrderById,
    cancelOrder,
    requestReturn,
    getOrderStats
} = require('../services/order.service');
const { RefundService } = require('../services/refund.service');
const logger = require('../utils/logger');
const { getFriendlyMessage, getI18nKey } = require('../utils/error-messages');

// Get orders - Admin/Manager can search, Customer sees own
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await getAllOrders(req.user, req.query);
        res.json({
            success: true,
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        logger.error({ err: error }, 'Get orders error');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get order stats - Admin/Manager Only
router.get('/stats/summary', authenticateToken, checkPermission('can_manage_orders'), async (req, res) => {
    try {
        const stats = await getOrderStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error({ err: error }, 'Get order stats error');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create order - Authenticated users
router.post('/', authenticateToken, async (req, res) => {
    try {
        const orderData = req.body;
        // Fallbacks for user info from Token if not in body
        const userEmail = req.user.email;
        const userName = req.user.full_name;

        const order = await createOrder(req.user.id, orderData, userEmail, userName);
        res.status(201).json(order);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Create order error');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single order by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await getOrderById(req.params.id, req.user);
        res.json(order);
    } catch (error) {
        logger.error({ err: error, orderId: req.params.id }, 'Error fetching order');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update order status - Admin/Manager Only (Requires can_manage_orders)
router.put('/:id/status', authenticateToken, checkPermission('can_manage_orders'), async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    try {
        logger.info({ orderId: id, newStatus: status, userId: req.user.id }, 'Order status update request');

        if (!status) {
            return res.status(400).json({ error: req.t('errors.order.statusRequired') });
        }

        const { success, order, error, status: httpStatus, refundInitiated } = await updateOrderStatus(id, status, req.user.id, notes, req.user.role);

        if (!success) {
            logger.error({ orderId: id, error }, 'Order status update failed');
            return res.status(httpStatus || 500).json({ error });
        }

        // Log refund if initiated
        if (refundInitiated) {
            logger.info({ orderId: id }, 'Refund initiated for order');
        }

        logger.debug({ orderId: id }, 'DB update successful, processing side effects');

        const messageKey = refundInitiated ? 'ORDER_STATUS_UPDATED_REFUND' : 'ORDER_STATUS_UPDATED';

        res.json({
            success: true,
            order,
            refundInitiated: refundInitiated || false,
            message: getI18nKey(messageKey),
            params: { status } // For frontend interpolation
        });
    } catch (error) {
        logger.error({ err: error, orderId: id }, 'Order status update crashed');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

// Sync / Force Refund - Admin/Manager Only
router.post('/:id/sync-refunds', authenticateToken, checkPermission('can_manage_orders'), async (req, res) => {
    const { id } = req.params;
    const { force } = req.body;

    try {
        const result = await RefundService.syncOrderRefunds(id, force === true, req.user.id);
        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        logger.error({ err: error, orderId: id }, 'Order refund sync crashed');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

// Cancel Order - User initiated
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    // Fallbacks
    const userEmail = req.user.email;
    const userName = req.user.full_name;

    try {
        const result = await cancelOrder(id, userId, reason, userEmail, userName);

        const messageKey = result.refundInitiated ? 'ORDER_CANCELLED_REFUND' : 'ORDER_CANCELLED';

        res.json({
            success: true,
            order: result.order,
            refundInitiated: result.refundInitiated || false,
            message: getI18nKey(messageKey)
        });

    } catch (error) {
        logger.error({ err: error, orderId: id }, 'Error cancelling order');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

// Request Return - User initiated
router.post('/:id/return', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { reason, returnItems } = req.body;
    const userId = req.user.id;

    try {
        const order = await requestReturn(id, userId, reason, returnItems);

        res.json({
            success: true,
            order: order,
            message: getI18nKey('RETURN_REQUESTED')
        });

    } catch (error) {
        logger.error({ err: error, orderId: id }, 'Error requesting return');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

module.exports = router;
