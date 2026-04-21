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
const { CurrencyExchangeService } = require('../services/currency-exchange.service');
const { getSchedulerStatus } = require('../lib/scheduler');
const authRefreshMonitor = require('../lib/auth-refresh-monitor');
const { createModuleLogger } = require('../utils/logging-standards');
const { getFriendlyMessage } = require('../utils/error-messages');
const { isAppAccessToken, verifyAppAccessToken } = require('../utils/app-auth');
const supabase = require('../config/supabase');
const systemSwitches = require('../services/system-switches.service');

const log = createModuleLogger('CronRoutes');

function normalizeIpAddress(value) {
    if (!value) return '';
    const normalized = String(value).trim();
    return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
}

function isLoopbackAddress(value) {
    const normalized = normalizeIpAddress(value);
    return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

async function getSchedulerRuntimeStatus() {
    const status = getSchedulerStatus();
    const enabled = typeof global.ENABLE_INTERNAL_SCHEDULER === 'boolean'
        ? global.ENABLE_INTERNAL_SCHEDULER
        : (await systemSwitches.getSwitch('ENABLE_INTERNAL_SCHEDULER', false) !== false);

    return {
        enabled: Boolean(enabled),
        running: status.running,
        jobs: status.jobs,
        schedules: status.schedules,
        disabledReason: enabled ? null : 'ENABLE_INTERNAL_SCHEDULER is false for this instance'
    };
}

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
            let user = null;

            if (isAppAccessToken(token)) {
                try {
                    const claims = verifyAppAccessToken(token);
                    user = { id: claims.sub, email: claims.email };
                } catch {
                    user = null;
                }
            }

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('roles(name)')
                    .eq('id', user.id)
                    .single();

                const role = profile?.roles?.name || 'customer';

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

        const remoteAddress = normalizeIpAddress(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '');
        const isLoopback = isLoopbackAddress(remoteAddress);

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

        if (!providedSecret) {
            log.warn('CRON_AUTH_FAILED', 'Cron secret missing from request');
            return res.status(401).json({ error: req.t('errors.auth.unauthorized') });
        }

        // Use timing-safe equality check to prevent timing attacks
        let isValid = false;
        try {
            const crypto = require('crypto');
            // Ensure both strings are the same length before comparing, otherwise timingSafeEqual throws
             if (providedSecret.length === cronSecret.length) {
                isValid = crypto.timingSafeEqual(
                     Buffer.from(providedSecret),
                     Buffer.from(cronSecret)
                );
             }
        } catch (e) {
            isValid = false;
        }

        if (!isValid) {
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

router.post('/currency-refresh', cronAuth, async (req, res) => {
    log.info('CRON_CURRENCY_REFRESH', 'Currency refresh job triggered');

    try {
        const snapshots = await CurrencyExchangeService.refreshConfiguredCurrencies({ force: true });

        res.status(200).json({
            success: true,
            count: snapshots.length,
            snapshots
        });
    } catch (error) {
        log.operationError('CRON_CURRENCY_REFRESH', error);
        res.status(error.status || 500).json({
            success: false,
            error: getFriendlyMessage(error, error.status || 500)
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
        const status = await getSchedulerRuntimeStatus();
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
 * @route GET /api/cron/auth-refresh-stats
 * @description Get lightweight in-memory auth refresh health counters
 * @access Cron Secret
 */
router.get('/auth-refresh-stats', cronAuth, async (req, res) => {
    try {
        const snapshot = await authRefreshMonitor.getSnapshot({
            sinceMinutes: req.query?.sinceMinutes,
            recentLimit: req.query?.recentLimit
        });
        res.status(200).json({
            success: true,
            stats: snapshot
        });
    } catch (error) {
        log.operationError('CRON_AUTH_REFRESH_STATS', error);
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

/**
 * @route POST /api/cron/payment-sweep
 * @description Reconcile stale CREATED/PENDING payments by polling Razorpay.
 *              Covers e-commerce orders (15m), events (10m), donations (30m).
 *              Recovers missed webhooks, expires abandoned payments.
 * @access Cron Secret
 */
router.post('/payment-sweep', cronAuth, async (req, res) => {
    try {
        log.info('CRON_PAYMENT_SWEEP', 'Starting scheduled payment sweep');
        const PaymentSweepService = require('../services/payment-sweep.service');
        const results = await PaymentSweepService.runSweep();

        const totalProcessed = Object.values(results).reduce((sum, r) => sum + r.resolved + r.expired + r.failed, 0);

        res.status(200).json({
            success: true,
            message: `Payment sweep completed. Total resolved: ${totalProcessed}`,
            data: results
        });
    } catch (error) {
        log.error('CRON_PAYMENT_SWEEP_ERROR', 'Payment sweep failed', { error: error.message });
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});
/**
 * @route GET /api/cron/payment-metrics
 * @description Get in-memory payment event metrics (webhook rates, processing times, orphan stats)
 * @access Cron Secret
 */
router.get('/payment-metrics', cronAuth, async (req, res) => {
    try {
        const { getMetrics } = require('../utils/payment-event-logger');
        const metrics = getMetrics();

        res.status(200).json({
            success: true,
            metrics
        });
    } catch (error) {
        log.operationError('CRON_PAYMENT_METRICS', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route GET /api/cron/webhook-queue-stats
 * @description Get live webhook queue depth from database
 * @access Cron Secret
 */
router.get('/webhook-queue-stats', cronAuth, async (req, res) => {
    try {
        const WebhookWorkerService = require('../services/webhook-worker.service');
        const stats = await WebhookWorkerService.getQueueStats();

        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        log.operationError('CRON_WEBHOOK_QUEUE_STATS', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});
/**
 * @route GET /api/cron/webhook-dead-letter
 * @description List dead-lettered webhook events for admin review
 * @access Cron Secret
 */
router.get('/webhook-dead-letter', cronAuth, async (req, res) => {
    try {
        const WebhookWorkerService = require('../services/webhook-worker.service');
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const events = await WebhookWorkerService.getDeadLetterEvents(limit);

        res.status(200).json({
            success: true,
            count: events.length,
            events
        });
    } catch (error) {
        log.operationError('CRON_DEAD_LETTER_LIST', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

/**
 * @route POST /api/cron/retry-webhook/:id
 * @description Retry a dead-lettered webhook event (moves back to PENDING with fresh retry budget)
 * @access Cron Secret
 */
router.post('/retry-webhook/:id', cronAuth, async (req, res) => {
    try {
        const WebhookWorkerService = require('../services/webhook-worker.service');
        const result = await WebhookWorkerService.retryDeadLetter(req.params.id);

        res.status(200).json({
            success: true,
            message: `Webhook ${req.params.id} moved back to PENDING`,
            data: result
        });
    } catch (error) {
        log.operationError('CRON_RETRY_DEAD_LETTER', error);
        const status = error.message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/cron/webhook-log-retention
 * @description Purge old DONE/DEAD_LETTER webhook logs (default: older than 7 days)
 * @access Cron Secret
 */
router.post('/webhook-log-retention', cronAuth, async (req, res) => {
    try {
        const WebhookWorkerService = require('../services/webhook-worker.service');
        const retentionDays = parseInt(req.body?.retentionDays) || 7;
        const result = await WebhookWorkerService.purgeOldLogs(retentionDays);

        res.status(200).json({
            success: true,
            message: `Purged ${result.deleted} old webhook logs`,
            data: result
        });
    } catch (error) {
        log.operationError('CRON_WEBHOOK_RETENTION', error);
        res.status(500).json({ success: false, error: getFriendlyMessage(error, 500) });
    }
});

module.exports = router;
module.exports.cronAuth = cronAuth;
