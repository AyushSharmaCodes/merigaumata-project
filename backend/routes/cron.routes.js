/**
 * Cron Routes
 * Endpoints for scheduled background jobs (called by external scheduler or cron service)
 */

const express = require('express');
const router = express.Router();
const EmailRetryService = require('../services/email-retry.service');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const { RefundService } = require('../services/refund.service');
const { getSchedulerStatus } = require('../lib/scheduler');
const { optionalAuth } = require('../middleware/auth.middleware');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('CronRoutes');

// Cron auth middleware - handles authentication internally
const cronAuth = async (req, res, next) => {
    try {
        // 1. Try to extract and validate token (optional)
        let token = req.cookies?.access_token;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        // 2. If token exists, validate it and check for admin/manager role
        if (token) {
            const { supabaseAdmin } = require('../lib/supabase');
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

            if (!error && user) {
                const { data: profile } = await require('../config/supabase')
                    .from('profiles')
                    .select('roles(name)')
                    .eq('id', user.id)
                    .single();

                const role = profile?.roles?.name || 'customer';

                if (role === 'admin' || role === 'manager') {
                    req.user = { id: user.id, email: user.email, role };
                    return next();
                }
            }
        }

        // 3. In development, allow without authentication
        if (process.env.NODE_ENV !== 'production') {
            log.debug('CRON_AUTH_DEV', 'Allowing access in development mode');
            return next();
        }

        // 4. Check CRON_SECRET
        const cronSecret = process.env.CRON_SECRET;
        const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

        if (!cronSecret) {
            log.warn('CRON_SECRET_MISSING', 'CRON_SECRET not configured');
            return res.status(401).json({ error: req.t('errors.system.cronSecretMissing') });
        }

        if (providedSecret !== cronSecret) {
            log.warn('CRON_AUTH_FAILED', 'Invalid cron secret provided');
            return res.status(401).json({ error: req.t('errors.auth.unauthorized') });
        }

        next();
    } catch (error) {
        log.operationError('CRON_AUTH_ERROR', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// Remove optionalAuth middleware - cronAuth handles everything now

/**
 * @route POST /api/cron/email-retry
 * @description Process failed email retry queue
 * @access Cron Secret
 */
router.post('/email-retry', cronAuth, async (req, res) => {
    log.info('CRON_EMAIL_RETRY', 'Email retry job triggered');

    try {
        const result = await EmailRetryService.processRetryQueue();

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        log.operationError('CRON_EMAIL_RETRY', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/cron/invoice-retry
 * @description Retry failed invoice generation
 * @access Cron Secret
 */
router.post('/invoice-retry', cronAuth, async (req, res) => {
    log.info('CRON_INVOICE_RETRY', 'Invoice retry job triggered');

    try {
        const result = await InvoiceOrchestrator.retryFailedInvoices();

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        log.operationError('CRON_INVOICE_RETRY', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/cron/email-stats
 * @description Get email retry statistics
 * @access Cron Secret
 */
router.get('/email-stats', cronAuth, async (req, res) => {
    try {
        const stats = await EmailRetryService.getRetryStats();
        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/cron/orphan-sweeper
 * @description Manually or automatically trigger the Orphan Payment Sweeper
 * @access Cron Secret
 */
router.post('/orphan-sweeper', cronAuth, async (req, res) => {
    try {
        log.info('CRON_ORPHAN_SWEEP', 'Starting scheduled orphan payment sweep');
        const result = await RefundService.processOrphanPayments();

        res.status(200).json({
            success: true,
            message: `Orphan payment sweep completed. Processed: ${result.processed}, Failed: ${result.failed}`,
            data: result
        });
    } catch (error) {
        log.error('CRON_ORPHAN_SWEEP_ERROR', 'Orphan sweep failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/orphan-stats
 * @description Get statistics about orphan payments
 * @access Cron Secret
 */
router.get('/orphan-stats', cronAuth, async (req, res) => {
    try {
        const supabase = require('../config/supabase');

        // Count total CAPTURED_ORPHAN (unprocessed flag)
        const { count: flaggedCount } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'CAPTURED_ORPHAN');

        // Count total REFUNDED_ORPHAN (processed)
        const { count: refundedCount } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'REFUNDED_ORPHAN');

        res.status(200).json({
            success: true,
            stats: {
                flagged_orphans: flaggedCount || 0,
                refunded_orphans: refundedCount || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/invoice-stats
 * @description Get invoice generation statistics
 * @access Cron Secret
 */
router.get('/invoice-stats', cronAuth, async (req, res) => {
    try {
        const stats = await InvoiceOrchestrator.getInvoiceStats();
        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/scheduler-status
 * @description Get background job scheduler status
 * @access Cron Secret
 */
router.get('/scheduler-status', cronAuth, async (req, res) => {
    try {
        const status = getSchedulerStatus();
        res.status(200).json({
            success: true,
            ...status
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/health
 * @description Health check for cron service
 * @access Public
 */
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'cron' });
});

module.exports = router;
