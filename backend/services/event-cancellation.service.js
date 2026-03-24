const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const EventRefundService = require('./event-refund.service');
const emailService = require('./email');
const { refundPayment } = require('../utils/razorpay-helper');
const { EVENT, LOGS } = require('../constants/messages');
const { mapToFrontend } = require('./event.utils');
const { v4: uuidv4 } = require('uuid');
const { translate } = require('../utils/i18n.util');

/**
 * Event Cancellation Service
 * Orchestrates admin-initiated cancellations and async processing
 */
class EventCancellationService {
    static REGISTRATION_CONCURRENCY = 5;
    static EMAIL_CONCURRENCY = 10;

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
                last_processed_at: new Date().toISOString()
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

            // Process registrations in batches
            while (processed + failed < job.total_registrations) {
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
                    completed_at: new Date().toISOString()
                })
                .eq('id', jobId);

            // Update event final status
            await supabase
                .from('events')
                .update({ cancellation_status: 'CANCELLED' })
                .eq('id', job.event_id);

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
                .update({ status: 'FAILED' })
                .eq('id', jobId);
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

        // 2b. Decrement registrations count on event to free up slot
        const { error: rpcError } = await supabase.rpc('decrement_event_registrations', { p_event_id: event.id });

        if (rpcError) {
            logger.warn({ err: rpcError, eventId: event.id }, 'RPC decrement failed, using direct update');
            // Fallback: direct update
            await supabase
                .from('events')
                .update({ registrations: Math.max(0, (event.registrations || 1) - 1) })
                .eq('id', event.id);
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
}


module.exports = EventCancellationService;
