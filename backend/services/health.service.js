const supabase = require('../config/supabase');
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

async function getHealthSnapshot() {
    const db = await checkDatabase();
    const scheduler = getSchedulerStatus();
    const schedulerEnabled = process.env.ENABLE_INTERNAL_SCHEDULER !== 'false';

    return {
        status: db.ok ? 'ok' : 'degraded',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        instance: {
            pid: process.pid,
            nodeVersion: process.version
        },
        checks: {
            database: db,
            scheduler: {
                ok: !schedulerEnabled || scheduler.running,
                enabled: schedulerEnabled,
                running: scheduler.running,
                jobs: scheduler.jobs.length
            }
        }
    };
}

async function getReadinessSnapshot() {
    const snapshot = await getHealthSnapshot();
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
