/**
 * ReservationCleanupService — SUNSETTED
 *
 * Cleanup of expired `order_reservations` rows is now handled by
 * the Supabase pg_cron job 'reservation-cleanup-job' (every hour):
 *
 *   DELETE FROM order_reservations WHERE expires_at < NOW();
 *
 * See: backend/migrations/20260412_add_pg_cron_jobs.sql
 *
 * This file intentionally exports no-op stubs so that any lingering
 * import does not crash the server.
 */

class ReservationCleanupService {
    static async cleanupExpiredReservations() {
        // No-op: handled by pg_cron 'reservation-cleanup-job'
    }

    static init() {
        // No-op: handled by pg_cron 'reservation-cleanup-job'
    }

    static stop() {
        // No-op: handled by pg_cron 'reservation-cleanup-job'
    }
}

module.exports = ReservationCleanupService;
