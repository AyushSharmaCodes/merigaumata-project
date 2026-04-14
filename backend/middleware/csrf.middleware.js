const logger = require('../utils/logger');
const systemSwitches = require('../services/system-switches.service');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOrigin(origin) {
    if (!origin) {
        return null;
    }

    try {
        return new URL(origin).origin;
    } catch {
        return null;
    }
}

function getAllowedOrigins() {
    const rawOrigins = systemSwitches.getSwitchSync('ALLOWED_ORIGINS', process.env.ALLOWED_ORIGINS || '');
    const configured = rawOrigins
        .split(',')
        .map((value) => normalizeOrigin(value.trim()))
        .filter(Boolean);

    const frontendOrigin = normalizeOrigin(process.env.FRONTEND_URL);

    if (frontendOrigin && !configured.includes(frontendOrigin)) {
        configured.push(frontendOrigin);
    }

    return configured;
}

function shouldEnforceCsrf(req) {
    if (SAFE_METHODS.has(req.method)) {
        return false;
    }

    return Boolean(req.cookies?.access_token || req.cookies?.refresh_token);
}

function protectCookieAuthMutations(req, res, next) {
    if (!shouldEnforceCsrf(req)) {
        return next();
    }

    const allowedOrigins = getAllowedOrigins();
    const requestOrigin = normalizeOrigin(req.get('origin'));
    const refererOrigin = normalizeOrigin(req.get('referer'));
    const sourceOrigin = requestOrigin || refererOrigin;

    if (allowedOrigins.length === 0) {
        logger.error({
            method: req.method,
            path: req.originalUrl
        }, 'CSRF protection could not evaluate request because no allowed origins are configured');

        return res.status(503).json({
            error: req.t ? req.t('errors.system.configError') : 'Server configuration error'
        });
    }

    if (!sourceOrigin || !allowedOrigins.includes(sourceOrigin)) {
        logger.warn({
            method: req.method,
            path: req.originalUrl,
            requestOrigin,
            refererOrigin,
            allowedOrigins
        }, 'Blocked cookie-authenticated cross-site mutation');

        return res.status(403).json({
            error: req.t ? req.t('errors.auth.forbidden') : 'Forbidden',
            code: 'CSRF_ORIGIN_MISMATCH'
        });
    }

    next();
}

module.exports = {
    protectCookieAuthMutations,
    normalizeOrigin,
    getAllowedOrigins
};
