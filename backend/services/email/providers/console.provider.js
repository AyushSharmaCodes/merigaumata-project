/**
 * Console Email Provider
 * Development fallback that logs emails to console instead of sending
 * 
 * NOTE: Uses plain console.log intentionally to avoid flooding New Relic
 * with development email content. Production uses MailerSend provider.
 */
const BaseEmailProvider = require('./base.provider');

class ConsoleProvider extends BaseEmailProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'console';
    }

    async send({ to, subject, html, text }) {
        // Use plain console.log to avoid sending dev email content to New Relic
        console.log('\n' + '='.repeat(60));
        console.log('[DEV EMAIL] Email would be sent:');
        console.log('='.repeat(60));
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('-'.repeat(60));
        console.log('HTML Preview (first 500 chars):');
        console.log(html.substring(0, 500) + (html.length > 500 ? '...' : ''));
        console.log('='.repeat(60) + '\n');

        return {
            success: true,
            messageId: `console-${Date.now()}`,
            provider: 'console'
        };
    }

    isConfigured() {
        return true; // Always available
    }
}

module.exports = ConsoleProvider;

