require('dotenv').config();
const emailService = require('../services/email/index');
const { EmailEventTypes } = require('../services/email/types');

async function testEmail() {
    console.log('--- Starting Test Email ---');
    console.log('Provider Configured As:', emailService.provider.name);
    
    try {
        const result = await emailService.sendContactAutoReply('test@example.com', 'TestUser', 'en');
        console.log('Result:', result);
    } catch (err) {
        console.error('Error during send:', err);
    } finally {
        process.exit(0);
    }
}

testEmail();
