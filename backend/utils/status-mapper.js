/**
 * Payment Status Mapper — Compatibility Layer (Phase A)
 * 
 * During the transition period, old status values coexist with new normalized values.
 * This mapper ensures:
 *   1. All DB reads return normalized UPPERCASE statuses
 *   2. All DB writes use normalized values
 *   3. Comparisons always work regardless of which format is stored
 * 
 * PHASE B (after 3-5 days stable): Remove this file and run the hard SQL migration.
 */

const { PAYMENT_STATUS } = require('../config/constants');

/**
 * Maps legacy/mixed-case payment status values to the normalized UPPERCASE format.
 * Unknown values pass through unchanged to avoid data loss.
 * 
 * @param {string} status - Raw payment status from DB or API
 * @returns {string} Normalized payment status
 */
const normalizePaymentStatus = (status) => {
    if (!status) return status;

    const LEGACY_MAP = {
        // Old order payment statuses
        'PAYMENT_SUCCESS': PAYMENT_STATUS.SUCCESS,
        'PAYMENT_FAILED': PAYMENT_STATUS.FAILED,
        'REFUND_COMPLETED': PAYMENT_STATUS.REFUNDED,
        'REFUND_PARTIAL': PAYMENT_STATUS.PARTIALLY_REFUNDED,

        // Old donation statuses (lowercase)
        'success': PAYMENT_STATUS.SUCCESS,
        'failed': PAYMENT_STATUS.FAILED,
        'refunded': PAYMENT_STATUS.REFUNDED,

        // Old event registration statuses
        'paid': PAYMENT_STATUS.SUCCESS,
        'captured': PAYMENT_STATUS.PENDING,

        // Common legacy statuses
        'pending': PAYMENT_STATUS.PENDING,
        'created': PAYMENT_STATUS.CREATED,
        'authorized': PAYMENT_STATUS.AUTHORIZED,
        'processed': PAYMENT_STATUS.SUCCESS,

        // Free payments (events)
        'free': 'free', // Pass-through: free events don't have a payment lifecycle
    };

    return LEGACY_MAP[status] || status;
};

/**
 * Check if a payment status represents a terminal SUCCESS state.
 * Use this instead of direct string comparison.
 * 
 * @param {string} status - Raw or normalized status
 * @returns {boolean}
 */
const isPaymentSuccess = (status) => {
    return normalizePaymentStatus(status) === PAYMENT_STATUS.SUCCESS;
};

/**
 * Check if a payment status represents a terminal FAILED/EXPIRED state.
 * 
 * @param {string} status - Raw or normalized status
 * @returns {boolean}
 */
const isPaymentFailed = (status) => {
    const normalized = normalizePaymentStatus(status);
    return normalized === PAYMENT_STATUS.FAILED || normalized === PAYMENT_STATUS.EXPIRED;
};

/**
 * Check if a payment is in a terminal state (no further transitions expected).
 * Terminal states: SUCCESS, FAILED, EXPIRED, REFUNDED, PARTIALLY_REFUNDED
 * 
 * @param {string} status - Raw or normalized status
 * @returns {boolean}
 */
const isTerminalStatus = (status) => {
    const TERMINAL = new Set([
        PAYMENT_STATUS.SUCCESS,
        PAYMENT_STATUS.FAILED,
        PAYMENT_STATUS.EXPIRED,
        PAYMENT_STATUS.REFUNDED,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ]);
    return TERMINAL.has(normalizePaymentStatus(status));
};

/**
 * Validates that a status transition is allowed.
 * Prevents state downgrades (e.g., SUCCESS → FAILED).
 * 
 * @param {string} currentStatus - Current status in DB (raw)
 * @param {string} newStatus - Proposed new status (normalized)
 * @returns {{ allowed: boolean, reason?: string }}
 */
const isTransitionAllowed = (currentStatus, newStatus) => {
    const current = normalizePaymentStatus(currentStatus);
    const next = normalizePaymentStatus(newStatus);

    // Same state — idempotent, but no-op
    if (current === next) {
        return { allowed: false, reason: 'IDEMPOTENT_NOOP' };
    }

    // Define allowed transitions
    const ALLOWED_TRANSITIONS = {
        [PAYMENT_STATUS.CREATED]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.EXPIRED],
        [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.EXPIRED, PAYMENT_STATUS.CAPTURED_ORPHAN],
        [PAYMENT_STATUS.AUTHORIZED]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.FAILED],
        [PAYMENT_STATUS.SUCCESS]: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED],
        [PAYMENT_STATUS.PARTIALLY_REFUNDED]: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED],
        [PAYMENT_STATUS.CAPTURED_ORPHAN]: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.REFUNDED],
        // Terminal: FAILED, EXPIRED, REFUNDED — no further transitions
        [PAYMENT_STATUS.FAILED]: [],
        [PAYMENT_STATUS.EXPIRED]: [PAYMENT_STATUS.PENDING], // Allow retry: EXPIRED → PENDING
        [PAYMENT_STATUS.REFUNDED]: [],
    };

    const allowed = ALLOWED_TRANSITIONS[current];

    if (!allowed) {
        // Unknown current state — allow transition (don't block recovery)
        return { allowed: true, reason: 'UNKNOWN_CURRENT_STATE' };
    }

    if (allowed.includes(next)) {
        return { allowed: true };
    }

    return { allowed: false, reason: `Transition ${current} → ${next} is not allowed` };
};

/**
 * Attempt a payment status transition with full enforcement.
 * 
 * Enforces:
 *   1. Transition must be in the allowed graph
 *   2. Only source='webhook' can set SUCCESS
 *   3. Returns structured result for audit logging
 * 
 * @param {string} currentStatus - Current status in DB (raw)
 * @param {string} newStatus - Proposed new status (normalized)
 * @param {string} source - Who is requesting the transition: 'webhook', 'verify', 'sweep', 'admin'
 * @returns {{ transitioned: boolean, from: string, to: string, reason?: string }}
 */
const transitionPaymentStatus = (currentStatus, newStatus, source = 'unknown') => {
    const from = normalizePaymentStatus(currentStatus);
    const to = normalizePaymentStatus(newStatus);

    // Rule: Only webhook can set SUCCESS
    if (to === PAYMENT_STATUS.SUCCESS && source !== 'webhook') {
        return {
            transitioned: false,
            from,
            to,
            reason: `SOURCE_NOT_AUTHORIZED: Only webhook can set SUCCESS (got: ${source})`,
        };
    }

    // Check transition graph
    const check = isTransitionAllowed(currentStatus, newStatus);
    if (!check.allowed) {
        return {
            transitioned: false,
            from,
            to,
            reason: check.reason,
        };
    }

    return {
        transitioned: true,
        from,
        to,
    };
};

module.exports = {
    normalizePaymentStatus,
    isPaymentSuccess,
    isPaymentFailed,
    isTerminalStatus,
    isTransitionAllowed,
    transitionPaymentStatus,
};
