/**
 * Base Email Provider Interface
 * All email providers must implement this interface
 */
class BaseEmailProvider {
    constructor(config = {}) {
        this.config = config;
        this.name = 'base';
    }

    /**
     * Send an email
     * @param {Object} options
     * @param {string} options.to - Recipient email
     * @param {string} options.subject - Email subject
     * @param {string} options.html - HTML content
     * @param {string} options.text - Plain text content (optional)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async send({ to, subject, html, text }) {
        throw new Error('send() method must be implemented by provider');
    }

    /**
     * Check if provider is configured and ready
     * @returns {boolean}
     */
    isConfigured() {
        return false;
    }
}

module.exports = BaseEmailProvider;
