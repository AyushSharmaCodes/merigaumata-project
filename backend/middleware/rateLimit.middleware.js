const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const SystemMessages = require('../constants/messages/SystemMessages');
const LogMessages = require('../constants/messages/LogMessages');
const rateLimit = require('express-rate-limit');

function getRequestIdentity(req, scope = 'ip') {
    const userId = req.user?.id;
    const guestId = req.headers['x-guest-id'] || req.cookies?.guest_id;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;

    if (scope === 'user-or-ip') {
        return userId || ip;
    }

    if (scope === 'user-or-guest-or-ip') {
        return userId || guestId || ip;
    }

    if (scope === 'email-and-ip') {
        return email ? `${email}:${ip}` : ip;
    }

    return ip;
}

function createScopedLimiter({
    windowMs,
    max,
    scope = 'ip',
    messageFactory,
    skipSuccessfulRequests = false
}) {
    return rateLimit({
        windowMs,
        max,
        message: (req) => messageFactory(req),
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        keyGenerator: (req) => getRequestIdentity(req, scope),
        validate: {
            keyGeneratorIpFallback: false
        }
    });
}

/**
 * Middleware to check comment rate limits using database function
 * Enforces 5 comments per 5 minutes per user per blog
 */
const checkCommentRateLimit = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { blogId } = req.body;

        // Skip rate limit for admins/managers
        if (req.user?.role === 'admin' || req.user?.role === 'manager') {
            return next();
        }

        if (!userId || !blogId) {
            // If missing data, let validation middleware handle it or proceed
            return next();
        }

        // Call database function to check limit
        const { data, error } = await supabase
            .rpc('check_comment_rate_limit', {
                p_user_id: userId,
                p_blog_id: blogId,
                p_max_comments: 5
            });

        if (error) {
            logger.error({ msg: LogMessages.DB_QUERY_FAILED, error }, 'Rate limit check error:');
            // Fail open (allow comment) if DB check fails, but log it
            return next();
        }

        // data is an array of objects from RPC
        const result = data[0];

        if (result && !result.is_allowed) {
            const resetTime = new Date(result.window_resets_at);
            const minutesLeft = Math.ceil((resetTime - new Date()) / 60000);

            return res.status(429).json({
                error: SystemMessages.RATE_LIMIT_ERROR,
                message: req.t('errors.rateLimit.commentPosting', { minutes: minutesLeft }),
                retryAfter: result.window_resets_at
            });
        }

        // Attach rate limit info to request for use in controller
        req.rateLimitInfo = result;
        next();

    } catch (err) {
        logger.error({ msg: LogMessages.RATE_LIMIT_ERROR, err }, 'Rate limit middleware error:');
        next();
    }
};

/**
 * Throttling for phone validation to prevent API abuse
 * Limits to 5 requests per 10 minutes per IP
 */
const phoneValidationRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Limit each IP to 5 requests per `window`
    message: (req) => ({
        error: 'Too many validation requests',
        message: req.t('errors.rateLimit.phoneValidation')
    }),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fallback to IP
        return req.user?.id || req.ip;
    },
    validate: {
        keyGeneratorIpFallback: false
    }
});

const authRateLimit = createScopedLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    scope: 'email-and-ip',
    messageFactory: (req) => ({
        error: 'Too many authentication requests',
        message: req.t('errors.system.rateLimitError')
    })
});

const authSessionRateLimit = createScopedLimiter({
    windowMs: 10 * 60 * 1000,
    max: 60,
    scope: 'user-or-ip',
    messageFactory: (req) => ({
        error: 'Too many session requests',
        message: req.t('errors.system.rateLimitError')
    })
});

const checkoutReadRateLimit = createScopedLimiter({
    windowMs: 5 * 60 * 1000,
    max: 120,
    scope: 'user-or-guest-or-ip',
    messageFactory: (req) => ({
        error: 'Too many checkout requests',
        message: req.t('errors.system.rateLimitError')
    })
});

const checkoutWriteRateLimit = createScopedLimiter({
    windowMs: 5 * 60 * 1000,
    max: 20,
    scope: 'user-or-guest-or-ip',
    messageFactory: (req) => ({
        error: 'Too many checkout write requests',
        message: req.t('errors.system.rateLimitError')
    })
});

const uploadWriteRateLimit = createScopedLimiter({
    windowMs: 10 * 60 * 1000,
    max: 20,
    scope: 'user-or-ip',
    messageFactory: (req) => ({
        error: 'Too many upload requests',
        message: req.t('errors.system.rateLimitError')
    })
});

const clientErrorLogRateLimit = createScopedLimiter({
    windowMs: 5 * 60 * 1000,
    max: 30,
    scope: 'ip',
    messageFactory: () => ({
        error: 'Too many client error log requests',
        message: SystemMessages.RATE_LIMIT_ERROR
    })
});

const translationRateLimit = createScopedLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30, // 30 translations per 10 mins
    scope: 'user-or-guest-or-ip',
    messageFactory: (req) => ({
        error: 'Too many translation requests',
        message: req.t('errors.system.rateLimitError')
    })
});

module.exports = {
    checkCommentRateLimit,
    phoneValidationRateLimit,
    authRateLimit,
    authSessionRateLimit,
    checkoutReadRateLimit,
    checkoutWriteRateLimit,
    uploadWriteRateLimit,
    clientErrorLogRateLimit,
    translationRateLimit
};
