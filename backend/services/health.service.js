const supabase = require('../lib/supabase');
const { getSchedulerStatus } = require('../lib/scheduler');

async function checkDatabase() {
    const startedAt = Date.now();

    try {
        const { error } = await supabase
            .from('store_settings')
            .select('id', { head: true, count: 'exact' })
            .limit(1);

        if (error) {
            return {
                ok: false,
                latencyMs: Date.now() - startedAt,
                error: error.message
            };
        }

        return {
            ok: true,
            latencyMs: Date.now() - startedAt
        };
    } catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - startedAt,
            error: error.message
        };
    }
}

async function getHealthSnapshot(options = {}) {
    const { includeDetails = false } = options;
    const db = await checkDatabase();
    const scheduler = getSchedulerStatus();
    const schedulerEnabled = process.env.ENABLE_INTERNAL_SCHEDULER !== 'false';

    const checks = {
        database: includeDetails
            ? db
            : { ok: db.ok, latencyMs: db.latencyMs },
        scheduler: {
            ok: !schedulerEnabled || scheduler.running,
            enabled: schedulerEnabled,
            running: scheduler.running,
            jobs: scheduler.jobs.length
        }
    };

    const snapshot = {
        status: db.ok ? 'ok' : 'degraded',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        checks
    };

    if (includeDetails) {
        snapshot.environment = process.env.NODE_ENV || 'development';
        snapshot.instance = {
            pid: process.pid,
            nodeVersion: process.version
        };
    }

    return snapshot;
}

async function getReadinessSnapshot(options = {}) {
    const snapshot = await getHealthSnapshot(options);
    return {
        ready: snapshot.checks.database.ok,
        status: snapshot.checks.database.ok ? 'ready' : 'not_ready',
        timestamp: snapshot.timestamp,
        checks: snapshot.checks
    };
}

module.exports = {
    getHealthSnapshot,
    getReadinessSnapshot
};
