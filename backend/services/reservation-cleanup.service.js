const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Reservation Cleanup Service
 * Automatically removes expired order number reservations to keep the system clean.
 */
class ReservationCleanupService {
    static intervalHandle = null;
    static startupHandle = null;

    /**
     * Delete expired reservations
     * Reservations older than 1 hour are considered abandoned.
     */
    static async cleanupExpiredReservations() {
        const startTime = Date.now();
        console.log('[ReservationCleanup] Starting expired reservations cleanup...');

        try {
            const { count, error } = await supabase
                .from('order_reservations')
                .delete()
                .lt('expires_at', new Date().toISOString());

            if (error) throw error;

            const duration = Date.now() - startTime;
            if (count > 0) {
                logger.info({ count, durationMs: duration }, 'Cleaned up expired order reservations');
            }
            return { success: true, count };
        } catch (error) {
            logger.error({ err: error }, 'Failed to cleanup expired reservations');
            return { success: false, error };
        }
    }

    /**
     * Initialize cleanup job
     * Typically called during server startup or by a cron manager.
     */
    static init() {
        if (this.intervalHandle || this.startupHandle) {
            logger.warn('Reservation cleanup service already initialized');
            return;
        }

        // Run every hour
        const CLEANUP_INTERVAL = 60 * 60 * 1000;

        this.intervalHandle = setInterval(() => {
            this.cleanupExpiredReservations();
        }, CLEANUP_INTERVAL);

        // Run once on startup after a short delay
        this.startupHandle = setTimeout(() => {
            this.cleanupExpiredReservations();
        }, 5000);

        if (typeof this.intervalHandle.unref === 'function') {
            this.intervalHandle.unref();
        }

        if (typeof this.startupHandle.unref === 'function') {
            this.startupHandle.unref();
        }

        logger.info('Reservation cleanup service initialized');
    }

    static stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }

        if (this.startupHandle) {
            clearTimeout(this.startupHandle);
            this.startupHandle = null;
        }
    }
}

module.exports = ReservationCleanupService;
