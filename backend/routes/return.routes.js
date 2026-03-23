const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const returnService = require('../services/return.service');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

/**
 * GET /api/returns/orders/:orderId/all
 * Get all return requests for a specific order (Admin/User)
 */
router.get('/orders/:orderId/all', authenticateToken, async (req, res) => {
    try {
        const returns = await returnService.getOrderReturnRequests(req.params.orderId);
        res.json(returns);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/cancel
 * User: Cancel a return request (only if status is 'requested')
 */
router.post('/:returnId/cancel', authenticateToken, async (req, res) => {
    try {
        await returnService.cancelReturnRequest(req.params.returnId, req.user.id);
        res.json({ message: req.t('success.return.cancelled') });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/status
 * Admin: Update return status (e.g., mark as picked_up)
 */
router.post('/:returnId/status', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { status, notes } = req.body;
        await returnService.updateReturnStatus(req.params.returnId, status, req.user.id, notes);
        res.json({ message: req.t('success.return.statusUpdated', { status }) });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/items/:returnItemId/status
 * Admin: Update status of a specific return item (triggers refund on 'item_returned')
 */
router.post('/items/:returnItemId/status', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { status, notes } = req.body;
        await returnService.updateReturnItemStatus(req.params.returnItemId, status, req.user.id, notes);
        res.json({ message: req.t('success.return.itemStatusUpdated', { status }) });
    } catch (error) {
        logger.error({ err: error, returnItemId: req.params.returnItemId, body: req.body }, 'Failed to update return item status');
        const msg = error.message || error.details || error.hint || JSON.stringify(error);
        res.status(400).json({ error: msg });
    }
});

/**
 * POST /api/returns/item-status  (COMPATIBILITY ALIAS)
 * Admin: Same as above but accepts returnItemId in the body instead of the URL.
 * This route handles legacy/stale clients that call /api/return-requests/item-status.
 */
router.post('/item-status', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { returnItemId, itemId, status, notes } = req.body;
        const id = returnItemId || itemId;
        if (!id) {
            return res.status(400).json({ error: 'returnItemId is required in request body' });
        }
        logger.warn({ returnItemId: id, url: req.originalUrl }, 'COMPAT: flat /item-status route hit — client should use /items/:id/status');
        await returnService.updateReturnItemStatus(id, status, req.user.id, notes);
        res.json({ message: req.t('success.return.itemStatusUpdated', { status }) });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


/**
 * GET /api/returns/orders/:orderId/items
 * Get eligible items for return for a specific order
 */
router.get('/orders/:orderId/items', authenticateToken, async (req, res) => {
    try {
        const items = await returnService.getReturnableItems(req.params.orderId, req.user.id);
        res.json(items);
    } catch (error) {
        console.error("DEBUG_HOOK_RETURNABLE_ITEMS_ERROR_RAW:", error);
        logger.error({ err: error, orderId: req.params.orderId, userId: req.user.id }, "DEBUG_HOOK_RETURNABLE_ITEMS_ERROR");
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/request
 * Submit a partial return request
 */
router.post('/request', authenticateToken, async (req, res) => {
    try {
        const { orderId, items, reason } = req.body;
        // items: [{ orderItemId, quantity }]

        if (!orderId || !items || items.length === 0) {
            return res.status(400).json({ error: req.t('errors.return.invalidData') });
        }

        const returnRequest = await returnService.createReturnRequest(req.user.id, orderId, items, reason);
        res.json({ message: req.t('success.return.submitted'), returnRequest });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/approve
 * Admin: Approve return and trigger refund
 */
router.post('/:returnId/approve', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const result = await returnService.processReturnApproval(req.params.returnId, req.user.id);
        res.json({ message: req.t('success.return.approved'), ...result });
    } catch (error) {
        logger.error({ err: error }, 'Approval Error:');
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/reject
 * Admin: Reject return request
 */
router.post('/:returnId/reject', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { reason } = req.body;
        await returnService.processReturnRejection(req.params.returnId, req.user.id, reason);
        res.json({ message: req.t('success.return.rejected') });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
