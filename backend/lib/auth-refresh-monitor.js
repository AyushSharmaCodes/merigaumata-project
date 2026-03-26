const { supabaseAdmin } = require('./supabase');
const logger = require('../utils/logger');

const AUTH_REFRESH_METRICS_TABLE = 'auth_refresh_metrics';
const DEFAULT_SINCE_MINUTES = 24 * 60;
const DEFAULT_RECENT_LIMIT = 25;

function getClient() {
    if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
        return null;
    }

    return supabaseAdmin;
}

function buildSinceIso(sinceMinutes = DEFAULT_SINCE_MINUTES) {
    const safeMinutes = Number.isFinite(Number(sinceMinutes)) ? Number(sinceMinutes) : DEFAULT_SINCE_MINUTES;
    return new Date(Date.now() - safeMinutes * 60 * 1000).toISOString();
}

async function insertEvent(event) {
    const client = getClient();
    if (!client) {
        return;
    }

    const { error } = await client
        .from(AUTH_REFRESH_METRICS_TABLE)
        .insert({
            event_type: event.eventType,
            reason: event.reason || null,
            correlation_id: event.correlationId || null,
            user_id: event.userId || null,
            status_code: event.statusCode ?? null,
            has_refresh_token_cookie: event.hasRefreshTokenCookie ?? null,
            has_access_token_cookie: event.hasAccessTokenCookie ?? null,
            rotated_refresh_token: event.rotatedRefreshToken ?? null,
            metadata: event.metadata || {}
        });

    if (error) {
        logger.warn({ err: error, eventType: event.eventType }, '[AuthRefreshMonitor] Failed to write refresh metric');
    }
}

async function countByFilter({ sinceIso, eventType, reason }) {
    const client = getClient();
    if (!client) {
        return 0;
    }

    let query = client
        .from(AUTH_REFRESH_METRICS_TABLE)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sinceIso);

    if (eventType) {
        query = query.eq('event_type', eventType);
    }

    if (reason) {
        query = query.eq('reason', reason);
    }

    const { count, error } = await query;
    if (error) {
        throw error;
    }

    return count || 0;
}

async function getRecentEvents({ sinceIso, recentLimit }) {
    const client = getClient();
    if (!client) {
        return [];
    }

    const { data, error } = await client
        .from(AUTH_REFRESH_METRICS_TABLE)
        .select('event_type, reason, correlation_id, user_id, status_code, has_refresh_token_cookie, has_access_token_cookie, rotated_refresh_token, metadata, created_at')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(recentLimit);

    if (error) {
        throw error;
    }

    return (data || []).map((event) => ({
        type: event.event_type,
        reason: event.reason || undefined,
        correlationId: event.correlation_id || undefined,
        userId: event.user_id || undefined,
        status: event.status_code ?? undefined,
        hasRefreshTokenCookie: event.has_refresh_token_cookie ?? undefined,
        hasAccessTokenCookie: event.has_access_token_cookie ?? undefined,
        rotatedRefreshToken: event.rotated_refresh_token ?? undefined,
        metadata: event.metadata || {},
        timestamp: event.created_at
    }));
}

async function recordAttempt(details = {}) {
    return insertEvent({
        eventType: 'attempt',
        correlationId: details.correlationId,
        hasRefreshTokenCookie: details.hasRefreshTokenCookie,
        metadata: {}
    });
}

async function recordSuccess(details = {}) {
    return insertEvent({
        eventType: 'success',
        correlationId: details.correlationId,
        userId: details.userId,
        rotatedRefreshToken: details.rotatedRefreshToken,
        metadata: {}
    });
}

async function recordMissingCookie(details = {}) {
    return insertEvent({
        eventType: 'missing_cookie',
        correlationId: details.correlationId,
        hasAccessTokenCookie: details.hasAccessTokenCookie,
        metadata: {}
    });
}

async function recordFailure(reason, details = {}) {
    return insertEvent({
        eventType: 'failure',
        reason,
        correlationId: details.correlationId,
        userId: details.userId,
        statusCode: details.status,
        metadata: {}
    });
}

async function getSnapshot(options = {}) {
    const sinceMinutes = Number(options.sinceMinutes) > 0 ? Number(options.sinceMinutes) : DEFAULT_SINCE_MINUTES;
    const recentLimit = Number(options.recentLimit) > 0 ? Number(options.recentLimit) : DEFAULT_RECENT_LIMIT;
    const sinceIso = buildSinceIso(sinceMinutes);

    const [
        started,
        succeeded,
        missingCookie,
        invalidOrExpired,
        unauthorized,
        concurrent,
        serviceError,
        otherFailure,
        recentEvents
    ] = await Promise.all([
        countByFilter({ sinceIso, eventType: 'attempt' }),
        countByFilter({ sinceIso, eventType: 'success' }),
        countByFilter({ sinceIso, eventType: 'missing_cookie' }),
        countByFilter({ sinceIso, eventType: 'failure', reason: 'invalid_or_expired_token' }),
        countByFilter({ sinceIso, eventType: 'failure', reason: 'unauthorized' }),
        countByFilter({ sinceIso, eventType: 'failure', reason: 'concurrent_refresh' }),
        countByFilter({ sinceIso, eventType: 'failure', reason: 'service_error' }),
        countByFilter({ sinceIso, eventType: 'failure', reason: 'unknown' }),
        getRecentEvents({ sinceIso, recentLimit })
    ]);

    const totalFailures =
        missingCookie +
        invalidOrExpired +
        unauthorized +
        concurrent +
        serviceError +
        otherFailure;

    return {
        since: sinceIso,
        windowMinutes: sinceMinutes,
        counters: {
            started,
            succeeded,
            missingCookie,
            invalidOrExpired,
            unauthorized,
            concurrent,
            serviceError,
            otherFailure,
            totalFailures
        },
        recentEvents
    };
}

module.exports = {
    recordAttempt,
    recordSuccess,
    recordMissingCookie,
    recordFailure,
    getSnapshot
};
