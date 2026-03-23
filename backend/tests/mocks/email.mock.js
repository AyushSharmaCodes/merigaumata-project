/**
 * Email Service Mock
 * Tracks sent emails without actually sending them
 */

const sentEmails = [];

const mockEmailService = {
    // Track all sent emails
    sentEmails,

    // Clear tracked emails (call between tests)
    clearSentEmails: () => {
        sentEmails.length = 0;
    },

    // Mock send method
    send: jest.fn(async (eventType, to, data, options = {}) => {
        const email = {
            eventType,
            to,
            data,
            options,
            sentAt: new Date().toISOString()
        };
        sentEmails.push(email);
        return { success: true, messageId: `mock-${Date.now()}` };
    }),

    // Mock specific email methods
    sendEmailConfirmation: jest.fn(async (to, data, userId) => {
        sentEmails.push({
            type: 'EMAIL_CONFIRMATION',
            to,
            data,
            userId,
            sentAt: new Date().toISOString()
        });
        return { success: true };
    }),

    sendOTPEmail: jest.fn(async (to, otp, expiryMinutes) => {
        sentEmails.push({
            type: 'OTP',
            to,
            otp,
            expiryMinutes,
            sentAt: new Date().toISOString()
        });
        return { success: true };
    }),

    // Helper to find emails for assertions
    getEmailsSentTo: (email) => sentEmails.filter(e => e.to === email),
    getEmailsByType: (type) => sentEmails.filter(e => e.type === type || e.eventType === type)
};

module.exports = mockEmailService;
