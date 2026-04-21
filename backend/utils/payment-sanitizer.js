/**
 * Payment Sanitizer — Redact sensitive fields from Razorpay payloads before logging/storage
 * 
 * NEVER log or store:
 *   - Full card details (number, cvv, expiry)
 *   - Full bank account numbers
 *   - Full VPA/UPI IDs
 * 
 * ALWAYS keep:
 *   - payment.id, order_id, amount, status, method, notes, error_code
 *   - card.last4, card.network (safe for debugging)
 */

const REDACTED = '[REDACTED]';

/**
 * Mask a string, keeping first and last N characters.
 * @param {string} str
 * @param {number} keepStart
 * @param {number} keepEnd
 * @returns {string}
 */
function maskString(str, keepStart = 2, keepEnd = 2) {
    if (!str || typeof str !== 'string') return str;
    if (str.length <= keepStart + keepEnd + 2) return '***';
    return str.slice(0, keepStart) + '***' + str.slice(-keepEnd);
}

/**
 * Sanitize a Razorpay payment entity for safe logging.
 * @param {Object} payment - Razorpay payment entity
 * @returns {Object} Sanitized copy (original unchanged)
 */
function sanitizePaymentEntity(payment) {
    if (!payment || typeof payment !== 'object') return payment;

    const safe = { ...payment };

    // Redact card details (keep last4 and network for debugging)
    if (safe.card) {
        safe.card = {
            last4: safe.card.last4 || null,
            network: safe.card.network || null,
            type: safe.card.type || null,
            issuer: safe.card.issuer || null,
            // Everything else redacted
        };
    }

    // Redact full card number if present at root
    if (safe.card_id) {
        safe.card_id = maskString(safe.card_id);
    }

    // Redact bank account details
    if (safe.bank_account) {
        safe.bank_account = {
            bank_name: safe.bank_account.bank_name || null,
            ifsc: safe.bank_account.ifsc || null,
            account_number: REDACTED,
            name: REDACTED,
        };
    }

    // Mask VPA/UPI ID (keep provider suffix)
    if (safe.vpa) {
        const parts = safe.vpa.split('@');
        safe.vpa = parts.length === 2
            ? maskString(parts[0], 1, 1) + '@' + parts[1]
            : maskString(safe.vpa);
    }

    // Redact wallet details
    if (safe.wallet) {
        // Keep wallet provider name, redact everything else
        safe.wallet = typeof safe.wallet === 'string' ? safe.wallet : REDACTED;
    }

    // Redact contact/email if present (PII)
    if (safe.contact) safe.contact = maskString(safe.contact, 3, 2);
    if (safe.email) safe.email = maskString(safe.email, 2, 4);

    // Redact token if present
    if (safe.token_id) safe.token_id = REDACTED;

    return safe;
}

/**
 * Sanitize a full Razorpay webhook payload for safe storage.
 * @param {Object} payload - Full webhook payload (contains .payment.entity, .refund.entity, etc.)
 * @returns {Object} Sanitized copy
 */
function sanitizeWebhookPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;

    const safe = JSON.parse(JSON.stringify(payload)); // Deep clone

    // Sanitize payment entity
    if (safe.payment?.entity) {
        safe.payment.entity = sanitizePaymentEntity(safe.payment.entity);
    }

    // Sanitize refund entity (contains payment references)
    if (safe.refund?.entity) {
        if (safe.refund.entity.card) {
            safe.refund.entity.card = {
                last4: safe.refund.entity.card.last4 || null,
                network: safe.refund.entity.card.network || null,
            };
        }
    }

    // Sanitize subscription entity
    if (safe.subscription?.entity) {
        if (safe.subscription.entity.customer_id) {
            safe.subscription.entity.customer_id = maskString(safe.subscription.entity.customer_id);
        }
    }

    return safe;
}

/**
 * Mask a Razorpay payment ID for safe logging at info level.
 * Keeps prefix and last 4 chars: pay_ABC***XYZ4
 * @param {string} paymentId
 * @returns {string}
 */
function maskPaymentId(paymentId) {
    if (!paymentId || typeof paymentId !== 'string') return paymentId;
    if (paymentId.length <= 10) return paymentId; // Too short to mask
    return paymentId.slice(0, 6) + '***' + paymentId.slice(-4);
}

module.exports = {
    sanitizePaymentEntity,
    sanitizeWebhookPayload,
    maskPaymentId,
    maskString,
    REDACTED,
};
