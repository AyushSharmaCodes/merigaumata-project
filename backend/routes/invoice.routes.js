const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const MemoryStore = require('../lib/store/memory.store');

// Short-lived one-time download tokens (TTL: 60 seconds)
// Each token is single-use and scoped to a specific invoiceId.
const downloadTokenStore = new MemoryStore();

const TOKEN_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Issue a one-time download token for an invoice.
 * The frontend fetches this via authenticated apiClient, then opens:
 *   window.open('/api/invoices/:id/download?token=xxx')
 * This keeps the Supabase URL completely hidden from the browser.
 * GET /api/invoices/:id/download-token
 */
router.get('/:id/download-token', requireAuth, async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const userId = req.user.id;

        // 1. Fetch invoice meta to verify it exists and the user owns it
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('id, type, orders ( user_id )')
            .eq('id', invoiceId)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: req.t('errors.invoice.notFound') });
        }

        // 2. Authorization check
        const isOwner = invoice.orders?.user_id === userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: req.t('errors.invoice.unauthorizedAccess') });
        }

        // 3. Issue single-use token
        const token = crypto.randomBytes(24).toString('hex');
        await downloadTokenStore.set(token, { invoiceId, userId }, TOKEN_TTL_MS);

        return res.json({ token, expiresInSeconds: TOKEN_TTL_MS / 1000 });

    } catch (err) {
        logger.error('Issue Download Token Error:', err);
        res.status(500).json({ error: req.t('errors.system.internalError') });
    }
});


/**
 * Download Invoice PDF
 * GET /api/invoices/:id/download
 */
router.get('/:id/download', async (req, res) => {
    try {
        const invoiceId = req.params.id;
        let authorizedUserId = null;

        // --- AUTH: Accept either a one-time download token OR the standard session ---
        const queryToken = req.query.token;
        if (queryToken) {
            // One-time token path (used by window.open)
            const tokenData = await downloadTokenStore.get(queryToken);
            if (!tokenData || tokenData.invoiceId !== invoiceId) {
                return res.status(401).json({ error: req.t('errors.invoice.invalidOrExpiredToken') });
            }
            // Consume immediately — single use
            await downloadTokenStore.delete(queryToken);
            authorizedUserId = tokenData.userId;
        } else {
            // Standard session path (used by apiClient or same-origin requests)
            const { requireAuth: verifySession } = require('../middleware/auth.middleware');
            // Run the middleware manually and check result
            await new Promise((resolve, reject) => {
                verifySession(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            if (!req.user) {
                return res.status(401).json({ error: req.t('errors.auth.unauthorized') });
            }
            authorizedUserId = req.user.id;
        }

        // 1. Fetch invoice meta
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, orders ( user_id )')
            .eq('id', invoiceId)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: req.t('errors.invoice.notFound') });
        }

        // 2. Authorization check (for session-based path; token path already pre-authorized)
        if (!queryToken) {
            const isOwner = invoice.orders?.user_id === authorizedUserId;
            const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ error: req.t('errors.invoice.unauthorizedAccess') });
            }
        }

        // 3. Serve the PDF — always proxy through backend (never expose Supabase URL)
        const filename = invoice.invoice_number
            ? `${invoice.invoice_number}.pdf`
            : `invoice-${invoiceId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        if (invoice.type === 'RAZORPAY') {
            // Razorpay invoices are external — redirect to their URL (can't proxy easily)
            if (invoice.public_url) return res.redirect(invoice.public_url);
            return res.status(404).json({ error: req.t('errors.invoice.razorpayUrlNotFound') });
        }

        if (invoice.file_path && fs.existsSync(invoice.file_path)) {
            // Local file — stream directly
            return fs.createReadStream(invoice.file_path).pipe(res);
        }

        if (invoice.storage_path) {
            // Supabase — download bytes and stream to client (URL never exposed)
            const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
                .from('invoices')
                .download(invoice.storage_path);

            if (downloadError || !fileBlob) {
                logger.error(`Failed to download invoice ${invoiceId} from storage:`, downloadError);
                return res.status(500).json({ error: req.t('errors.invoice.storageAccessFailed') });
            }

            const buffer = Buffer.from(await fileBlob.arrayBuffer());
            return res.send(buffer);
        }

        // Nothing found — try auto-regeneration
        logger.warn(`Invoice file missing (id: ${invoiceId}). Attempting auto-regeneration...`);
        try {
            const result = await InvoiceOrchestrator.generateInternalInvoice(invoice.order_id, { force: true });
            if (result.success) {
                // Re-fetch and serve the newly generated file
                return res.redirect(`/api/invoices/${result.invoiceId || invoiceId}/download`);
            }
            throw new Error('Auto-regeneration returned unsuccessful result');
        } catch (regenError) {
            logger.error(`Auto-regeneration failed for invoice ${invoiceId}:`, regenError);
            return res.status(404).json({ error: req.t('errors.invoice.fileNotFound') });
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
