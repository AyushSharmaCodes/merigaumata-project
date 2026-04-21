/**
 * Background Job Scheduler
 * Runs periodic tasks for email retry and invoice generation
 * Uses node-cron for scheduling
 */

const cron = require('node-cron');
const EmailRetryService = require('../services/email-retry.service');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const EventCancellationService = require('../services/event-cancellation.service');
const { RefundService } = require('../services/refund.service');
const PhotoCleanupService = require('../services/photo-cleanup.service');
const { CurrencyExchangeService } = require('../services/currency-exchange.service');
const { createModuleLogger } = require('../utils/logging-standards');
const { runInSpan } = require('../utils/async-context');
const { DeletionJobProcessor } = require('../services/deletion-job-processor');
const PaymentSweepService = require('../services/payment-sweep.service');
const WebhookWorkerService = require('../services/webhook-worker.service');

const log = createModuleLogger('Scheduler');

// Schedule configuration
const SCHEDULES = {
    // Email retry: Every 5 minutes
    EMAIL_RETRY: process.env.EMAIL_RETRY_SCHEDULE || '*/5 * * * *',
    // Invoice retry: Every 15 minutes
    INVOICE_RETRY: process.env.INVOICE_RETRY_SCHEDULE || '*/15 * * * *',
    // Cleanup old logs: Daily at 3 AM
    CLEANUP: process.env.CLEANUP_SCHEDULE || '0 3 * * *',
    // Account deletion reconciliation: every 5 minutes
    ACCOUNT_DELETION: process.env.ACCOUNT_DELETION_SCHEDULE || '*/5 * * * *',
    // Event cancellation reconciliation: every 5 minutes
    EVENT_CANCELLATION: process.env.EVENT_CANCELLATION_SCHEDULE || '*/5 * * * *',
    // Refund reconciliation: every 5 minutes
    REFUND_RECONCILIATION: process.env.REFUND_RECONCILIATION_SCHEDULE || '*/5 * * * *',
    // Retry failed deletions: Daily at 1 AM
    RETRY_FAILED_DELETIONS: process.env.RETRY_FAILED_DELETIONS_SCHEDULE || '0 1 * * *',
    // Currency snapshot refresh: Daily at 10 AM
    CURRENCY_REFRESH_DAILY: process.env.CURRENCY_REFRESH_DAILY_SCHEDULE || '0 10 * * *',
    // Payment sweep for abandoned payments: every 5 minutes
    PAYMENT_SWEEP: process.env.PAYMENT_SWEEP_SCHEDULE || '*/5 * * * *',
    // Webhook worker poll: every 10 seconds
    WEBHOOK_WORKER: process.env.WEBHOOK_WORKER_SCHEDULE || '*/10 * * * * *',
    // Webhook log retention: Daily at 2 AM
    WEBHOOK_LOG_RETENTION: process.env.WEBHOOK_LOG_RETENTION_SCHEDULE || '0 2 * * *',
};

let scheduledJobs = [];

function runScheduledJob(operationName, task) {
    return runInSpan(`Scheduler.${operationName}`, task, {
        trigger: 'cron',
        userId: 'system'
    });
}

/**
 * Initialize and start all scheduled jobs
 */
function initScheduler() {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
        log.info('SCHEDULER_SKIP', 'Scheduler disabled in test environment');
        return;
    }

    log.info('SCHEDULER_INIT', 'Initializing background job scheduler');

    // Email Retry Job
    const emailJob = cron.schedule(SCHEDULES.EMAIL_RETRY, async () => {
        await runScheduledJob('emailRetry', async () => {
            log.debug('JOB_START', 'Email retry job started');
            try {
                const result = await EmailRetryService.processRetryQueue();
                if (result.processed > 0) {
                    log.info('EMAIL_RETRY_COMPLETE', `Processed ${result.processed} emails`, {
                        successful: result.successful,
                        failed: result.failed
                    });
                }
            } catch (error) {
                log.warn('EMAIL_RETRY_ERROR', 'Email retry job failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(emailJob);

    // Invoice Retry Job
    const invoiceJob = cron.schedule(SCHEDULES.INVOICE_RETRY, async () => {
        await runScheduledJob('invoiceRetry', async () => {
            log.debug('JOB_START', 'Invoice retry job started');
            try {
                const result = await InvoiceOrchestrator.retryFailedInvoices();
                if (result.processed > 0) {
                    log.info('INVOICE_RETRY_COMPLETE', `Processed ${result.processed} invoices`, {
                        successful: result.successful
                    });
                }
            } catch (error) {
                log.warn('INVOICE_RETRY_ERROR', 'Invoice retry job failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(invoiceJob);

    // Invoice Cleanup Job (Daily at 3 AM)
    const cleanupJob = cron.schedule(SCHEDULES.CLEANUP, async () => {
        await runScheduledJob('cleanup', async () => {
            log.debug('JOB_START', 'Invoice cleanup job started');
            try {
                const result = await InvoiceOrchestrator.cleanupExpiredInvoices();
                if (result.processed > 0) {
                    log.info('INVOICE_CLEANUP_COMPLETE', `Cleaned up ${result.successful} expired invoices`, {
                        processed: result.processed,
                        failed: result.failed
                    });
                } else {
                    log.debug('INVOICE_CLEANUP_SKIPPED', 'No expired invoices found');
                }

                log.debug('JOB_START', 'Orphan photo cleanup job started');
                const photoResult = await PhotoCleanupService.cleanupOrphanPhotos();
                if (photoResult.deleted > 0) {
                    log.info('PHOTO_CLEANUP_COMPLETE', `Cleaned up ${photoResult.deleted} orphan photos`, {
                        processed: photoResult.processed
                    });
                } else {
                    log.debug('PHOTO_CLEANUP_SKIPPED', 'No orphan photos found');
                }
            } catch (error) {
                log.warn('CLEANUP_JOB_ERROR', 'Cleanup job encountered an error', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(cleanupJob);

    // Account Deletion Processor
    const deletionJob = cron.schedule(SCHEDULES.ACCOUNT_DELETION, async () => {
        await runScheduledJob('accountDeletion', async () => {
            log.debug('JOB_START', 'Account deletion processor job started');
            try {
                const result = await DeletionJobProcessor.processScheduledDeletions();
                if (result.processed > 0) {
                    log.info('ACCOUNT_DELETION_COMPLETE', `Processed ${result.processed} scheduled deletions`);
                } else {
                    log.debug('ACCOUNT_DELETION_SKIPPED', 'No pending scheduled deletions found');
                }
            } catch (error) {
                log.warn('ACCOUNT_DELETION_ERROR', 'Account deletion processor failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(deletionJob);

    const eventCancellationJob = cron.schedule(SCHEDULES.EVENT_CANCELLATION, async () => {
        await runScheduledJob('eventCancellation', async () => {
            log.debug('JOB_START', 'Event cancellation processor job started');
            try {
                const result = await EventCancellationService.processPendingJobs();
                if (result.processed > 0) {
                    log.info('EVENT_CANCELLATION_COMPLETE', `Processed ${result.processed} event cancellation jobs`);
                } else {
                    log.debug('EVENT_CANCELLATION_SKIPPED', 'No pending event cancellation jobs found');
                }
            } catch (error) {
                log.warn('EVENT_CANCELLATION_ERROR', 'Event cancellation processor failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(eventCancellationJob);

    const refundReconciliationJob = cron.schedule(SCHEDULES.REFUND_RECONCILIATION, async () => {
        await runScheduledJob('refundReconciliation', async () => {
            log.debug('JOB_START', 'Refund reconciliation job started');
            try {
                const result = await RefundService.processPendingRefundJobs();
                if ((result.processed + result.reconciled + result.failed) > 0) {
                    log.info('REFUND_RECONCILIATION_COMPLETE', 'Processed refund jobs', result);
                } else {
                    log.debug('REFUND_RECONCILIATION_SKIPPED', 'No stale refund jobs found');
                }
            } catch (error) {
                log.warn('REFUND_RECONCILIATION_ERROR', 'Refund reconciliation failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(refundReconciliationJob);

    // Retry Failed Deletions (Daily at 1 AM)
    const retryDeletionJob = cron.schedule(SCHEDULES.RETRY_FAILED_DELETIONS, async () => {
        await runScheduledJob('retryFailedDeletions', async () => {
            log.debug('JOB_START', 'Retry failed account deletions job started');
            try {
                const result = await DeletionJobProcessor.retryFailedJobs();
                if (result && result.processed > 0) {
                    log.info('RETRY_DELETION_COMPLETE', `Retried ${result.processed} failed deletions`, {
                        successful: result.successful,
                        failed: result.failed
                    });
                }
            } catch (error) {
                log.warn('RETRY_DELETION_ERROR', 'Retry failed account deletions failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(retryDeletionJob);

    const currencyRefreshJob = cron.schedule(SCHEDULES.CURRENCY_REFRESH_DAILY, async () => {
        await runScheduledJob('currencyRefreshDaily', async () => {
            log.debug('JOB_START', 'Currency refresh job started');
            try {
                const snapshots = await CurrencyExchangeService.refreshConfiguredCurrencies({ force: true });
                log.info('CURRENCY_REFRESH_COMPLETE', 'Daily currency snapshots refreshed', {
                    count: snapshots.length,
                    baseCurrencies: snapshots.map((snapshot) => snapshot.base_currency)
                });
            } catch (error) {
                log.warn('CURRENCY_REFRESH_ERROR', 'Currency refresh job failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(currencyRefreshJob);

    // Payment Sweep Job
    const paymentSweepJob = cron.schedule(SCHEDULES.PAYMENT_SWEEP, async () => {
        await runScheduledJob('paymentSweep', async () => {
            log.debug('JOB_START', 'Payment sweep job started');
            try {
                const results = await PaymentSweepService.runSweep();
                const totalProcessed = Object.values(results).reduce((sum, r) => sum + r.resolved + r.expired + r.failed, 0);
                if (totalProcessed > 0) {
                    log.info('PAYMENT_SWEEP_COMPLETE', `Swept and reconciled ${totalProcessed} stale payments`);
                } else {
                    log.debug('PAYMENT_SWEEP_SKIPPED', 'No stale payments found');
                }
            } catch (error) {
                log.warn('PAYMENT_SWEEP_ERROR', 'Payment sweep job failed', { error: error.message });
            }
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(paymentSweepJob);

    // Webhook Worker Poll (high frequency — every 10 seconds)
    const webhookWorkerJob = cron.schedule(SCHEDULES.WEBHOOK_WORKER, async () => {
        // No runInSpan for high-frequency jobs to reduce overhead
        try {
            await WebhookWorkerService.poll();
        } catch (error) {
            log.warn('WEBHOOK_WORKER_ERROR', 'Webhook worker poll failed', { error: error.message });
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(webhookWorkerJob);

    // Webhook Log Retention (daily cleanup)
    const webhookRetentionJob = cron.schedule(SCHEDULES.WEBHOOK_LOG_RETENTION, async () => {
        await runScheduledJob('WebhookLogRetention', async () => {
            log.info('CRON_WEBHOOK_RETENTION', 'Starting daily webhook log cleanup');
            const result = await WebhookWorkerService.purgeOldLogs(7);
            log.info('CRON_WEBHOOK_RETENTION_DONE', `Purged ${result.deleted} old webhook logs`);
        });
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(webhookRetentionJob);

    log.info('SCHEDULER_STARTED', 'All scheduled jobs initialized', {
        emailRetry: SCHEDULES.EMAIL_RETRY,
        invoiceRetry: SCHEDULES.INVOICE_RETRY,
        eventCancellation: SCHEDULES.EVENT_CANCELLATION,
        refundReconciliation: SCHEDULES.REFUND_RECONCILIATION,
        currencyRefreshDaily: SCHEDULES.CURRENCY_REFRESH_DAILY,
        paymentSweep: SCHEDULES.PAYMENT_SWEEP,
        webhookWorker: SCHEDULES.WEBHOOK_WORKER,
        webhookLogRetention: SCHEDULES.WEBHOOK_LOG_RETENTION
    });
}

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
function stopScheduler() {
    log.info('SCHEDULER_STOP', 'Stopping all scheduled jobs');
    scheduledJobs.forEach(job => job.stop());
    scheduledJobs = [];
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    return {
        running: scheduledJobs.length > 0,
        jobs: scheduledJobs.map((job, index) => ({
            index,
            running: job.running
        })),
        schedules: SCHEDULES
    };
}

module.exports = {
    initScheduler,
    stopScheduler,
    getSchedulerStatus,
    SCHEDULES
};
