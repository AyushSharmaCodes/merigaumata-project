/**
 * Cron Routes
 * Endpoints for scheduled background jobs (called by external scheduler or cron service)
 */

const express = require('express');
const router = express.Router();
const EmailRetryService = require('../services/email-retry.service');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const { RefundService } = require('../services/refund.service');
const EventCancellationService = require('../services/event-cancellation.service');
const { DeletionJobProcessor } = require('../services/deletion-job-processor');
const PhotoCleanupService = require('../services/photo-cleanup.service');
const { getSchedulerStatus } = require('../lib/scheduler');
const { createModuleLogger } = require('../utils/logging-standards');
const { getFriendlyMessage } = require('../utils/error-messages');
const supabase = require('../lib/supabase');

const log = createModuleLogger('CronRoutes');

async function hasBackgroundJobsPermission(userId) {
    const { data, error } = await supabase
        .from('manager_permissions')
        .select('is_active, can_manage_background_jobs')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) {
        return false;
    }

    return data.is_active !== false && data.can_manage_background_jobs === true;
}

async function resolveUserRole(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('roles(name)')
        .eq('id', userId)
        .single();

    if (error || !data) {
        return 'customer';
    }

    if (Array.isArray(data.roles)) {
        return (data.roles[0]?.name || 'customer').toLowerCase();
    }

    return (data.roles?.name || 'customer').toLowerCase();
}

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

        // 2. If token exists, validate it via Supabase and check for admin/manager role
        if (token) {
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            
            if (user && !authError) {
                const role = (user.app_metadata?.role || await resolveUserRole(user.id) || 'customer').toLowerCase();

                if (role === 'admin') {
                    req.user = { id: user.id, email: user.email, role };
                    return next();
                }

                if (role === 'manager' && await hasBackgroundJobsPermission(user.id)) {
                    req.user = { id: user.id, email: user.email, role };
                    return next();
                }
            }
        }

        const forwardedFor = req.headers['x-forwarded-for'];
        const remoteAddress = req.ip || req.socket?.remoteAddress || '';
        const isLoopback = [remoteAddress, forwardedFor]
            .filter(Boolean)
            .some(value => String(value).includes('127.0.0.1') || String(value).includes('::1') || String(value).includes('localhost'));

        // 3. In development, allow only loopback requests without a secret
        if (process.env.NODE_ENV !== 'production' && isLoopback) {
            log.debug('CRON_AUTH_DEV', 'Allowing loopback access in development mode');
            return next();
        }

        // 4. Check CRON_SECRET
        const cronSecret = process.env.CRON_SECRET;
        const providedSecret = req.headers['x-cron-secret'];

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
        return res.status(500).json({ error: getFriendlyMessage(error, 500) });
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
            error: getFriendlyMessage(error, 500)
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
            error: getFriendlyMessage(error, 500)
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
        log.operationError('CRON_EMAIL_STATS', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
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
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route POST /api/cron/refund-reconciliation
 * @description Reconcile stale refund jobs and recover from missed webhooks
 * @access Cron Secret
 */
router.post('/refund-reconciliation', cronAuth, async (req, res) => {
    try {
        log.info('CRON_REFUND_RECONCILIATION', 'Starting refund reconciliation processing');
        const result = await RefundService.processPendingRefundJobs();

        res.status(200).json({
            success: true,
            message: `Refund reconciliation completed. Executed: ${result.processed}, Reconciled: ${result.reconciled}, Failed: ${result.failed}`,
            data: result
        });
    } catch (error) {
        log.error('CRON_REFUND_RECONCILIATION_ERROR', 'Refund reconciliation failed', { error: error.message });
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route POST /api/cron/event-cancellations
 * @description Process pending/stale event cancellation jobs
 * @access Cron Secret
 */
router.post('/event-cancellations', cronAuth, async (req, res) => {
    try {
        log.info('CRON_EVENT_CANCELLATIONS', 'Starting scheduled event cancellation processing');
        const result = await EventCancellationService.processPendingJobs();

        res.status(200).json({
            success: true,
            message: `Event cancellation processing completed. Processed: ${result.processed}`,
            data: result
        });
    } catch (error) {
        log.error('CRON_EVENT_CANCELLATIONS_ERROR', 'Event cancellation processing failed', { error: error.message });
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route POST /api/cron/account-deletions
 * @description Process due scheduled account deletion jobs
 * @access Cron Secret
 */
router.post('/account-deletions', cronAuth, async (req, res) => {
    try {
        log.info('CRON_ACCOUNT_DELETIONS', 'Starting scheduled account deletion processing');
        const result = await DeletionJobProcessor.processScheduledDeletions();

        res.status(200).json({
            success: true,
            message: `Account deletion processing completed. Processed: ${result.processed}`,
            data: result
        });
    } catch (error) {
        log.error('CRON_ACCOUNT_DELETIONS_ERROR', 'Account deletion processing failed', { error: error.message });
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route POST /api/cron/retry-deletions
 * @description Retry failed account deletions
 * @access Cron Secret
 */
router.post('/retry-deletions', cronAuth, async (req, res) => {
    try {
        log.info('CRON_RETRY_DELETIONS', 'Starting retry of failed account deletions');
        const result = await DeletionJobProcessor.retryFailedJobs();

        res.status(200).json({
            success: true,
            message: `Retry account deletions completed. Processed: ${result.processed}, Successful: ${result.successful}, Failed: ${result.failed}`,
            data: result
        });
    } catch (error) {
        log.error('CRON_RETRY_DELETIONS_ERROR', 'Retry account deletions failed', { error: error.message });
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route POST /api/cron/photo-cleanup
 * @description Cleanup orphan photos from storage and database
 * @access Cron Secret
 */
router.post('/photo-cleanup', cronAuth, async (req, res) => {
    try {
        log.info('CRON_PHOTO_CLEANUP', 'Starting orphan photo cleanup');
        const result = await PhotoCleanupService.cleanupOrphanPhotos();

        res.status(200).json({
            success: true,
            message: `Photo cleanup completed. Processed: ${result.processed}, Deleted: ${result.deleted}`,
            data: result
        });
    } catch (error) {
        log.error('CRON_PHOTO_CLEANUP_ERROR', 'Photo cleanup failed', { error: error.message });
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route GET /api/cron/orphan-stats
 * @description Get statistics about orphan payments
 * @access Cron Secret
 */
router.get('/orphan-stats', cronAuth, async (req, res) => {
    try {
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
        log.operationError('CRON_ORPHAN_STATS', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
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
        log.operationError('CRON_INVOICE_STATS', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
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
        log.operationError('CRON_SCHEDULER_STATUS', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
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
module.exports.cronAuth = cronAuth;
module.exports.cronAuth = cronAuth;
