const express = require('express');
const router = express.Router();
const EventCancellationService = require('../services/event-cancellation.service');
const ReconciliationService = require('../services/reconciliation.service');
const EventService = require('../services/event.service');
const emailService = require('../services/email');
const logger = require('../utils/logger');
const supabase = require('../lib/supabase');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdminOrManager } = require('../middleware/adminOnly.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');
const { scheduleBackgroundTask } = require('../utils/background-task');

// Use standard JWT-based authentication + admin role check
router.use(authenticateToken);
router.use(requireAdminOrManager);

/**
 * POST /api/admin/events/:id/cancel
 * Cancel an event and initiate bulk refunds/notifications
 */
router.post('/:id/cancel', requestLock((req) => `admin-event-cancel:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const eventId = req.params.id;
        const { reason } = req.body;
        const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

        if (!reason) {
            return res.status(400).json({ error: req.t('errors.event.cancellationReasonRequired') });
        }

        const result = await EventCancellationService.cancelEvent(
            eventId,
            req.user.id,
            reason,
            correlationId
        );

        scheduleBackgroundTask({
            operationName: 'AdminEventRoutes.cancelEventJob',
            context: { correlationId, userId: req.user.id },
            errorMessage: 'Background job processing failed',
            task: async () => {
                await EventCancellationService.processJob(result.jobId);
            }
        });

        res.json(result);
    } catch (error) {
        logger.error({ err: error.message }, 'Admin cancellation API error');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/admin/events/:id/update-schedule
 * For postpone/prepone without refund
 */
router.post('/:id/update-schedule', requestLock((req) => `admin-event-update-schedule:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const eventId = req.params.id;
        const { startDate, endDate, reason } = req.body;
        const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

        if (!startDate || !reason) {
            return res.status(400).json({ error: req.t('errors.event.rescheduleParamsRequired') });
        }

        const result = await EventCancellationService.updateEventSchedule(
            eventId,
            req.user.id,
            { startDate, endDate },
            reason,
            correlationId
        );

        res.json(result);
    } catch (error) {
        logger.error({ err: error.message, eventId: req.params.id }, 'Admin schedule update API error');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/admin/reconciliation/run
 * Manual trigger for reconciliation job
 */
router.post('/reconciliation/run', requestLock('admin-event-reconciliation-run'), idempotency(), async (req, res) => {
    try {
        const results = await ReconciliationService.runReconciliation();
        res.json({ success: true, results });
    } catch (error) {
        logger.error({ err: error }, 'Manual reconciliation failed');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * GET /api/admin/events/:id/cancellation-job
 * Check progress of cancellation job
 */
router.get('/:id/cancellation-job', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('event_cancellation_jobs')
            .select('*')
            .eq('event_id', req.params.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // Use maybeSingle to avoid error when no job exists

        if (error) throw error;

        // Return null if no job exists (event was never cancelled)
        res.json(data);
    } catch (error) {
        logger.error({ err: error, eventId: req.params.id }, 'Failed to fetch cancellation job');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /api/admin/events/:id/retry-cancellation
 * Retry a failed or partial failure cancellation job
 */
router.post('/:id/retry-cancellation', requestLock((req) => `admin-event-retry-cancellation:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const eventId = req.params.id;
        const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

        // Find the latest job for this event
        const { data: job, error: jobError } = await supabase
            .from('event_cancellation_jobs')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (jobError || !job) {
            return res.status(404).json({ error: req.t('errors.event.noCancellationJob') });
        }

        // Only allow retry for FAILED or PARTIAL_FAILURE jobs
        if (!['FAILED', 'PARTIAL_FAILURE'].includes(job.status)) {
            return res.status(400).json({
                error: req.t('errors.event.retryInvalidStatus', { status: job.status })
            });
        }

        // Count remaining registrations to process
        const { count: pendingCount } = await supabase
            .from('event_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .neq('status', 'cancelled');

        if (pendingCount === 0) {
            // Mark job as completed since all registrations are already cancelled
            await supabase
                .from('event_cancellation_jobs')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.id);

            await supabase
                .from('events')
                .update({
                    cancellation_status: 'CANCELLED',
                    updated_at: new Date().toISOString()
                })
                .eq('id', eventId);

            return res.json({
                success: true,
                message: req.t('success.events.allCancelledCompleted'),
                jobId: job.id
            });
        }

        // Reset job to PENDING for reprocessing
        const { error: resetError } = await supabase
            .from('event_cancellation_jobs')
            .update({
                status: 'PENDING',
                processed_count: 0,
                failed_count: 0,
                error_log: [],
                total_registrations: pendingCount,
                last_processed_at: null,
                completed_at: null,
                updated_at: new Date().toISOString(),
                correlation_id: correlationId
            })
            .eq('id', job.id);

        if (resetError) throw resetError;

        logger.info({ jobId: job.id, eventId, pendingCount, correlationId }, 'Cancellation job reset for retry');

        scheduleBackgroundTask({
            operationName: 'AdminEventRoutes.retryCancellationJob',
            context: { correlationId, userId: req.user.id },
            errorMessage: 'Background retry job processing failed',
            task: async () => {
                await EventCancellationService.processJob(job.id);
            }
        });

        res.json({
            success: true,
            message: req.t('success.event.retryInitiated', { count: pendingCount }),
            jobId: job.id,
            correlationId,
            pendingRegistrations: pendingCount
        });
    } catch (error) {
        logger.error({ err: error.message, eventId: req.params.id }, 'Admin retry cancellation API error');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
