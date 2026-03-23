/**
 * Spam detection utility for comments
 * Checks for common spam patterns like excessive links, caps, repetition, etc.
 */

const SPAM_PATTERNS = [
    /\b(buy|cheap|discount|offer|free|click|here|visit|website)\b/i,
    /\b(viagra|cialis|casino|poker|sex|porn|xxx)\b/i,
    /\b(crypto|bitcoin|investment|forex)\b/i
];

const MAX_URLS = 2;
const MAX_CAPS_RATIO = 0.7; // 70% caps allowed max
const MAX_REPEATED_CHARS = 5; // Max 5 repeated chars (e.g. "looooool")

/**
 * Check if content contains spam
 * @param {string} content - The comment content
 * @returns {object} - { isSpam: boolean, reason: string }
 */
const detectSpam = (content) => {
    if (!content) return { isSpam: false };

    // 1. Check for URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    if (urls && urls.length > MAX_URLS) {
        return { isSpam: true, reason: 'Too many links' };
    }

    // 2. Check for excessive caps (only for longer comments)
    if (content.length > 20) {
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const capsRatio = capsCount / content.length;
        if (capsRatio > MAX_CAPS_RATIO) {
            return { isSpam: true, reason: 'Excessive capitalization' };
        }
    }

    // 3. Check for repeated characters
    const repeatedCharsRegex = new RegExp(`(.)\\1{${MAX_REPEATED_CHARS},}`);
    if (repeatedCharsRegex.test(content)) {
        return { isSpam: true, reason: 'Excessive character repetition' };
    }

    // 4. Check for known spam phrases (basic check)
    // Count how many spam keywords match
    let spamKeywordCount = 0;
    SPAM_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
            spamKeywordCount++;
        }
    });

    if (spamKeywordCount >= 2) {
        return { isSpam: true, reason: 'Contains spam keywords' };
    }

    return { isSpam: false };
};

module.exports = {
    detectSpam
};
