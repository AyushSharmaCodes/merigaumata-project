const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');
const supabase = require('../config/supabase');
const crypto = require('crypto');
const { DeletionJobProcessor } = require('../services/deletion-job-processor');
const EventCancellationService = require('../services/event-cancellation.service');
const { RefundService } = require('../services/refund.service');
const { scheduleBackgroundTask } = require('../utils/background-task');

/**
 * Admin Jobs Management Routes
 * Unified API for managing both Account Deletion and Event Cancellation jobs
 * All routes require staff authentication and background job permission
 */

// Job type constants
const JOB_TYPES = {
    ACCOUNT_DELETION: 'ACCOUNT_DELETION',
    EVENT_CANCELLATION: 'EVENT_CANCELLATION',
    REFUND: 'REFUND',
    EMAIL_NOTIFICATION: 'EMAIL_NOTIFICATION'
};

/**
 * Helper: Fetch account deletion jobs
 */
async function fetchAccountDeletionJobs(status, offset, limit) {
    let query = supabase
        .from('account_deletion_jobs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status.toUpperCase());
    }

    if (offset !== undefined && limit !== undefined) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data: jobs, error, count } = await query;
    if (error) throw error;

    // Fetch profile data
    let profileMap = {};
    if (jobs && jobs.length > 0) {
        const userIds = [...new Set(jobs.map(j => j.user_id).filter(Boolean))];
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, name')
                .in('id', userIds);
            if (profiles) {
                profileMap = profiles.reduce((acc, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {});
            }
        }
    }

    // Transform for frontend
    const transformedJobs = (jobs || []).map(job => ({
        id: job.id,
        type: JOB_TYPES.ACCOUNT_DELETION,
        status: job.status,
        mode: job.mode,
        userId: job.user_id,
        userEmail: profileMap[job.user_id]?.email || 'N/A',
        userName: profileMap[job.user_id]?.name || 'N/A',
        currentStep: job.current_step,
        stepsCompleted: job.steps_completed,
        errorLog: job.error_log,
        retryCount: job.retry_count || 0,
        scheduledFor: job.scheduled_for,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        correlationId: job.correlation_id
    }));

    return { jobs: transformedJobs, count: count || 0 };
}

/**
 * Helper: Fetch event cancellation jobs
 */
async function fetchEventCancellationJobs(status, offset, limit) {
    const staleThresholdMs = 15 * 60 * 1000;
    let query = supabase
        .from('event_cancellation_jobs')
        .select('*, events(id, title)', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status.toUpperCase());
    }

    if (offset !== undefined && limit !== undefined) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data: jobs, error, count } = await query;
    if (error) throw error;

    // Transform for frontend
    const transformedJobs = (jobs || []).map(job => {
        const updatedAt = job.updated_at || job.last_processed_at || job.created_at;
        const isStale = job.status === 'IN_PROGRESS' &&
            updatedAt &&
            (Date.now() - new Date(updatedAt).getTime() >= staleThresholdMs);
        const needsAttention = isStale || job.status === 'FAILED' || job.status === 'PARTIAL_FAILURE';

        return {
            id: job.id,
            type: JOB_TYPES.EVENT_CANCELLATION,
            status: job.status,
            mode: 'ASYNC', // Event cancellation is always async
            eventId: job.event_id,
            eventTitle: job.events?.title || 'Unknown Event',
            totalRegistrations: job.total_registrations || 0,
            processedCount: job.processed_count || 0,
            failedCount: job.failed_count || 0,
            batchSize: job.batch_size,
            errorLog: job.error_log,
            retryCount: job.retry_count || 0,
            isStale,
            needsAttention,
            attentionReason: isStale ? 'STALE' : needsAttention ? job.status : null,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            createdAt: job.created_at,
            updatedAt: job.updated_at || job.last_processed_at,
            correlationId: job.correlation_id
        };
    });

    return { jobs: transformedJobs, count: count || 0 };
}


/**
 * Helper: Fetch refund jobs
 */
async function fetchRefundJobs(status, offset, limit) {
    let query = supabase
        .from('refunds')
        .select('*, orders(order_number)', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status.toUpperCase());
    }

    if (offset !== undefined && limit !== undefined) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data: jobs, error, count } = await query;
    if (error) throw error;

    const transformedJobs = (jobs || []).map(job => ({
        id: job.id,
        type: JOB_TYPES.REFUND,
        status: RefundService.normalizeRefundStatus(job.status) || 'UNKNOWN',
        mode: 'ASYNC',
        orderId: job.order_id,
        orderNumber: job.orders?.order_number,
        paymentId: job.payment_id,
        refundId: job.razorpay_refund_id,
        amount: job.amount,
        reason: job.reason,
        refundType: job.refund_type,
        errorLog: Array.isArray(job.error_log) && job.error_log.length > 0
            ? job.error_log
            : (RefundService.normalizeRefundStatus(job.status) === 'FAILED' ? [{ message: job.reason, timestamp: job.updated_at }] : []),
        retryCount: job.retry_count || 0,
        startedAt: job.created_at,
        completedAt: ['PROCESSED', 'COMPLETED', 'FAILED'].includes(RefundService.normalizeRefundStatus(job.status)) ? job.updated_at : null,
        createdAt: job.created_at,
        updatedAt: job.updated_at
    }));
    return { jobs: transformedJobs, count: count || 0 };
}

/**
 * Helper: Fetch email notification jobs
 */
async function fetchEmailNotificationJobs(status, offset, limit) {
    let query = supabase
        .from('email_notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status.toUpperCase());
    } else {
        // By default show failed ones on jobs dashboard
        query = query.eq('status', 'FAILED');
    }

    if (offset !== undefined && limit !== undefined) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data: jobs, error, count } = await query;
    if (error) throw error;

    const transformedJobs = (jobs || []).map(job => ({
        id: job.id,
        type: JOB_TYPES.EMAIL_NOTIFICATION,
        status: job.status,
        mode: 'ASYNC',
        recipient: job.recipient_email,
        emailType: job.email_type,
        errorLog: job.error_message ? [{ message: job.error_message, timestamp: job.updated_at }] : [],
        retryCount: job.retry_count || 0,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        correlationId: job.correlation_id,
        metadata: job.metadata
    }));

    return { jobs: transformedJobs, count: count || 0 };
}

/**
 * GET /api/admin/jobs
 * List all jobs with filters
 * Query params: type (ACCOUNT_DELETION, EVENT_CANCELLATION, all), status, page, limit
 */
router.get('/', authenticateToken, checkPermission('can_manage_background_jobs'), async (req, res) => {
    try {
        const { type = 'all', status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const parsedLimit = parseInt(limit);
        const fetchWindow = offset + parsedLimit;

        let allJobs = [];
        let totalCount = 0;

        const tasks = [];

        if (type === 'all' || type === JOB_TYPES.ACCOUNT_DELETION) {
            tasks.push(fetchAccountDeletionJobs(status, type === 'all' ? 0 : offset, type === 'all' ? fetchWindow : parsedLimit));
        }

        if (type === 'all' || type === JOB_TYPES.EVENT_CANCELLATION) {
            tasks.push(fetchEventCancellationJobs(status, type === 'all' ? 0 : offset, type === 'all' ? fetchWindow : parsedLimit));
        }

        if (type === 'all' || type === JOB_TYPES.REFUND) {
            tasks.push(fetchRefundJobs(status, type === 'all' ? 0 : offset, type === 'all' ? fetchWindow : parsedLimit));
        }

        if (type === 'all' || type === JOB_TYPES.EMAIL_NOTIFICATION) {
            tasks.push(fetchEmailNotificationJobs(status, type === 'all' ? 0 : offset, type === 'all' ? fetchWindow : parsedLimit));
        }

        const results = await Promise.all(tasks);
        
        results.forEach(result => {
            allJobs = allJobs.concat(result.jobs);
            totalCount += result.count;
        });

        // If fetching all types, sort by createdAt and apply pagination
        if (type === 'all') {
            allJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            allJobs = allJobs.slice(offset, offset + parsedLimit);
        }

        res.json({
            success: true,
            jobs: allJobs,
            pagination: {
                page: parseInt(page),
                limit: parsedLimit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / parsedLimit)
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching jobs');
        res.status(500).json({ error: req.t('errors.jobs.fetchFailed'), details: getFriendlyMessage(error, 500) });
    }
});

/**
 * GET /api/admin/jobs/:id
 * Get single job details - searches both tables
 */
router.get('/:id', authenticateToken, checkPermission('can_manage_background_jobs'), async (req, res) => {
    try {
        const { id } = req.params;

        // Search all potential job tables in parallel
        const [deletionRes, eventRes, refundRes, emailRes] = await Promise.all([
            supabase.from('account_deletion_jobs').select('*').eq('id', id).maybeSingle(),
            supabase.from('event_cancellation_jobs').select('*, events(id, title, status, startDate, Location)').eq('id', id).maybeSingle(),
            supabase.from('refunds').select('*, orders(order_number)').eq('id', id).maybeSingle(),
            supabase.from('email_notifications').select('*').eq('id', id).maybeSingle()
        ]);

        const job = deletionRes.data;
        const eventJob = eventRes.data;
        const refundJob = refundRes.data;
        const emailJob = emailRes.data;

        if (job) {
            // Found in account_deletion_jobs
            let profile = null;
            if (job.user_id) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('email, name, phone')
                    .eq('id', job.user_id)
                    .single();
                profile = profileData;
            }

            return res.json({
                success: true,
                job: {
                    id: job.id,
                    type: JOB_TYPES.ACCOUNT_DELETION,
                    status: job.status,
                    mode: job.mode,
                    userId: job.user_id,
                    userEmail: profile?.email || 'N/A',
                    userName: profile?.name || 'N/A',
                    userPhone: profile?.phone || 'N/A',
                    currentStep: job.current_step,
                    stepsCompleted: job.steps_completed,
                    errorLog: job.error_log,
                    retryCount: job.retry_count || 0,
                    scheduledFor: job.scheduled_for,
                    startedAt: job.started_at,
                    completedAt: job.completed_at,
                    createdAt: job.created_at,
                    updatedAt: job.updated_at,
                    correlationId: job.correlation_id
                }
            });
        }

        if (eventJob) {
            return res.json({
                success: true,
                job: {
                    id: eventJob.id,
                    type: JOB_TYPES.EVENT_CANCELLATION,
                    status: eventJob.status,
                    mode: 'ASYNC',
                    eventId: eventJob.event_id,
                    eventTitle: eventJob.events?.title || 'Unknown Event',
                    eventStatus: eventJob.events?.status,
                    eventStartDate: eventJob.events?.start_date,
                    eventLocation: eventJob.events?.location,
                    totalRegistrations: eventJob.total_registrations || 0,
                    processedCount: eventJob.processed_count || 0,
                    failedCount: eventJob.failed_count || 0,
                    batchSize: eventJob.batch_size,
                    errorLog: eventJob.error_log,
                    retryCount: eventJob.retry_count || 0,
                    startedAt: eventJob.started_at,
                    completedAt: eventJob.completed_at,
                    createdAt: eventJob.created_at,
                    updatedAt: eventJob.updated_at || eventJob.last_processed_at,
                    correlationId: eventJob.correlation_id
                }
            });
        }

        if (refundJob) {
            return res.json({
                success: true,
                job: {
                    id: refundJob.id,
                    type: JOB_TYPES.REFUND,
                    status: RefundService.normalizeRefundStatus(refundJob.status) || 'UNKNOWN',
                    mode: 'ASYNC',
                    orderId: refundJob.order_id,
                    orderNumber: refundJob.orders?.order_number,
                    paymentId: refundJob.payment_id,
                    refundId: refundJob.razorpay_refund_id,
                    amount: refundJob.amount,
                    reason: refundJob.reason,
                    refundType: refundJob.refund_type,
                    errorLog: Array.isArray(refundJob.error_log) && refundJob.error_log.length > 0
                        ? refundJob.error_log
                        : (RefundService.normalizeRefundStatus(refundJob.status) === 'FAILED' ? [{ message: refundJob.reason, timestamp: refundJob.updated_at }] : []),
                    retryCount: refundJob.retry_count || 0,
                    startedAt: refundJob.created_at,
                    completedAt: ['PROCESSED', 'COMPLETED', 'FAILED'].includes(RefundService.normalizeRefundStatus(refundJob.status)) ? refundJob.updated_at : null,
                    createdAt: refundJob.created_at,
                    updatedAt: refundJob.updated_at,
                    correlationId: null
                }
            });
        }

        if (emailJob) {
            return res.json({
                success: true,
                job: {
                    id: emailJob.id,
                    type: JOB_TYPES.EMAIL_NOTIFICATION,
                    status: emailJob.status,
                    mode: 'ASYNC',
                    recipient: emailJob.recipient_email,
                    emailType: emailJob.email_type,
                    errorLog: emailJob.error_message ? [{ message: emailJob.error_message, timestamp: emailJob.updated_at }] : [],
                    retryCount: emailJob.retry_count || 0,
                    createdAt: emailJob.created_at,
                    updatedAt: emailJob.updated_at,
                    correlationId: emailJob.correlation_id,
                    metadata: emailJob.metadata
                }
            });
        }

        // Not found in either table
        return res.status(404).json({ error: req.t('errors.jobs.notFound') });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Error fetching job details');
        res.status(500).json({ error: req.t('errors.jobs.fetchDetailsFailed') });
    }
});

/**
 * POST /api/admin/jobs/:id/retry
 * Retry a failed job - auto-detects job type
 */
router.post('/:id/retry', authenticateToken, checkPermission('can_manage_background_jobs'), requestLock((req) => `admin-job-retry:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const correlationId = req.correlationId || crypto.randomUUID();

        // Check account deletion jobs first
        let { data: deletionJob } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (deletionJob) {
            // Handle account deletion job retry
            if (deletionJob.status !== 'FAILED' && deletionJob.status !== 'BLOCKED') {
                return res.status(400).json({
                    error: req.t('errors.jobs.retryInvalidStatus', { status: deletionJob.status })
                });
            }

            const { error: updateError } = await supabase
                .from('account_deletion_jobs')
                .update({
                    status: 'PENDING',
                    current_step: deletionJob.current_step || 'LOCK_USER',
                    retry_count: (deletionJob.retry_count || 0) + 1,
                    error_log: [...(deletionJob.error_log || []), {
                        message: req.t('jobs.manualRetry'),
                        adminId: req.user.id,
                        timestamp: new Date().toISOString()
                    }],
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) throw updateError;

            await supabase
                .from('profiles')
                .update({ deletion_status: 'DELETION_IN_PROGRESS' })
                .eq('id', deletionJob.user_id);

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.retryDeletionJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobRetry] Account deletion job processing failed',
                task: async () => {
                    await DeletionJobProcessor.processJob(id);
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'ACCOUNT_DELETION' }, '[AdminJobRetry] Job retry triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.deletionRetryTriggered'),
                jobId: id,
                type: JOB_TYPES.ACCOUNT_DELETION
            });
        }

        // Check event cancellation jobs
        let { data: eventJob } = await supabase
            .from('event_cancellation_jobs')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (eventJob) {
            // Handle event cancellation job retry
            if (!['FAILED', 'PARTIAL_FAILURE'].includes(eventJob.status)) {
                return res.status(400).json({
                    error: req.t('errors.jobs.retryInvalidStatusEvent', { status: eventJob.status })
                });
            }

            // Count remaining registrations to process
            const { count: pendingCount } = await supabase
                .from('event_registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventJob.event_id)
                .neq('status', 'cancelled');

            if (pendingCount === 0) {
                await supabase
                    .from('event_cancellation_jobs')
                    .update({
                        status: 'COMPLETED',
                        completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                return res.json({
                    success: true,
                    message: req.t('success.events.allCancelledCompleted'),
                    jobId: id,
                    type: JOB_TYPES.EVENT_CANCELLATION
                });
            }

            // Reset job for retry
            const { error: resetError } = await supabase
                .from('event_cancellation_jobs')
                .update({
                    status: 'PENDING',
                    processed_count: 0,
                    failed_count: 0,
                    error_log: [],
                    total_registrations: pendingCount,
                    retry_count: (eventJob.retry_count || 0) + 1,
                    last_processed_at: null,
                    completed_at: null,
                    updated_at: new Date().toISOString(),
                    correlation_id: correlationId
                })
                .eq('id', id);

            if (resetError) throw resetError;

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.retryEventCancellationJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobRetry] Event cancellation job processing failed',
                task: async () => {
                    await EventCancellationService.processJob(id);
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'EVENT_CANCELLATION', pendingCount }, '[AdminJobRetry] Job retry triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.eventRetryTriggered', { count: pendingCount }),
                jobId: id,
                type: JOB_TYPES.EVENT_CANCELLATION,
                pendingRegistrations: pendingCount
            });
        }

        // Check refund jobs
        let { data: refundJob } = await supabase
            .from('refunds')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (refundJob) {
            if (RefundService.normalizeRefundStatus(refundJob.status) !== 'FAILED') {
                return res.status(400).json({
                    error: req.t('errors.jobs.retryInvalidStatus', { status: refundJob.status })
                });
            }

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.retryRefundJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobRetry] Refund job retry failed',
                task: async () => {
                    await RefundService.retryRefund(id, 'ADMIN');
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'REFUND' }, '[AdminJobRetry] Refund retry triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.refundRetryTriggered'),
                jobId: id,
                type: JOB_TYPES.REFUND
            });
        }

        // Check email notification jobs
        let { data: emailJob } = await supabase
            .from('email_notifications')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (emailJob) {
            if (emailJob.status !== 'FAILED') {
                return res.status(400).json({
                    error: req.t('errors.jobs.retryInvalidStatus', { status: emailJob.status })
                });
            }

            const EmailRetryService = require('../services/email-retry.service');

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.retryEmailJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobRetry] Email retry failed',
                task: async () => {
                    await EmailRetryService.retryEmail(id);
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'EMAIL_NOTIFICATION' }, '[AdminJobRetry] Email retry triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.emailRetryTriggered'),
                jobId: id,
                type: JOB_TYPES.EMAIL_NOTIFICATION
            });
        }

        return res.status(404).json({ error: req.t('errors.jobs.notFound') });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Error retrying job');
        res.status(500).json({ error: req.t('errors.jobs.retryFailed') });
    }
});

/**
 * POST /api/admin/jobs/:id/process
 * Manually trigger processing of a PENDING job - auto-detects job type
 */
router.post('/:id/process', authenticateToken, checkPermission('can_manage_background_jobs'), requestLock((req) => `admin-job-process:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const correlationId = req.correlationId || crypto.randomUUID();

        // Check account deletion jobs first
        let { data: deletionJob } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (deletionJob) {
            if (deletionJob.status !== 'PENDING') {
                return res.status(400).json({
                    error: req.t('errors.jobs.processInvalidStatus', { status: deletionJob.status })
                });
            }

            await supabase
                .from('profiles')
                .update({ deletion_status: 'DELETION_IN_PROGRESS' })
                .eq('id', deletionJob.user_id);

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.processDeletionJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobProcess] Account deletion job processing failed',
                task: async () => {
                    await DeletionJobProcessor.processJob(id);
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'ACCOUNT_DELETION' }, '[AdminJobProcess] Manual job processing triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.deletionProcessingTriggered'),
                jobId: id,
                type: JOB_TYPES.ACCOUNT_DELETION
            });
        }

        // Check event cancellation jobs
        let { data: eventJob } = await supabase
            .from('event_cancellation_jobs')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (eventJob) {
            if (eventJob.status !== 'PENDING') {
                return res.status(400).json({
                    error: req.t('errors.jobs.processInvalidStatus', { status: eventJob.status })
                });
            }

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.processEventCancellationJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobProcess] Event cancellation job processing failed',
                task: async () => {
                    await EventCancellationService.processJob(id);
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'EVENT_CANCELLATION' }, '[AdminJobProcess] Manual job processing triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.eventCancellationTriggered'),
                jobId: id,
                type: JOB_TYPES.EVENT_CANCELLATION
            });
        }

        // Check refund jobs
        let { data: refundJob } = await supabase
            .from('refunds')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (refundJob) {
            if (RefundService.normalizeRefundStatus(refundJob.status) !== 'PENDING') {
                return res.status(400).json({
                    error: req.t('errors.jobs.processInvalidStatus', { status: refundJob.status })
                });
            }

            scheduleBackgroundTask({
                operationName: 'AdminJobsRoutes.processRefundJob',
                context: { correlationId, userId: req.user.id },
                errorMessage: '[AdminJobProcess] Refund processing failed',
                task: async () => {
                    const payment = await supabase.from('payments').select('*').eq('id', refundJob.payment_id).single();
                    const order = refundJob.order_id ? await supabase.from('orders').select('*').eq('id', refundJob.order_id).single() : { data: null };

                    await RefundService.executeRefund(refundJob, order.data, payment.data, 'ADMIN');
                }
            });

            logger.info({ jobId: id, correlationId, adminId: req.user.id, type: 'REFUND' }, '[AdminJobProcess] Manual job processing triggered');

            return res.json({
                success: true,
                message: req.t('success.jobs.refundProcessingTriggered'),
                jobId: id,
                type: JOB_TYPES.REFUND
            });
        }

        return res.status(404).json({ error: req.t('errors.jobs.notFound') });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Error processing job');
        res.status(500).json({ error: req.t('errors.jobs.processFailed') });
    }
});

module.exports = router;
