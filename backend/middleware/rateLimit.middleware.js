const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const SystemMessages = require('../constants/messages/SystemMessages');
const LogMessages = require('../constants/messages/LogMessages');
const rateLimit = require('express-rate-limit');

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
                message: `You are posting too fast. Please wait ${minutesLeft} minutes before posting again.`,
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
    message: {
        error: 'Too many validation requests',
        message: 'You are attempting to validate phone numbers too frequently. Please try again in 10 minutes.'
    },
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

module.exports = {
    checkCommentRateLimit,
    phoneValidationRateLimit
};
