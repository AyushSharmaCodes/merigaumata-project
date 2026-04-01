const SystemMessages = require('../constants/messages/SystemMessages');

function getUserId(req) {
    return req?.user?.id || req?.headers?.['x-user-id'] || req?.headers?.['X-User-ID'] || null;
}

function getIdempotencyKey(req) {
    return req?.headers?.['x-idempotency-key'] || req?.headers?.['X-Idempotency-Key'] || null;
}

function buildErrorContext(req) {
    return {
        userId: getUserId(req),
        idempotencyKey: getIdempotencyKey(req),
        correlationId: req?.correlationId || req?.headers?.['x-correlation-id'] || req?.headers?.['X-Correlation-ID'] || null,
        traceId: req?.traceId || req?.headers?.['x-trace-id'] || req?.headers?.['X-Trace-ID'] || null,
        spanId: req?.spanId || req?.headers?.['x-span-id'] || req?.headers?.['X-Span-ID'] || null,
        parentSpanId: req?.parentSpanId || req?.traceContext?.parentSpanId || null,
        requestId: req?.traceId || req?.headers?.['x-trace-id'] || req?.headers?.['X-Trace-ID'] || null
    };
}

function toErrorObject(body) {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        return { ...body };
    }

    if (body === undefined || body === null) {
        return {};
    }

    return { error: String(body) };
}

function getErrorMessage(body, fallbackMessage) {
    if (typeof body.message === 'string' && body.message.trim()) {
        return body.message;
    }

    if (typeof body.error === 'string' && body.error.trim()) {
        return body.error;
    }

    return fallbackMessage;
}

function getErrorCode(body, statusCode) {
    if (typeof body.code === 'string' && body.code.trim()) {
        return body.code;
    }

    if (typeof body.errorCode === 'string' && body.errorCode.trim()) {
        return body.errorCode;
    }

    return statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
}

function formatErrorResponse({
    req,
    statusCode,
    body,
    fallbackMessage = SystemMessages.INTERNAL_ERROR,
    exposeDebug = false,
    debug = undefined
}) {
    const normalizedBody = toErrorObject(body);
    const message = getErrorMessage(normalizedBody, fallbackMessage);

    const response = {
        success: false,
        ...normalizedBody,
        code: getErrorCode(normalizedBody, statusCode),
        error: message,
        message,
        ...buildErrorContext(req),
        timestamp: new Date().toISOString()
    };

    if (exposeDebug && debug) {
        response.debug = debug;
    }

    return response;
}

module.exports = {
    buildErrorContext,
    formatErrorResponse
};
