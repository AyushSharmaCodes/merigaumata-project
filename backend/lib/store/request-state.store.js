const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

async function deleteExpiredIdempotencyEntry(cacheKey) {
    const { error } = await supabase
        .from('idempotency_keys')
        .delete()
        .eq('cache_key', cacheKey)
        .lte('expires_at', new Date().toISOString());

    if (error) {
        logger.warn({ err: error, cacheKey }, 'Failed to delete expired idempotency entry');
    }
}

async function getIdempotencyEntry(cacheKey) {
    const { data, error } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('cache_key', cacheKey)
        .maybeSingle();

    if (error) {
        logger.warn({ err: error, cacheKey }, 'Failed to read idempotency entry');
        return null;
    }

    if (!data) {
        return null;
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
        await deleteExpiredIdempotencyEntry(cacheKey);
        return null;
    }

    return data;
}

async function createIdempotencyEntry({
    cacheKey,
    userId,
    idempotencyKey,
    correlationId,
    expiresAt
}) {
    const { data, error } = await supabase
        .from('idempotency_keys')
        .insert({
            cache_key: cacheKey,
            user_id: userId,
            idempotency_key: idempotencyKey,
            correlation_id: correlationId,
            in_progress: true,
            expires_at: new Date(expiresAt).toISOString()
        })
        .select('*')
        .single();

    if (error) {
        if (error.code === '23505') {
            return null;
        }

        throw error;
    }

    return data;
}

async function completeIdempotencyEntry(cacheKey, {
    response,
    statusCode,
    correlationId,
    expiresAt
}) {
    const { error } = await supabase
        .from('idempotency_keys')
        .update({
            response,
            status_code: statusCode,
            correlation_id: correlationId,
            in_progress: false,
            completed_at: new Date().toISOString(),
            expires_at: new Date(expiresAt).toISOString()
        })
        .eq('cache_key', cacheKey);

    if (error) {
        throw error;
    }
}

async function deleteIdempotencyEntry(cacheKey) {
    const { error } = await supabase
        .from('idempotency_keys')
        .delete()
        .eq('cache_key', cacheKey);

    if (error) {
        throw error;
    }
}

async function deleteExpiredRequestLock(lockKey) {
    const { error } = await supabase
        .from('request_locks')
        .delete()
        .eq('lock_key', lockKey)
        .lte('expires_at', new Date().toISOString());

    if (error) {
        logger.warn({ err: error, lockKey }, 'Failed to delete expired request lock');
    }
}

async function getRequestLock(lockKey) {
    const { data, error } = await supabase
        .from('request_locks')
        .select('*')
        .eq('lock_key', lockKey)
        .maybeSingle();

    if (error) {
        logger.warn({ err: error, lockKey }, 'Failed to read request lock');
        return null;
    }

    if (!data) {
        return null;
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
        await deleteExpiredRequestLock(lockKey);
        return null;
    }

    return data;
}

async function acquireRequestLock({
    lockKey,
    userId,
    operation,
    correlationId,
    expiresAt
}) {
    const { data, error } = await supabase
        .from('request_locks')
        .insert({
            lock_key: lockKey,
            user_id: userId,
            operation,
            correlation_id: correlationId,
            expires_at: new Date(expiresAt).toISOString()
        })
        .select('*')
        .single();

    if (error) {
        if (error.code === '23505') {
            return null;
        }

        throw error;
    }

    return data;
}

async function releaseRequestLock(lockKey, correlationId) {
    const query = supabase
        .from('request_locks')
        .delete()
        .eq('lock_key', lockKey);

    const { error } = correlationId
        ? await query.eq('correlation_id', correlationId)
        : await query;

    if (error) {
        throw error;
    }
}

module.exports = {
    getIdempotencyEntry,
    createIdempotencyEntry,
    completeIdempotencyEntry,
    deleteIdempotencyEntry,
    getRequestLock,
    acquireRequestLock,
    releaseRequestLock,
    deleteExpiredIdempotencyEntry,
    deleteExpiredRequestLock
};
