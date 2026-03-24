const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const EventRefundService = require('./event-refund.service');
const emailService = require('./email');
const { refundPayment } = require('../utils/razorpay-helper');
const { EVENT, LOGS } = require('../constants/messages');
const { mapToFrontend } = require('./event.utils');
const { v4: uuidv4 } = require('uuid');
const { translate } = require('../utils/i18n.util');
const AdminAlertService = require('./admin-alert.service');

/**
 * Event Cancellation Service
 * Orchestrates admin-initiated cancellations and async processing
 */
class EventCancellationService {
    static REGISTRATION_CONCURRENCY = 5;
    static EMAIL_CONCURRENCY = 10;
    static STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000;
    static ALERT_TYPE = 'event_cancellation_job';

    static shouldAdjustEventCount(registration) {
        return ['confirmed', 'completed'].includes(registration?.status);
    }

    static async createJobAlert(job, eventTitle, status, extra = {}) {
        const alertTitle = status === 'STALE'
            ? 'Stale event cancellation job'
            : status === 'PARTIAL_FAILURE'
                ? 'Event cancellation partially failed'
                : 'Event cancellation failed';

        const alertContent = status === 'STALE'
            ? `The cancellation job for "${eventTitle || 'Unknown Event'}" was stale and needed recovery.`
            : status === 'PARTIAL_FAILURE'
                ? `The cancellation job for "${eventTitle || 'Unknown Event'}" completed with some failed registrations.`
                : `The cancellation job for "${eventTitle || 'Unknown Event'}" failed and needs attention.`;

        await AdminAlertService.createOrUpdateUnreadAlert({
            type: this.ALERT_TYPE,
            reference_id: job.id,
            title: alertTitle,
            content: alertContent,
            priority: 'high',
            metadata: {
                jobId: job.id,
                eventId: job.event_id,
                eventTitle,
                status,
                ...extra
            }
        });
    }

    static async mapWithConcurrency(items, concurrency, worker) {
        if (!Array.isArray(items) || items.length === 0) return [];

        const normalizedConcurrency = Math.max(1, Math.min(concurrency || 1, items.length));
        const results = new Array(items.length);
        let nextIndex = 0;

        const runWorker = async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex++;
                results[currentIndex] = await worker(items[currentIndex], currentIndex);
            }
        };

        await Promise.all(Array.from({ length: normalizedConcurrency }, runWorker));
        return results;
    }

    /**
     * Admin Action: Cancel Event (Fast Path)
     */
    static async cancelEvent(eventId, adminId, reason, correlationId) {
        logger.info({
            module: 'EventCancellation',
            operation: 'ADMIN_CANCEL_SYNC',
            eventId,
            adminId,
            correlationId
        }, 'Starting admin event cancellation sync path');

        // Fetch the current event first so we can roll back if job creation fails.
        const { data: existingEvent, error: existingEventError } = await supabase
            .from('events')
            .select('id, status, cancellation_status, cancelled_at, cancelled_by, cancellation_reason, cancellation_correlation_id')
            .eq('id', eventId)
            .single();

        if (existingEventError || !existingEvent) {
            logger.error({ err: existingEventError, eventId }, 'Failed to fetch event before cancellation');
            throw new Error(EVENT.CANCELLATION_FAILED);
        }

        // 1. Transactional Update: Mark event as CANCELLED
        const { data: event, error: eventError } = await supabase
            .from('events')
            .update({
                status: 'cancelled',
                cancellation_status: 'CANCELLATION_PENDING',
                cancelled_at: new Date().toISOString(),
                cancelled_by: adminId,
                cancellation_reason: reason,
                cancellation_correlation_id: correlationId,
                updated_at: new Date().toISOString()
            })
            .eq('id', eventId)
            .select()
            .single();

        if (eventError) {
            logger.error({ err: eventError, eventId }, 'Failed to mark event as cancelled');
            throw new Error(EVENT.CANCELLATION_FAILED);
        }

        // 2. Count registrations to process
        const { count, error: countError } = await supabase
            .from('event_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .neq('status', 'cancelled');

        if (countError) throw countError;

        // 3. Enqueue Async Job
        const { data: job, error: jobError } = await supabase
            .from('event_cancellation_jobs')
            .insert([{
                event_id: eventId,
                correlation_id: correlationId,
                status: 'PENDING',
                total_registrations: count || 0,
                batch_size: 50
            }])
            .select()
            .single();

        if (jobError) {
            logger.error({ err: jobError, eventId }, 'Failed to enqueue cancellation job');
            await supabase
                .from('events')
                .update({
                    status: existingEvent.status,
                    cancellation_status: existingEvent.cancellation_status,
                    cancelled_at: existingEvent.cancelled_at,
                    cancelled_by: existingEvent.cancelled_by,
                    cancellation_reason: existingEvent.cancellation_reason,
                    cancellation_correlation_id: existingEvent.cancellation_correlation_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', eventId);
            throw new Error(EVENT.CANCELLATION_JOB_ENQUEUE_FAILED);
        }

        logger.info({ jobId: job.id, registrations: count }, 'Cancellation job enqueued successfully');

        return {
            success: true,
            jobId: job.id,
            correlationId,
            message: translate('success.eventCancellation.initiated')
        };
    }

    /**
     * Background Worker: Process Cancellation Job
     * Uses optimistic locking to prevent duplicate processing
     */
    static async processJob(jobId) {
        // Optimistic lock: Only claim job if still PENDING
        const { data: claimedJob, error: claimError } = await supabase
            .from('event_cancellation_jobs')
            .update({
                status: 'IN_PROGRESS',
                started_at: new Date().toISOString(),
                last_processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId)
            .in('status', ['PENDING']) // Only if still pending
            .select('*')
            .single();

        if (claimError || !claimedJob) {
            // Job already claimed by another process or doesn't exist
            logger.info({ jobId }, 'Job not available for processing (already claimed or completed)');
            return;
        }

        const job = claimedJob;

        // Fetch event data separately (joined select on update doesn't work reliably)
        const { data: eventData, error: eventFetchError } = await supabase
            .from('events')
            .select('*')
            .eq('id', job.event_id)
            .single();

        if (eventFetchError || !eventData) {
            logger.error({ jobId, eventId: job.event_id, err: eventFetchError }, 'Failed to fetch event data for job');
            await supabase
                .from('event_cancellation_jobs')
                .update({ status: 'FAILED', error_log: [{ error: 'Event not found', timestamp: new Date().toISOString() }] })
                .eq('id', jobId);
            return;
        }

        job.events = eventData;

        logger.info({
            module: 'EventCancellation',
            operation: 'JOB_START',
            jobId,
            eventId: job.event_id,
            eventTitle: eventData.title,
            totalRegistrations: job.total_registrations
        }, 'Claimed and started processing event cancellation job');

        try {
            let processed = job.processed_count || 0;
            let failed = job.failed_count || 0;
            const errorLog = job.error_log || [];
            const attemptedRegistrationIds = new Set();

            // Process registrations in batches until the event has no active registrations left.
            while (true) {
                const { data: registrations, error: regError } = await supabase
                    .from('event_registrations')
                    .select('*')
                    .eq('event_id', job.event_id)
                    .neq('status', 'cancelled')
                    .limit(job.batch_size)
                    .order('created_at', { ascending: true });

                if (regError) throw regError;
                if (!registrations || registrations.length === 0) break;

                const batch = registrations.filter((registration) => !attemptedRegistrationIds.has(registration.id));
                if (batch.length === 0) break;

                batch.forEach((registration) => attemptedRegistrationIds.add(registration.id));

                logger.info({ jobId, batchSize: batch.length }, 'Processing batch of registrations');

                const batchResults = await this.mapWithConcurrency(
                    batch,
                    this.REGISTRATION_CONCURRENCY,
                    async (reg) => {
                        try {
                            await this.processSingleRegistration(reg, job.events, job.correlation_id);
                            return { success: true, registrationId: reg.id };
                        } catch (err) {
                            logger.error({ err: err.message, registrationId: reg.id }, 'Failed to process single registration');
                            return {
                                success: false,
                                registrationId: reg.id,
                                error: err.message
                            };
                        }
                    }
                );

                for (const result of batchResults) {
                    if (result.success) {
                        processed++;
                    } else {
                        failed++;
                        errorLog.push({
                            registrationId: result.registrationId,
                            error: result.error,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                // Update job progress after each batch
                await supabase
                    .from('event_cancellation_jobs')
                    .update({
                        total_registrations: Math.max(job.total_registrations || 0, processed + failed),
                        processed_count: processed,
                        failed_count: failed,
                        error_log: errorLog,
                        last_processed_at: new Date().toISOString()
                    })
                    .eq('id', jobId);
            }

            // Mark job as COMPLETED
            await supabase
                .from('event_cancellation_jobs')
                .update({
                    status: failed > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', jobId);

            // Update event final status
            await supabase
                .from('events')
                .update({
                    cancellation_status: failed > 0 ? 'PARTIAL_FAILURE' : 'CANCELLED',
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.event_id);

            if (failed > 0) {
                await this.createJobAlert(job, job.events?.title, 'PARTIAL_FAILURE', {
                    processedCount: processed,
                    failedCount: failed
                });
            } else {
                await AdminAlertService.markAsReadByReference(this.ALERT_TYPE, job.id);
            }

            logger.info({
                module: 'EventCancellation',
                operation: 'JOB_END',
                jobId,
                processed,
                failed
            }, 'Finished processing event cancellation job');

        } catch (error) {
            logger.error({ err: error, jobId }, 'CRITICAL: Job processing failed with fatal error');
            await supabase
                .from('event_cancellation_jobs')
                .update({
                    status: 'FAILED',
                    updated_at: new Date().toISOString()
                })
                .eq('id', jobId);
            await supabase
                .from('events')
                .update({
                    cancellation_status: 'PARTIAL_FAILURE',
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.event_id);
            await this.createJobAlert(job, job.events?.title, 'FAILED', {
                error: error.message
            });
        }
    }

    /**
     * Process single registration: refund, email, status update
     */
    static async processSingleRegistration(registration, event, correlationId, cancellationReason = null) {
        // Ensure correlationId exists
        const cid = correlationId || uuidv4();
        const finalReason = cancellationReason || event.cancellation_reason;

        // 0. Idempotency check: Skip if already cancelled
        if (registration.status === 'cancelled') {
            logger.info({
                module: 'EventCancellation',
                operation: 'PROCESS_REGISTRATION',
                registrationId: registration.id,
                correlationId: cid,
                status: 'SKIPPED_ALREADY_CANCELLED'
            }, 'Registration already cancelled, skipping');
            return;
        }

        logger.info({
            module: 'EventCancellation',
            operation: 'PROCESS_REGISTRATION',
            registrationId: registration.id,
            correlationId: cid,
            status: 'STARTED'
        }, 'Processing registration cancellation');

        const isPaid = registration.payment_status === 'captured' || registration.payment_status === 'paid';
        let refundData = null;

        // 1. Handle Refund if Paid
        if (isPaid && registration.razorpay_payment_id) {
            try {
                // Initiate refund record (includes idempotency check inside service)
                const refundRecord = await EventRefundService.initiateRefund({
                    eventId: event.id,
                    userId: registration.user_id,
                    registrationId: registration.id,
                    paymentId: registration.razorpay_payment_id,
                    amount: registration.amount,
                    correlationId: cid
                });

                // Request refund from Razorpay only if not already processing
                if (refundRecord.status === 'INITIATED') {
                    const razorpayRefund = await refundPayment(registration.razorpay_payment_id, null, {
                        registration_id: registration.id,
                        event_id: event.id,
                        correlation_id: cid,
                        reason: finalReason || 'Cancellation'
                    });

                    // Update refund record
                    refundData = await EventRefundService.markProcessing(refundRecord.id, razorpayRefund.id);
                    logger.info({
                        module: 'EventCancellation',
                        registrationId: registration.id,
                        refundId: razorpayRefund.id,
                        correlationId: cid
                    }, 'Refund initiated successfully');
                } else {
                    refundData = refundRecord;
                    logger.info({
                        module: 'EventCancellation',
                        registrationId: registration.id,
                        refundStatus: refundRecord.status,
                        correlationId: cid
                    }, 'Refund already processing/settled');
                }
            } catch (refundError) {
                logger.error({
                    module: 'EventCancellation',
                    err: refundError,
                    registrationId: registration.id,
                    correlationId: cid
                }, 'Failed to process refund for registration');
                throw refundError;
            }
        }

        // 2. Update Registration Status
        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({
                status: 'cancelled',
                cancellation_reason: finalReason,
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', registration.id);

        if (updateError) {
            logger.error({
                module: 'EventCancellation',
                err: updateError,
                registrationId: registration.id,
                correlationId: cid
            }, 'Failed to update registration status');
            throw updateError;
        }

        // 2b. Decrement registrations count only for statuses that actually consume capacity.
        if (this.shouldAdjustEventCount(registration)) {
            const { error: rpcError } = await supabase.rpc('decrement_event_registrations', { p_event_id: event.id });

            if (rpcError) {
                logger.warn({ err: rpcError, eventId: event.id }, 'RPC decrement failed, using direct update');
                const { data: latestEvent, error: latestEventError } = await supabase
                    .from('events')
                    .select('registrations')
                    .eq('id', event.id)
                    .single();

                if (latestEventError) {
                    throw latestEventError;
                }

                await supabase
                    .from('events')
                    .update({
                        registrations: Math.max(0, (latestEvent?.registrations || 0) - 1),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', event.id);
            }
        }

        // 3. Send ONE consolidated email
        try {
            await emailService.sendEventCancellationEmail(
                registration.email,
                {
                    event: {
                        id: event.id,
                        title: event.title,
                        startDate: event.start_date,
                        location: event.location,
                        cancellationReason: finalReason
                    },
                    registration: {
                        id: registration.id,
                        registrationNumber: registration.registration_number
                    },
                    attendeeName: registration.full_name,
                    refundDetails: refundData ? {
                        amount: registration.amount,
                        isRefunded: false, // It's processing
                        refundId: refundData.gateway_reference
                    } : null
                },
                registration.user_id
            );
            logger.info({
                module: 'EventCancellation',
                registrationId: registration.id,
                correlationId: cid
            }, 'Cancellation email sent');
        } catch (emailError) {
            logger.error({
                module: 'EventCancellation',
                err: emailError,
                registrationId: registration.id,
                correlationId: cid
            }, 'Failed to send cancellation email');
            // Don't throw for email error to allow other registrations to process
        }
    }

    /**
     * Admin Action: Update Event Schedule (Postpone/Prepone)
     */
    static async updateEventSchedule(eventId, adminId, newSchedule, reason, correlationId) {
        logger.info({
            module: 'EventCancellation',
            operation: 'UPDATE_SCHEDULE',
            eventId,
            newSchedule,
            correlationId
        }, 'Updating event schedule');

        const { data: event, error: eventError } = await supabase
            .from('events')
            .update({
                start_date: newSchedule.startDate,
                end_date: newSchedule.endDate,
                updated_at: new Date().toISOString()
            })
            .eq('id', eventId)
            .select()
            .single();

        if (eventError) throw eventError;

        // Trigger async notification
        this.notifyScheduleUpdate(eventId, event, reason, correlationId).catch(err =>
            logger.error({ err: err.message, eventId }, 'Failed to trigger schedule update notifications')
        );

        return { success: true, event: mapToFrontend(event) };
    }

    /**
     * Async Notification for Schedule updates
     */
    static async notifyScheduleUpdate(eventId, event, reason, correlationId) {
        logger.info({ eventId, correlationId }, 'Starting schedule update notifications');

        let processed = 0;
        const batchSize = 50;
        let hasMore = true;

        while (hasMore) {
            const { data: registrations, error: regError } = await supabase
                .from('event_registrations')
                .select('*')
                .eq('event_id', eventId)
                .neq('status', 'cancelled')
                .range(processed, processed + batchSize - 1);

            if (regError) throw regError;
            if (!registrations || registrations.length === 0) break;

            await this.mapWithConcurrency(
                registrations,
                this.EMAIL_CONCURRENCY,
                async (reg) => {
                    try {
                        await emailService.sendEventUpdateEmail(
                            reg.email,
                            {
                                event: {
                                    title: event.title,
                                    startDate: event.start_date,
                                    endDate: event.end_date,
                                    location: event.location,
                                    updateReason: reason
                                },
                                attendeeName: reg.full_name
                            },
                            reg.user_id
                        );
                    } catch (err) {
                        logger.error({ err: err.message, registrationId: reg.id }, 'Failed to send schedule update email');
                    }
                }
            );

            processed += registrations.length;
            hasMore = registrations.length === batchSize;
        }

        logger.info({ eventId, totalNotified: processed }, 'Finished schedule update notifications');
    }

    static async processPendingJobs({ limit = 10 } = {}) {
        const staleBefore = new Date(Date.now() - this.STALE_JOB_TIMEOUT_MS).toISOString();

        const { data: pendingJobs, error: pendingError } = await supabase
            .from('event_cancellation_jobs')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true })
            .limit(limit);

        if (pendingError) throw pendingError;

        const remainingSlots = Math.max(0, limit - (pendingJobs?.length || 0));
        let staleJobs = [];

        if (remainingSlots > 0) {
            const { data: staleInProgressJobs, error: staleError } = await supabase
                .from('event_cancellation_jobs')
                .select('*')
                .eq('status', 'IN_PROGRESS')
                .lte('last_processed_at', staleBefore)
                .order('created_at', { ascending: true })
                .limit(remainingSlots);

            if (staleError) throw staleError;
            staleJobs = staleInProgressJobs || [];
        }

        const jobs = [...(pendingJobs || []), ...staleJobs];

        if (jobs.length === 0) {
            return { processed: 0 };
        }

        let processedJobs = 0;

        for (const job of jobs) {
            if (job.status === 'IN_PROGRESS') {
                let eventTitle = null;
                try {
                    const { data: eventData } = await supabase
                        .from('events')
                        .select('title')
                        .eq('id', job.event_id)
                        .maybeSingle();
                    eventTitle = eventData?.title || null;
                } catch (eventError) {
                    logger.warn({ err: eventError, jobId: job.id }, 'Failed to fetch event title for stale job alert');
                }

                await this.createJobAlert(job, eventTitle, 'STALE', {
                    lastProcessedAt: job.last_processed_at
                });

                const { error: resetError } = await supabase
                    .from('event_cancellation_jobs')
                    .update({
                        status: 'PENDING',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                if (resetError) {
                    logger.error({ err: resetError, jobId: job.id }, 'Failed to reset stale event cancellation job');
                    continue;
                }
            }

            try {
                await this.processJob(job.id);
                processedJobs++;
            } catch (jobError) {
                logger.error({ err: jobError, jobId: job.id }, 'Failed to process pending event cancellation job');
            }
        }

        return { processed: processedJobs };
    }
}


module.exports = EventCancellationService;
