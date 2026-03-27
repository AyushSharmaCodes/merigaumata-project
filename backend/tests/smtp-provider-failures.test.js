const mockVerify = jest.fn();
const mockSendMail = jest.fn();
const mockClose = jest.fn();

jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        verify: mockVerify,
        sendMail: mockSendMail,
        close: mockClose
    }))
}));

jest.mock('../config/email.config', () => ({
    smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'user@example.com' },
        from: { name: 'Test Sender', email: 'sender@example.com' },
        getTransportOptions: jest.fn(() => ({
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: { user: 'user@example.com', pass: 'secret' }
        })),
        isConfigured: jest.fn(() => true)
    }
}));

describe('SmtpProvider failure handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns a structured timeout failure when SMTP send times out', async () => {
        const timeoutError = new Error('Connection timed out');
        timeoutError.code = 'ETIMEDOUT';
        mockSendMail.mockRejectedValueOnce(timeoutError);

        const SmtpProvider = require('../services/email/providers/smtp.provider');
        const provider = new SmtpProvider();

        const result = await provider.send({
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Hello</p>'
        });

        expect(result).toEqual(expect.objectContaining({
            success: false,
            code: 'ETIMEDOUT',
            error: 'SMTP connection timed out.'
        }));
    });

    test('returns false when SMTP verifyConnection fails', async () => {
        mockVerify.mockRejectedValueOnce(new Error('verify failed'));

        const SmtpProvider = require('../services/email/providers/smtp.provider');
        const provider = new SmtpProvider();

        await expect(provider.verifyConnection()).resolves.toBe(false);
    });
});
