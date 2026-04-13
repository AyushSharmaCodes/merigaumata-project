let DOMPurify = null;

function getDOMPurify() {
    if (!DOMPurify) {
        DOMPurify = require('isomorphic-dompurify');
    }

    return DOMPurify;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows a safe subset of HTML tags and attributes
 * @param {string} content - The raw HTML content
 * @returns {string} - The sanitized HTML content
 */
const sanitizeContent = (content) => {
    if (!content) return '';

    return getDOMPurify().sanitize(content, {
        ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
            'code', 'pre', 'blockquote', 'u', 's', 'strike'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
        FORBID_ATTR: ['style', 'class', 'id', 'onclick', 'onerror', 'onload'],
    });
};

/**
 * Strip all HTML tags to get plain text
 * Useful for generating previews or checking content length
 * @param {string} content - The HTML content
 * @returns {string} - Plain text content
 */
const stripHtml = (content) => {
    if (!content) return '';
    return content.replace(/<[^>]*>?/gm, '');
};

module.exports = {
    sanitizeContent,
    stripHtml
};
