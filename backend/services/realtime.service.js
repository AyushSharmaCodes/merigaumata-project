const logger = require('../utils/logger');

const DEFAULT_RETRY_MS = 5000;
const HEARTBEAT_MS = 25000;

const TOPIC_ACCESS = {
    store_settings: 'public',
    dashboard: 'staff',
    admin_alerts: 'admin',
    deletion_jobs: 'admin'
};

class RealtimeService {
    constructor() {
        this.clients = new Map();
        this.heartbeat = setInterval(() => this.broadcastHeartbeat(), HEARTBEAT_MS);

        if (typeof this.heartbeat.unref === 'function') {
            this.heartbeat.unref();
        }
    }

    parseTopics(rawTopics) {
        const requestedTopics = String(rawTopics || '')
            .split(',')
            .map((topic) => topic.trim())
            .filter(Boolean);

        return [...new Set(requestedTopics)];
    }

    validateTopics(topics, user) {
        if (!topics.length) {
            return { ok: true, topics: ['store_settings'] };
        }

        for (const topic of topics) {
            const access = TOPIC_ACCESS[topic];

            if (!access) {
                return { ok: false, status: 400, error: `Unknown realtime topic: ${topic}` };
            }

            if (access === 'public') {
                continue;
            }

            if (!user) {
                return { ok: false, status: 401, error: 'Authentication required for realtime topic access' };
            }

            const role = String(user.role || '').toLowerCase();

            if (access === 'staff' && !['admin', 'manager'].includes(role)) {
                return { ok: false, status: 403, error: 'Insufficient permissions for realtime topic access' };
            }

            if (access === 'admin' && role !== 'admin') {
                return { ok: false, status: 403, error: 'Admin access required for realtime topic access' };
            }
        }

        return { ok: true, topics };
    }

    registerClient(req, res, topics) {
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const client = {
            id: clientId,
            req,
            res,
            topics: new Set(topics),
            userId: req.user?.id || null,
            role: req.user?.role || 'guest'
        };

        this.clients.set(clientId, client);

        req.on('close', () => {
            this.unregisterClient(clientId);
        });

        logger.info({ clientId, topics, userId: client.userId, role: client.role }, '[Realtime] Client connected');
        this.sendEvent(client, 'connected', {
            clientId,
            topics,
            retryMs: DEFAULT_RETRY_MS,
            connectedAt: new Date().toISOString()
        });

        return clientId;
    }

    unregisterClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client) {
            return;
        }

        this.clients.delete(clientId);
        logger.info({ clientId, userId: client.userId }, '[Realtime] Client disconnected');
    }

    sendEvent(client, event, payload) {
        try {
            client.res.write(`event: ${event}\n`);
            client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (error) {
            logger.warn({ err: error, clientId: client.id }, '[Realtime] Failed to write SSE event');
            this.unregisterClient(client.id);
        }
    }

    broadcastHeartbeat() {
        const payload = { ts: new Date().toISOString() };

        for (const client of this.clients.values()) {
            this.sendEvent(client, 'heartbeat', payload);
        }
    }

    publish({ topic, type, payload = {}, audience = null }) {
        if (!topic || !type) {
            return;
        }

        const message = {
            topic,
            type,
            payload,
            sentAt: new Date().toISOString()
        };

        for (const client of this.clients.values()) {
            if (!client.topics.has(topic)) {
                continue;
            }

            const role = String(client.role || '').toLowerCase();

            if (audience === 'authenticated' && !client.userId) {
                continue;
            }

            if (audience === 'staff' && !['admin', 'manager'].includes(role)) {
                continue;
            }

            if (audience === 'admin' && role !== 'admin') {
                continue;
            }

            this.sendEvent(client, 'realtime-event', message);
        }
    }

    shutdown(reason = 'SERVER_SHUTDOWN') {
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
        }

        for (const client of this.clients.values()) {
            try {
                this.sendEvent(client, 'server-shutdown', {
                    reason,
                    ts: new Date().toISOString()
                });
                client.res.end();
            } catch (error) {
                logger.warn({ err: error, clientId: client.id }, '[Realtime] Failed to close SSE client during shutdown');
                if (client.req?.socket && typeof client.req.socket.destroy === 'function') {
                    client.req.socket.destroy();
                }
            } finally {
                this.unregisterClient(client.id);
            }
        }
    }
}

module.exports = new RealtimeService();
