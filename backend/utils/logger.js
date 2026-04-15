const pino = require('pino');
const { stdSerializers } = pino;
const path = require('path');
const fs = require('fs');
const { getContext } = require('./async-context');
const newrelicPinoEnricher = require('@newrelic/pino-enricher');
const { i18next } = require('../middleware/i18n.middleware');

// We use dynamic require for systemSwitches to avoid circular dependency at initialization
let systemSwitches = null;
function getSwitches() {
    if (!systemSwitches) {
        try {
            systemSwitches = require('../services/system-switches.service');
            // If we are in a circular requirement, systemSwitches might be an empty object {}
            if (!systemSwitches || typeof systemSwitches.getSwitchSync !== 'function') {
                return { getSwitchSync: (key, def) => process.env[key] !== undefined ? process.env[key] : def };
            }
        } catch (e) {
            // Fallback if not yet available or in a context where it fails
            return { getSwitchSync: (key, def) => process.env[key] !== undefined ? process.env[key] : def };
        }
    }
    return systemSwitches;
}

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIRECTORY = process.env.LOG_DIRECTORY || path.join(__dirname, '..', 'logs');

// Create logs directory unconditionally for safety, or we could do it on demand
if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
}

/**
 * Custom Serializers for strict sanitization
 */
const reqSerializer = (req) => {
    if (!req) return req;
    const headers = req.headers || {};
    return {
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.remoteAddress,
        userAgent: headers['user-agent'],
        userId: (req.user && req.user.id) || headers['x-user-id'] || headers['X-User-ID'],
        correlationId: req.correlationId || headers['x-correlation-id'] || headers['X-Correlation-ID'],
        traceId: req.traceId || headers['x-trace-id'] || headers['X-Trace-ID'],
        spanId: req.spanId || headers['x-span-id'] || headers['X-Span-ID'],
        parentSpanId: req.parentSpanId || req.traceContext?.parentSpanId || null
    };
};

const resSerializer = (res) => {
    if (!res) return res;
    return {
        statusCode: res.statusCode,
    };
};

const MAX_LOG_SIZE_BYTES = 64 * 1024;

const safePayload = (obj) => {
    try {
        const str = JSON.stringify(obj);
        if (str && str.length > MAX_LOG_SIZE_BYTES) {
            return `[TRUNCATED - Payload size ${str.length} bytes exceeds limit of ${MAX_LOG_SIZE_BYTES} bytes]`;
        }
        return obj;
    } catch (e) {
        return obj;
    }
};

const mixin = () => {
    const context = getContext();
    if (!context) return {};
    return {
        correlationId: context.correlationId,
        traceId: context.traceId,
        spanId: context.spanId,
        parentSpanId: context.parentSpanId || null,
        userId: context.userId
    };
};

const getBaseLog = () => ({
    service: process.env.APP_NAME || 'ecommerce-backend',
    env: process.env.NODE_ENV || 'development',
});

const restructureLog = (inputArgs) => {
    let [arg1, arg2, ...rest] = inputArgs;
    let logObj = {};
    let msg = arg2;

    if (typeof arg1 === 'string') {
        msg = arg1;
        if (typeof arg2 === 'object' && arg2 !== null) {
            logObj = { ...arg2 };
        }
    } else if (typeof arg1 === 'object' && arg1 !== null) {
        logObj = { ...arg1 };
        if (!msg && (logObj.msg || logObj.message)) {
            msg = logObj.msg || logObj.message;
            delete logObj.msg;
            delete logObj.message;
        }
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    if (msg && typeof msg === 'string' && !msg.includes(' ') && (msg.startsWith('errors.') || msg.startsWith('success.') || msg.includes('.'))) {
        logObj.i18nKey = msg;
        if (nodeEnv !== 'production' && i18next.isInitialized) {
            msg = `[i18n] ${i18next.t(msg, logObj.context || logObj)}`;
        }
    }

    const { module: mod, operation, err, error, req, res, ...otherContext } = logObj;
    const sanitizedContext = { ...otherContext };
    if (req) sanitizedContext.req = reqSerializer(req);
    if (res) sanitizedContext.res = resSerializer(res);

    const finalObj = {
        module: mod || 'UnknownModule',
        operation: operation || 'UnknownOperation',
        context: safePayload(sanitizedContext),
        timestamp: new Date().toISOString()
    };

    const startError = err || error;
    if (startError) {
        finalObj.error = stdSerializers.err(startError);
    }

    const outputArgs = [finalObj];
    if (msg) outputArgs.push(msg);
    return outputArgs;
};

const getCommonPinoOptions = () => ({
    level: LOG_LEVEL,
    base: getBaseLog(),
    mixin,
    hooks: {
        logMethod(inputArgs, method) {
            const newArgs = restructureLog(inputArgs);
            return method.apply(this, newArgs);
        }
    },
    redact: {
        paths: [
            'password', 'token', 'accessToken', 'refreshToken', 'cookie', 'authorization', 'secret',
            'email', 'phone', 'phoneNumber', 'mobile', 'creditCard', 'card',
            'gstin', 'pan',
            'context.password', 'context.token', 'context.accessToken', 'context.refreshToken',
            'context.cookie', 'context.authorization', 'context.secret',
            '*.password', '*.token', '*.accessToken', '*.refreshToken', '*.cookie', '*.authorization', '*.secret'
        ],
        remove: true
    },
    formatters: {
        level: (label) => ({ level: label.toUpperCase() })
    }
});

// Create different loggers for different providers
const fileTransport = pino.transport({
    target: 'pino-roll',
    options: {
        file: path.join(LOG_DIRECTORY, 'merigaumata'),
        dateFormat: 'dd-MM-yyyy',
        extension: '.log',
        frequency: 'daily',
        mkdir: true,
        sync: false
    }
});

const stdoutTransport = pino.transport({
    target: 'pino-pretty',
    options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,service,env,module,operation'
    }
});

const loggers = {
    file: pino(getCommonPinoOptions(), fileTransport),
    stdout: pino(getCommonPinoOptions(), stdoutTransport)
};

// Lazy-load New Relic logger only if actually used
let nrLogger = null;
function getNRLogger() {
    if (!nrLogger) {
        const nrEnricher = newrelicPinoEnricher();
        const options = getCommonPinoOptions();
        nrLogger = pino({
            ...options,
            ...nrEnricher,
            formatters: {
                ...options.formatters,
                ...nrEnricher.formatters
            }
        });
    }
    return nrLogger;
}

/**
 * Resolves the active logger based on the dynamic LOG_PROVIDER switch.
 */
function getActiveLogger() {
    const provider = getSwitches().getSwitchSync('LOG_PROVIDER', process.env.LOG_PROVIDER || 'file');
    if (provider === 'newrelic') return getNRLogger();
    return loggers[provider] || loggers.file;
}

const loggerExport = {
    debug: (msg, meta) => getActiveLogger().debug(meta, msg),
    info: (msg, meta) => getActiveLogger().info(meta, msg),
    warn: (msg, meta) => getActiveLogger().warn(meta, msg),
    error: (msg, meta) => getActiveLogger().error(meta, msg),
    fatal: (msg, meta) => getActiveLogger().fatal(meta, msg),
    flush: (callback) => getActiveLogger().flush(callback)
};

// Use a getter for .pino so it doesn't trigger circular dependency at load time
Object.defineProperty(loggerExport, 'pino', {
    get: () => getActiveLogger(),
    enumerable: true
});

module.exports = loggerExport;
