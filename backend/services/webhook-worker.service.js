/**
 * Webhook Worker Service — DB-backed durable queue processor
 * 
 * Architecture:
 *   1. Webhook API receives event → inserts into webhook_logs with status='PENDING'
 *   2. This worker polls DB every N seconds → claims batch → processes → marks DONE/FAILED
 *   3. Failed events get exponential backoff retry (max 5 attempts)
 *   4. After max retries → DEAD_LETTER for manual review
 * 
 * Concurrency Safety:
 *   - Uses locked_at/locked_by pattern (poor man's SELECT FOR UPDATE SKIP LOCKED)
 *   - Stale locks (>5 min) are auto-released
 *   - Advisory lock prevents duplicate worker instances
 * 
 * Why not BullMQ/Redis:
 *   - No Redis in stack. Supabase-only architecture.
 *   - DB queue is sufficient for current scale (<1000 webhooks/day).
 *   - Can be swapped for BullMQ later without changing business logic.
 */

const { supabaseAdmin } = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const webhookService = require('./webhook.service');
const { emitPaymentEvent } = require('../utils/payment-event-logger');
const crypto = require('crypto');

const log = createModuleLogger('WebhookWorker');

// Worker configuration
const WORKER_CONFIG = {
    BATCH_SIZE: 10,                    // Max events per poll cycle
    LOCK_TIMEOUT_MS: 5 * 60 * 1000,   // 5 min — stale lock threshold
    MAX_RETRIES: 5,                    // Max retry attempts
    BASE_RETRY_DELAY_MS: 5000,        // 5s base for exponential backoff
    MAX_JITTER_MS: 1000,              // Random jitter ceiling to prevent retry clustering
    ADVISORY_LOCK_ID: 777001,         // Unique ID for pg_advisory_lock
};

// Unique worker ID for lock ownership
const WORKER_ID = `worker_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

class WebhookWorkerService {
    /**
     * Main poll cycle — called by scheduler every 5-10 seconds.
     * Acquires advisory lock to prevent duplicate workers, then processes batch.
     */
    static async poll() {
        // 1. Try advisory lock (non-blocking)
        const lockAcquired = await this._tryAdvisoryLock();
        if (!lockAcquired) {
            return { skipped: true, reason: 'Another worker instance is active' };
        }

        try {
            // 2. Release stale locks from crashed workers
            await this._releaseStaleLocksIfAny();

            // 3. Claim and process batch
            const results = await this._processBatch();
            return results;
        } finally {
            // 4. Release advisory lock
            await this._releaseAdvisoryLock();
        }
    }

    /**
     * Claim a batch of PENDING/FAILED events and process them.
     */
    static async _processBatch() {
        const results = { processed: 0, failed: 0, deadLettered: 0, total: 0 };

        // Claim batch: find PENDING or FAILED events ready for retry
        const now = new Date().toISOString();

        const { data: events, error } = await supabaseAdmin
            .from('webhook_logs')
            .update({
                status: 'PROCESSING',
                locked_at: now,
                locked_by: WORKER_ID,
                updated_at: now,
            })
            .or(`status.eq.PENDING,and(status.eq.FAILED,next_retry_at.lte.${now})`)
            .is('locked_at', null)
            .eq('signature_verified', true)
            .order('created_at', { ascending: true })
            .limit(WORKER_CONFIG.BATCH_SIZE)
            .select('id, event_type, event_id, payload, retry_count, created_at');

        if (error) {
            log.operationError('WORKER_CLAIM', error);
            return results;
        }

        if (!events || events.length === 0) {
            return results;
        }

        results.total = events.length;
        log.debug('WORKER_BATCH', `Claimed ${events.length} webhook events for processing`);

        // Process each event
        for (const event of events) {
            const startTime = Date.now();
            try {
                // Reconstruct the event object that handleEvent expects
                const webhookEvent = {
                    event: event.event_type,
                    payload: event.payload,
                };

                await webhookService.handleEvent(webhookEvent);

                // Mark as DONE
                await supabaseAdmin
                    .from('webhook_logs')
                    .update({
                        status: 'DONE',
                        processed: true,
                        processed_at: new Date().toISOString(),
                        locked_at: null,
                        locked_by: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', event.id);

                results.processed++;

                emitPaymentEvent('webhook_processed', {
                    paymentId: event.event_id,
                    module: event.event_type,
                    source: 'worker',
                    durationMs: Date.now() - startTime,
                });

            } catch (err) {
                const newRetryCount = (event.retry_count || 0) + 1;

                if (newRetryCount >= WORKER_CONFIG.MAX_RETRIES) {
                    // Dead letter — exceeded max retries
                    await supabaseAdmin
                        .from('webhook_logs')
                        .update({
                            status: 'DEAD_LETTER',
                            retry_count: newRetryCount,
                            error_message: err.message,
                            locked_at: null,
                            locked_by: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', event.id);

                    results.deadLettered++;
                    log.warn('WORKER_DEAD_LETTER', `Event ${event.id} exceeded max retries`, {
                        eventId: event.event_id,
                        eventType: event.event_type,
                        retryCount: newRetryCount,
                        error: err.message,
                    });

                    emitPaymentEvent('dead_lettered', {
                        paymentId: event.event_id,
                        module: event.event_type,
                        source: 'worker',
                        extra: { reason: 'MAX_RETRIES_EXCEEDED', retries: newRetryCount, error: err.message },
                    });
                } else {
                    // Schedule retry with exponential backoff + jitter
                    const jitter = Math.floor(Math.random() * WORKER_CONFIG.MAX_JITTER_MS);
                    const delayMs = WORKER_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, newRetryCount - 1) + jitter;
                    const nextRetry = new Date(Date.now() + delayMs).toISOString();

                    await supabaseAdmin
                        .from('webhook_logs')
                        .update({
                            status: 'FAILED',
                            retry_count: newRetryCount,
                            next_retry_at: nextRetry,
                            error_message: err.message,
                            locked_at: null,
                            locked_by: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', event.id);

                    results.failed++;
                    log.warn('WORKER_RETRY_SCHEDULED', `Event ${event.id} retry #${newRetryCount} at ${nextRetry}`, {
                        eventId: event.event_id,
                        retryCount: newRetryCount,
                        nextRetryAt: nextRetry,
                        error: err.message,
                    });

                    emitPaymentEvent('retry_scheduled', {
                        paymentId: event.event_id,
                        module: event.event_type,
                        source: 'worker',
                        extra: { retryCount: newRetryCount, nextRetryAt: nextRetry, delayMs },
                    });
                }
            }
        }

        if (results.processed > 0 || results.failed > 0 || results.deadLettered > 0) {
            log.info('WORKER_BATCH_COMPLETE', `Batch done: ${results.processed} ok, ${results.failed} retry, ${results.deadLettered} dead`, results);
        }

        return results;
    }

    /**
     * Release locks held by crashed workers (locked_at older than threshold).
     */
    static async _releaseStaleLocksIfAny() {
        const threshold = new Date(Date.now() - WORKER_CONFIG.LOCK_TIMEOUT_MS).toISOString();

        const { data, error } = await supabaseAdmin
            .from('webhook_logs')
            .update({
                status: 'PENDING', // Reset to PENDING so they get picked up again
                locked_at: null,
                locked_by: null,
                updated_at: new Date().toISOString(),
            })
            .eq('status', 'PROCESSING')
            .lt('locked_at', threshold)
            .select('id');

        if (error) {
            log.warn('STALE_LOCK_RELEASE_ERROR', 'Failed to release stale locks', { error: error.message });
        } else if (data && data.length > 0) {
            log.info('STALE_LOCKS_RELEASED', `Released ${data.length} stale worker locks`);
        }
    }

    /**
     * Try to acquire a PostgreSQL advisory lock (non-blocking).
     * Prevents multiple worker instances from running simultaneously.
     */
    static async _tryAdvisoryLock() {
        try {
            const { data, error } = await supabaseAdmin
                .rpc('pg_try_advisory_lock', { lock_id: WORKER_CONFIG.ADVISORY_LOCK_ID });

            if (error) {
                // If RPC doesn't exist, skip locking (dev environment)
                log.debug('ADVISORY_LOCK_SKIP', 'Advisory lock RPC not available, proceeding without lock');
                return true;
            }
            return data === true;
        } catch {
            return true; // Fail open — better to double-process than miss events
        }
    }

    /**
     * Release the advisory lock.
     */
    static async _releaseAdvisoryLock() {
        try {
            await supabaseAdmin
                .rpc('pg_advisory_unlock', { lock_id: WORKER_CONFIG.ADVISORY_LOCK_ID });
        } catch {
            // Non-critical — lock auto-releases when connection closes
        }
    }

    /**
     * Get queue depth stats + lag monitoring.
     * Lag = current_time - oldest_pending_event.created_at
     */
    static async getQueueStats() {
        try {
            // Get counts per status (single query per status — no SELECT *)
            const statuses = ['PENDING', 'PROCESSING', 'FAILED', 'DEAD_LETTER', 'DONE'];
            const stats = {};

            for (const status of statuses) {
                const { count } = await supabaseAdmin
                    .from('webhook_logs')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', status);
                stats[status.toLowerCase()] = count || 0;
            }

            // Compute queue lag: time since oldest PENDING event
            let lag = null;
            let alertLevel = 'ok';

            if (stats.pending > 0) {
                const { data: oldest } = await supabaseAdmin
                    .from('webhook_logs')
                    .select('created_at')
                    .eq('status', 'PENDING')
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();

                if (oldest) {
                    const lagMs = Date.now() - new Date(oldest.created_at).getTime();
                    lag = {
                        ms: lagMs,
                        seconds: Math.round(lagMs / 1000),
                        human: lagMs < 1000 ? `${lagMs}ms` : `${Math.round(lagMs / 1000)}s`,
                    };

                    if (lagMs > 30000) {
                        alertLevel = 'critical';
                    } else if (lagMs > 10000) {
                        alertLevel = 'warning';
                    }
                }
            }

            return {
                counts: stats,
                lag,
                alertLevel,
                checkedAt: new Date().toISOString(),
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Get dead-lettered events for admin review.
     * @param {number} limit
     * @returns {Array} Dead letter events (no full payload for security)
     */
    static async getDeadLetterEvents(limit = 50) {
        const { data, error } = await supabaseAdmin
            .from('webhook_logs')
            .select('id, event_type, event_id, error_message, retry_count, created_at, updated_at')
            .eq('status', 'DEAD_LETTER')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Retry a dead-lettered event by resetting it to PENDING.
     * Preserves retry_count history in error_message.
     * @param {string} webhookLogId
     */
    static async retryDeadLetter(webhookLogId) {
        // Fetch current record
        const { data: event, error: fetchError } = await supabaseAdmin
            .from('webhook_logs')
            .select('id, status, retry_count, error_message')
            .eq('id', webhookLogId)
            .single();

        if (fetchError || !event) {
            throw new Error(`Webhook log ${webhookLogId} not found`);
        }

        if (event.status !== 'DEAD_LETTER') {
            throw new Error(`Cannot retry: status is ${event.status}, expected DEAD_LETTER`);
        }

        const { error: updateError } = await supabaseAdmin
            .from('webhook_logs')
            .update({
                status: 'PENDING',
                locked_at: null,
                locked_by: null,
                next_retry_at: null,
                error_message: `[MANUAL_RETRY] Previous: ${event.error_message || 'none'} (retries: ${event.retry_count})`,
                // Keep retry_count — it continues from where it left off
                // Reset to 0 to give full 5 retries again
                retry_count: 0,
                updated_at: new Date().toISOString(),
            })
            .eq('id', webhookLogId);

        if (updateError) throw updateError;

        log.info('DEAD_LETTER_RETRIED', `Dead letter ${webhookLogId} moved back to PENDING for manual retry`);
        return { id: webhookLogId, newStatus: 'PENDING' };
    }

    /**
     * Purge old processed webhook logs for data retention.
     * Deletes DONE and DEAD_LETTER records older than retentionDays.
     * @param {number} retentionDays - Default 7 days
     */
    static async purgeOldLogs(retentionDays = 7) {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('webhook_logs')
            .delete()
            .in('status', ['DONE', 'DEAD_LETTER'])
            .lt('created_at', cutoff)
            .select('id');

        if (error) {
            log.operationError('PURGE_OLD_LOGS', error);
            return { deleted: 0, error: error.message };
        }

        const deletedCount = data?.length || 0;
        if (deletedCount > 0) {
            log.info('WEBHOOK_LOGS_PURGED', `Deleted ${deletedCount} old webhook logs (older than ${retentionDays} days)`);
        }

        return { deleted: deletedCount, cutoff, retentionDays };
    }
}

module.exports = WebhookWorkerService;

