/**
 * Payment Sweep Service
 * 
 * Reconciliation cron job that polls Razorpay for CREATED/PENDING payments
 * that haven't received a webhook within the configured timeout.
 * 
 * Per-module timeouts:
 *   - E-commerce: 15 min (orders)
 *   - Events: 10 min (seat locking urgency)
 *   - Donations: 30 min (no urgency)
 * 
 * Concurrency: Uses pg_try_advisory_lock to prevent duplicate runs.
 * Run frequency: Every 5 minutes via cron
 */

const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const { PAYMENT_STATUS, PAYMENT_SWEEP_TIMEOUTS } = require('../config/constants');
const { normalizePaymentStatus, isPaymentSuccess } = require('../utils/status-mapper');
const { getRazorpayInstance } = require('../utils/razorpay-helper');
const { emitPaymentEvent } = require('../utils/payment-event-logger');
const webhookService = require('./webhook.service');
const { updatePaymentRecord } = require('./checkout.service');

const log = createModuleLogger('PaymentSweep');

const ADVISORY_LOCK_ID = 777002; // Unique ID for payment sweep lock

class PaymentSweepService {
    /**
     * Run the full payment sweep cycle.
     * Acquires advisory lock to prevent duplicate runs across instances.
     */
    static async runSweep() {
        // 1. Acquire advisory lock
        const lockAcquired = await this._tryAdvisoryLock();
        if (!lockAcquired) {
            log.debug('SWEEP_SKIP', 'Another sweep instance is active, skipping');
            return { skipped: true, reason: 'lock_held' };
        }

        const startTime = Date.now();
        emitPaymentEvent('sweep_started', { source: 'cron' });

        log.operationStart('PAYMENTSweep', {});

        const results = {
            payments: { total: 0, resolved: 0, expired: 0, failed: 0, skipped: 0 },
            events: { total: 0, resolved: 0, expired: 0, failed: 0, skipped: 0 },
            donations: { total: 0, resolved: 0, expired: 0, failed: 0, skipped: 0 },
        };

        try {
            // 2. Sweep stale PAYMENTS (e-commerce orders)
            results.payments = await this._sweepPayments();

            // 3. Sweep stale EVENT REGISTRATIONS
            results.events = await this._sweepEventRegistrations();

            // 4. Sweep stale DONATIONS
            results.donations = await this._sweepDonations();

            log.operationSuccess('PAYMENT_SWEEP', { results });

            emitPaymentEvent('sweep_completed', {
                source: 'cron',
                durationMs: Date.now() - startTime,
                extra: {
                    totalRecovered: results.payments.resolved + results.events.resolved + results.donations.resolved,
                    totalExpired: results.payments.expired + results.events.expired + results.donations.expired,
                },
            });
        } catch (error) {
            log.operationError('PAYMENT_SWEEP', error);
        } finally {
            await this._releaseAdvisoryLock();
        }

        return results;
    }

    /**
     * Try to acquire PostgreSQL advisory lock (non-blocking).
     */
    static async _tryAdvisoryLock() {
        try {
            const { data, error } = await (supabaseAdmin || supabase)
                .rpc('pg_try_advisory_lock', { lock_id: ADVISORY_LOCK_ID });
            if (error) {
                log.debug('ADVISORY_LOCK_SKIP', 'Advisory lock unavailable, proceeding without');
                return true; // Fail open
            }
            return data === true;
        } catch {
            return true;
        }
    }

    /**
     * Release advisory lock.
     */
    static async _releaseAdvisoryLock() {
        try {
            await (supabaseAdmin || supabase)
                .rpc('pg_advisory_unlock', { lock_id: ADVISORY_LOCK_ID });
        } catch {
            // Non-critical
        }
    }

    /**
     * Sweep stale payments (e-commerce orders)
     */
    static async _sweepPayments() {
        const cutoff = new Date(Date.now() - PAYMENT_SWEEP_TIMEOUTS.ECOMMERCE * 60 * 1000).toISOString();

        const { data: stalePayments, error } = await supabase
            .from('payments')
            .select('id, razorpay_order_id, razorpay_payment_id, status, created_at')
            .in('status', [
                PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING,
                // Legacy values during Phase A
                'created', 'captured', 'pending'
            ])
            .lt('created_at', cutoff)
            .limit(50);

        if (error) {
            log.operationError('SWEEP_PAYMENTS_FETCH', error);
            return { total: 0, resolved: 0, expired: 0, failed: 0, skipped: 0 };
        }

        const results = { total: stalePayments?.length || 0, resolved: 0, expired: 0, failed: 0, skipped: 0 };
        if (!stalePayments || stalePayments.length === 0) return results;

        log.info('SWEEP_FOUND', `Found ${results.total} stale payments`, { cutoff });

        const razorpay = getRazorpayInstance();

        for (const payment of stalePayments) {
            try {
                if (!payment.razorpay_payment_id) {
                    // No Razorpay payment ID — payment was never initiated
                    await updatePaymentRecord(payment.id, { status: PAYMENT_STATUS.EXPIRED });
                    emitPaymentEvent('payment_expired', { paymentId: payment.id, module: 'checkout', source: 'sweep' });
                    results.expired++;
                    continue;
                }

                // Poll Razorpay for actual status
                const rzpPayment = await razorpay.payments.fetch(payment.razorpay_payment_id);

                if (rzpPayment.status === 'captured') {
                    // Webhook was missed — manually trigger the webhook handler
                    log.info('SWEEP_CAPTURED', `Missed webhook: ${payment.razorpay_payment_id} is captured. Triggering recovery.`);
                    await webhookService.handleEvent({
                        event: 'payment.captured',
                        payload: { payment: { entity: rzpPayment } }
                    });
                    emitPaymentEvent('sweep_recovered', { paymentId: payment.id, razorpayId: payment.razorpay_payment_id, module: 'checkout', source: 'sweep' });
                    results.resolved++;
                } else if (rzpPayment.status === 'failed') {
                    await updatePaymentRecord(payment.id, {
                        status: PAYMENT_STATUS.FAILED,
                        error_description: rzpPayment.error_description || 'Payment failed (detected by sweep)'
                    });
                    results.failed++;
                } else if (rzpPayment.status === 'authorized') {
                    // Leave authorized for manual review — don't auto-expire
                    log.info('SWEEP_AUTHORIZED', `Payment ${payment.razorpay_payment_id} is authorized. Skipping.`);
                    results.skipped++;
                } else {
                    // Unknown status or 'created' in Razorpay — mark as EXPIRED
                    await updatePaymentRecord(payment.id, { status: PAYMENT_STATUS.EXPIRED });
                    emitPaymentEvent('payment_expired', { paymentId: payment.id, razorpayId: payment.razorpay_payment_id, module: 'checkout', source: 'sweep' });
                    results.expired++;
                }
            } catch (err) {
                log.operationError('SWEEP_SINGLE_PAYMENT', err, { paymentId: payment.id });
                results.skipped++;
            }
        }

        return results;
    }

    /**
     * Sweep stale event registrations
     */
    static async _sweepEventRegistrations() {
        const cutoff = new Date(Date.now() - PAYMENT_SWEEP_TIMEOUTS.EVENT * 60 * 1000).toISOString();

        const { data: staleRegs, error } = await supabase
            .from('event_registrations')
            .select('id, razorpay_order_id, razorpay_payment_id, payment_status, created_at')
            .in('payment_status', [
                PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING,
                'created', 'captured', 'pending'
            ])
            .lt('created_at', cutoff)
            .limit(50);

        if (error) {
            log.operationError('SWEEP_EVENTS_FETCH', error);
            return { total: 0, resolved: 0, expired: 0, failed: 0, skipped: 0 };
        }

        const results = { total: staleRegs?.length || 0, resolved: 0, expired: 0, failed: 0, skipped: 0 };
        if (!staleRegs || staleRegs.length === 0) return results;

        log.info('SWEEP_EVENTS_FOUND', `Found ${results.total} stale event registrations`, { cutoff });

        const razorpay = getRazorpayInstance();

        for (const reg of staleRegs) {
            try {
                if (!reg.razorpay_payment_id) {
                    await supabase.from('event_registrations').update({
                        payment_status: PAYMENT_STATUS.EXPIRED,
                        status: 'expired',
                        updated_at: new Date().toISOString()
                    }).eq('id', reg.id);
                    results.expired++;
                    continue;
                }

                const rzpPayment = await razorpay.payments.fetch(reg.razorpay_payment_id);

                if (rzpPayment.status === 'captured') {
                    log.info('SWEEP_EVENT_CAPTURED', `Missed webhook for event reg: ${reg.id}`);
                    await webhookService.handleEvent({
                        event: 'payment.captured',
                        payload: {
                            payment: { entity: rzpPayment }
                        }
                    });
                    results.resolved++;
                } else if (rzpPayment.status === 'failed') {
                    await supabase.from('event_registrations').update({
                        payment_status: PAYMENT_STATUS.FAILED,
                        status: 'failed',
                        updated_at: new Date().toISOString()
                    }).eq('id', reg.id);
                    results.failed++;
                } else {
                    await supabase.from('event_registrations').update({
                        payment_status: PAYMENT_STATUS.EXPIRED,
                        status: 'expired',
                        updated_at: new Date().toISOString()
                    }).eq('id', reg.id);
                    results.expired++;
                }
            } catch (err) {
                log.operationError('SWEEP_SINGLE_EVENT', err, { regId: reg.id });
                results.skipped++;
            }
        }

        return results;
    }

    /**
     * Sweep stale donations
     */
    static async _sweepDonations() {
        const cutoff = new Date(Date.now() - PAYMENT_SWEEP_TIMEOUTS.DONATION * 60 * 1000).toISOString();

        const { data: staleDonations, error } = await supabase
            .from('donations')
            .select('id, razorpay_order_id, razorpay_payment_id, payment_status, created_at')
            .in('payment_status', [
                PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING,
                'created', 'pending', 'authorized'
            ])
            .lt('created_at', cutoff)
            .limit(50);

        if (error) {
            log.operationError('SWEEP_DONATIONS_FETCH', error);
            return { total: 0, resolved: 0, expired: 0, failed: 0, skipped: 0 };
        }

        const results = { total: staleDonations?.length || 0, resolved: 0, expired: 0, failed: 0, skipped: 0 };
        if (!staleDonations || staleDonations.length === 0) return results;

        log.info('SWEEP_DONATIONS_FOUND', `Found ${results.total} stale donations`, { cutoff });

        const razorpay = getRazorpayInstance();

        for (const donation of staleDonations) {
            try {
                if (!donation.razorpay_payment_id) {
                    await supabase.from('donations').update({
                        payment_status: PAYMENT_STATUS.EXPIRED,
                        updated_at: new Date().toISOString()
                    }).eq('id', donation.id);
                    results.expired++;
                    continue;
                }

                const rzpPayment = await razorpay.payments.fetch(donation.razorpay_payment_id);

                if (rzpPayment.status === 'captured') {
                    log.info('SWEEP_DONATION_CAPTURED', `Missed webhook for donation: ${donation.id}`);
                    await webhookService.handleEvent({
                        event: 'payment.captured',
                        payload: {
                            payment: { entity: rzpPayment }
                        }
                    });
                    results.resolved++;
                } else if (rzpPayment.status === 'failed') {
                    await supabase.from('donations').update({
                        payment_status: PAYMENT_STATUS.FAILED,
                        updated_at: new Date().toISOString()
                    }).eq('id', donation.id);
                    results.failed++;
                } else {
                    await supabase.from('donations').update({
                        payment_status: PAYMENT_STATUS.EXPIRED,
                        updated_at: new Date().toISOString()
                    }).eq('id', donation.id);
                    results.expired++;
                }
            } catch (err) {
                log.operationError('SWEEP_SINGLE_DONATION', err, { donationId: donation.id });
                results.skipped++;
            }
        }

        return results;
    }
}

module.exports = PaymentSweepService;
