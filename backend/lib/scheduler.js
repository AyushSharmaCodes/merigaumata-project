/**
 * Background Job Scheduler (Sunsetted. Handled by Supabase pg_cron now)
 * This file is kept to export constants that may still be used in code,
 * and dummy functions so as not to break server initialization.
 */

const { createModuleLogger } = require('../utils/logging-standards');
const log = createModuleLogger('Scheduler');

// Schedule configuration (Documentary purposes or used by UI)
const SCHEDULES = {
    EMAIL_RETRY: process.env.EMAIL_RETRY_SCHEDULE || '*/5 * * * *',
    INVOICE_RETRY: process.env.INVOICE_RETRY_SCHEDULE || '*/15 * * * *',
    CLEANUP: process.env.CLEANUP_SCHEDULE || '0 3 * * *',
    ACCOUNT_DELETION: process.env.ACCOUNT_DELETION_SCHEDULE || '*/5 * * * *',
    EVENT_CANCELLATION: process.env.EVENT_CANCELLATION_SCHEDULE || '* * * * *',
    REFUND_RECONCILIATION: process.env.REFUND_RECONCILIATION_SCHEDULE || '*/5 * * * *',
    RETRY_FAILED_DELETIONS: process.env.RETRY_FAILED_DELETIONS_SCHEDULE || '0 1 * * *',
};

function initScheduler() {
    log.info('SCHEDULER_INIT', 'Internal scheduler disabled. Relying on Supabase pg_cron triggers.');
}

function stopScheduler() {
    log.info('SCHEDULER_STOP', 'No internal scheduled jobs to stop.');
}

function getSchedulerStatus() {
    return {
        running: false,
        jobs: [],
        schedules: SCHEDULES,
        note: 'Scheduling is now handled externally via Supabase pg_cron.'
    };
}

module.exports = {
    initScheduler,
    stopScheduler,
    getSchedulerStatus,
    SCHEDULES
};
