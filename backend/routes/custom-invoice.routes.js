const express = require('express');
const router = express.Router();
const CustomInvoiceService = require('../services/custom-invoice.service');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * POST /api/custom-invoices/:orderId/generate
 * Generate a manual GST or Non-GST invoice
 * Body: { type: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' }
 */
router.post('/:orderId/generate', requireAuth, async (req, res) => {
    const { orderId } = req.params;
    const { type } = req.body;

    if (!['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(type)) {
        return res.status(400).json({ error: req.t('errors.invoice.invalidType') });
    }

    try {
        // 1. Fetch order for authorization check
        const { data: order, error } = await supabase
            .from('orders')
            .select('user_id, status')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: req.t('errors.order.notFound') });
        }

        // 2. Authorization: Admin/Manager OR Owner
        const isAdminOrManager = ['admin', 'manager'].includes(req.user.role);
        const isOwner = req.user.id === order.user_id;

        if (!isAdminOrManager && !isOwner) {
            return res.status(403).json({ error: req.t('errors.auth.unauthorized') });
        }

        // 3. Status check
        if (order.status !== 'delivered') {
            return res.status(400).json({ error: req.t('errors.invoice.deliveredOrdersOnly') });
        }

        // 4. Generate
        const result = await CustomInvoiceService.generateCustomInvoice(orderId, type);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json({ error: result.error });
        }

    } catch (error) {
        logger.error({ err: error, orderId }, 'Custom invoice generation route error');
        res.status(500).json({ error: req.t('errors.system.internalError') });
    }
});

module.exports = router;
