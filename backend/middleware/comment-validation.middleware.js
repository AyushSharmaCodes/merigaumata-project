const { validateContent } = require('../utils/content-validator');
const { sanitizeContent } = require('../utils/sanitize');
const ValidationMessages = require('../constants/messages/ValidationMessages');

/**
 * Middleware to validate and sanitize comment input
 */
const validateCommentInput = (req, res, next) => {
    const { content, blogId } = req.body;

    // 1. Check required fields
    if (!blogId && req.method === 'POST') {
        return res.status(400).json({ error: ValidationMessages.BLOG_ID_REQUIRED });
    }

    // 2. Validate content
    const validation = validateContent(content);
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
    }

    // 3. Sanitize content (XSS protection)
    // Mutate req.body to pass sanitized content to controller
    req.body.content = sanitizeContent(content);

    next();
};

/**
 * Middleware to validate flag input
 */
const validateFlagInput = (req, res, next) => {
    const { reason } = req.body;

    const validReasons = [
        'spam', 'offensive', 'harassment', 'misinformation',
        'inappropriate', 'copyright', 'personal_info', 'other'
    ];

    if (!reason || !validReasons.includes(reason)) {
        return res.status(400).json({
            error: 'Invalid flag reason',
            validReasons
        });
    }

    next();
};

module.exports = {
    validateCommentInput,
    validateFlagInput
};
