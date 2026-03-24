/**
 * Background Job Scheduler
 * Runs periodic tasks for email retry and invoice generation
 * Uses node-cron for scheduling
 */

const cron = require('node-cron');
const EmailRetryService = require('../services/email-retry.service');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('Scheduler');

// Schedule configuration
const SCHEDULES = {
    // Email retry: Every 5 minutes
    EMAIL_RETRY: process.env.EMAIL_RETRY_SCHEDULE || '*/5 * * * *',
    // Invoice retry: Every 15 minutes
    INVOICE_RETRY: process.env.INVOICE_RETRY_SCHEDULE || '*/15 * * * *',
    // Cleanup old logs: Daily at 3 AM
    CLEANUP: process.env.CLEANUP_SCHEDULE || '0 3 * * *',
    // Account deletion: Daily at 2 AM
    ACCOUNT_DELETION: process.env.ACCOUNT_DELETION_SCHEDULE || '0 2 * * *',
    // Retry failed deletions: Daily at 1 AM
    RETRY_FAILED_DELETIONS: process.env.RETRY_FAILED_DELETIONS_SCHEDULE || '0 1 * * *',
};

let scheduledJobs = [];

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
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(emailJob);

    // Invoice Retry Job
    const invoiceJob = cron.schedule(SCHEDULES.INVOICE_RETRY, async () => {
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
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(invoiceJob);

    // Invoice Cleanup Job (Daily at 3 AM)
    const cleanupJob = cron.schedule(SCHEDULES.CLEANUP, async () => {
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
        } catch (error) {
            log.warn('INVOICE_CLEANUP_ERROR', 'Invoice cleanup job failed', { error: error.message });
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(cleanupJob);

    // Dynamic import to avoid circular dependencies and load early initialization issues
    const { DeletionJobProcessor } = require('../services/deletion-job-processor');

    // Account Deletion Processor (Daily at 2 AM)
    const deletionJob = cron.schedule(SCHEDULES.ACCOUNT_DELETION, async () => {
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
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(deletionJob);

    // Retry Failed Deletions (Daily at 1 AM)
    const retryDeletionJob = cron.schedule(SCHEDULES.RETRY_FAILED_DELETIONS, async () => {
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
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(retryDeletionJob);

    log.info('SCHEDULER_STARTED', 'All scheduled jobs initialized', {
        emailRetry: SCHEDULES.EMAIL_RETRY,
        invoiceRetry: SCHEDULES.INVOICE_RETRY
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
