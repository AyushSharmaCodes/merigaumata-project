const pino = require('pino');
const { stdSerializers } = pino;
const path = require('path');
const fs = require('fs');
const { getContext } = require('./async-context');
const newrelicPinoEnricher = require('@newrelic/pino-enricher');
const { i18next } = require('../middleware/i18n.middleware');


const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_PROVIDER = process.env.LOG_PROVIDER || 'file'; // 'file', 'stdout', or 'newrelic'
const LOG_DIRECTORY = process.env.LOG_DIRECTORY || path.join(__dirname, '..', 'logs');

// Create logs directory only when local file logging is enabled
if (LOG_PROVIDER === 'file' && !fs.existsSync(LOG_DIRECTORY)) {
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
        correlationId: headers['x-correlation-id'] || headers['X-Correlation-ID'],
        traceId: headers['x-trace-id'] || headers['X-Trace-ID'],
        spanId: headers['x-span-id'] || headers['X-Span-ID']
    };
};

const resSerializer = (res) => {
    if (!res) return res;
    return {
        statusCode: res.statusCode,
    };
};

// Constraint: Strict Size Limit (64KB for individual log lines)
const MAX_LOG_SIZE_BYTES = 64 * 1024;

/**
 * Defensive truncation function.
 */
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

// Mixin to add context (Tracing IDs) to every log
const mixin = () => {
    const context = getContext();
    if (!context) return {};
    return {
        correlationId: context.correlationId,
        traceId: context.traceId,
        spanId: context.spanId,
        userId: context.userId
    };
};

// Unified Log Structure Configuration
const baseLog = {
    service: process.env.APP_NAME || 'ecommerce-backend',
    env: process.env.NODE_ENV || 'development',
};

/**
 * Restructure arguments to match the required schema
 */
const restructureLog = (inputArgs) => {
    let [arg1, arg2, ...rest] = inputArgs;
    let logObj = {};
    let msg = arg2;

    if (typeof arg1 === 'string') {
        msg = arg1;
        // If arg2 is the context object, use it
        if (typeof arg2 === 'object' && arg2 !== null) {
            logObj = { ...arg2 };
        } else {
            arg1 = {};
        }
    } else if (typeof arg1 === 'object' && arg1 !== null) {
        logObj = { ...arg1 };
        if (!msg && (logObj.msg || logObj.message)) {
            msg = logObj.msg || logObj.message;
            delete logObj.msg;
            delete logObj.message;
        }
    }

    // Resolve i18n key for development readability
    if (msg && typeof msg === 'string' && !msg.includes(' ') && (msg.startsWith('errors.') || msg.startsWith('success.') || msg.includes('.'))) {
        logObj.i18nKey = msg;
        if (process.env.NODE_ENV !== 'production' && i18next.isInitialized) {
            msg = `[i18n] ${i18next.t(msg, logObj.context || logObj)}`;
        }
    }


    const { module, operation, err, error, req, res, ...otherContext } = logObj;

    const sanitizedContext = { ...otherContext };
    if (req) sanitizedContext.req = reqSerializer(req);
    if (res) sanitizedContext.res = resSerializer(res);

    const finalObj = {
        module: module || 'UnknownModule',
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

let logger;

const pinoOptions = {
    level: LOG_LEVEL,
    base: baseLog,
    mixin,
    hooks: {
        logMethod(inputArgs, method, level) {
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
};

if (LOG_PROVIDER === 'newrelic') {
    const nrEnricher = newrelicPinoEnricher();
    logger = pino({
        ...pinoOptions,
        ...nrEnricher,
        formatters: {
            ...pinoOptions.formatters,
            ...nrEnricher.formatters
        }
    });
} else if (LOG_PROVIDER === 'stdout') {
    // Hosted environments usually aggregate stdout/stderr automatically.
    logger = pino(pinoOptions);
} else {
    // Default File Logger with Daily Rotation
    const streams = [
        {
            level: LOG_LEVEL,
            stream: pino.transport({
                target: 'pino-roll',
                options: {
                    file: path.join(LOG_DIRECTORY, 'merigaumata'),
                    dateFormat: 'dd-MM-yyyy',
                    extension: '.log',
                    frequency: 'daily',
                    mkdir: true,
                    sync: false
                }
            })
        }
    ];

    // Add pretty console in development
    if (process.env.NODE_ENV !== 'production') {
        streams.push({
            level: LOG_LEVEL,
            stream: pino.transport({
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname,service,env,module,operation'
                }
            })
        });
    }

    logger = pino(pinoOptions, pino.multistream(streams));
}

// Map standard logging methods for ease of use and potential expansion
module.exports = {
    debug: (msg, meta) => logger.debug(meta, msg),
    info: (msg, meta) => logger.info(meta, msg),
    warn: (msg, meta) => logger.warn(meta, msg),
    error: (msg, meta) => logger.error(meta, msg),
    fatal: (msg, meta) => logger.fatal(meta, msg),
    pino: logger // Export raw pino instance if needed
};
