/**
 * Content validation utility
 * Validates comment length, structure, and other constraints
 */

const MIN_LENGTH = 2;
const MAX_LENGTH = 2000;

/**
 * Validate comment content
 * @param {string} content - The comment content
 * @returns {object} - { isValid: boolean, error: string }
 */
const validateContent = (content) => {
    if (!content || typeof content !== 'string') {
        return { isValid: false, error: 'Content is required' };
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length < MIN_LENGTH) {
        return { isValid: false, error: `Comment must be at least ${MIN_LENGTH} characters long` };
    }

    if (trimmedContent.length > MAX_LENGTH) {
        return { isValid: false, error: `Comment cannot exceed ${MAX_LENGTH} characters` };
    }

    return { isValid: true };
};

module.exports = {
    validateContent,
    MIN_LENGTH,
    MAX_LENGTH
};
