const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');

/**
 * Download Invoice PDF
 * GET /api/invoices/:id/download
 */
router.get('/:id/download', requireAuth, async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const userId = req.user.id;

        // 1. Fetch invoice meta
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select(`
                *,
                orders ( user_id )
            `)
            .eq('id', invoiceId)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: req.t('errors.invoice.notFound') });
        }

        // 2. Authorization Check
        const isOwner = invoice.orders?.user_id === userId;
        const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: req.t('errors.invoice.unauthorizedAccess') });
        }

        // 3. Serve File
        if (invoice.type === 'RAZORPAY') {
            // Redirect to Razorpay public URL if available
            if (invoice.public_url) {
                return res.redirect(invoice.public_url);
            }
            return res.status(404).json({ error: req.t('errors.invoice.razorpayUrlNotFound') });
        } else {
            // Serve File
            const filename = invoice.invoice_number ? `${invoice.invoice_number}.pdf` : `invoice-${invoiceId}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

            if (invoice.file_path && fs.existsSync(invoice.file_path)) {
                // Option A: Local File
                const fileStream = fs.createReadStream(invoice.file_path);
                fileStream.pipe(res);
            } else if (invoice.storage_path) {
                // Option B: Supabase Storage Proxy (No Redirect, prevents exposing tech stack)
                const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
                    .from('invoices')
                    .download(invoice.storage_path);

                if (downloadError || !fileBlob) {
                    logger.error(`Failed to download invoice ${invoiceId} from storage:`, downloadError);
                    return res.status(500).json({ error: req.t('errors.invoice.storageAccessFailed') });
                }

                // Since download() returns a Blob/File object in some environments or a Buffer-like object,
                // we convert it to a Buffer and then send it.
                const buffer = Buffer.from(await fileBlob.arrayBuffer());
                res.send(buffer);
            } else if (invoice.public_url) {
                // Fallback to public URL (Redirect) - Only if really necessary, 
                // but for masking we should try to avoid this if it's a Supabase URL.
                return res.redirect(invoice.public_url);
            } else {
                logger.error(`Invoice file missing at path: ${invoice.file_path} and no storage_path or public URL available`);
                return res.status(404).json({ error: req.t('errors.invoice.fileNotFound') });
            }
        }

    } catch (err) {
        logger.error('Download Invoice Error:', err);
        res.status(500).json({ error: req.t('errors.system.internalError') });
    }
});

/**
 * Regenerate Order Invoice
 * POST /api/invoices/orders/:id/retry
 */
router.post('/orders/:id/retry', requireAuth, requestLock((req) => `invoice-retry:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const orderId = req.params.id;
        const isAdmin = req.user.roles?.includes('admin') || req.user.role === 'admin';
        const isManager = req.user.roles?.includes('manager') || req.user.role === 'manager';

        if (!isAdmin && !isManager) {
            return res.status(403).json({ error: req.t('errors.auth.unauthorized') });
        }

        const result = await InvoiceOrchestrator.generateInternalInvoice(orderId, { force: true });

        if (result.success) {
            res.json({ success: true, message: req.t('success.invoice.regenerated'), invoiceId: result.invoiceId });
        } else {
            res.status(500).json({ error: result.error || req.t('errors.invoice.regenerationFailed') });
        }
    } catch (err) {
        logger.error('Regenerate Invoice Error:', err);
        res.status(500).json({ error: req.t('errors.system.internalError') });
    }
});

module.exports = router;
