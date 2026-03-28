const { getContactFormEmail } = require('../services/email/templates/contact.template');

jest.mock('../services/contact.service', () => ({
    createMessage: jest.fn()
}));

jest.mock('../services/email', () => ({
    sendContactNotification: jest.fn(),
    sendContactAutoReply: jest.fn()
}));

jest.mock('../services/admin-alert.service', () => ({
    createAlert: jest.fn(() => Promise.resolve())
}));

const contactService = require('../services/contact.service');
const emailService = require('../services/email');
const contactController = require('../controllers/contact.controller');
const { EmailEventTypes } = require('../services/email/types');

describe('contact flow production readiness', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('controller preserves subject as structured data and triggers both email flows', async () => {
        contactService.createMessage.mockResolvedValue({
            id: 'msg-1',
            name: 'Ayush',
            email: 'ayush@example.com',
            subject: 'Need donation receipt',
            message: 'Please share my receipt as soon as possible.'
        });
        emailService.sendContactNotification.mockResolvedValue({ success: true });
        emailService.sendContactAutoReply.mockResolvedValue({ success: true });

        const req = {
            body: {
                name: 'Ayush',
                email: 'ayush@example.com',
                subject: 'Need donation receipt',
                message: 'Please share my receipt as soon as possible.'
            },
            ip: '127.0.0.1',
            connection: { remoteAddress: '127.0.0.1' },
            get: jest.fn((header) => {
                if (header === 'User-Agent') return 'jest';
                if (header === 'x-user-lang') return 'en';
                return undefined;
            })
        };
        const res = {
            status: jest.fn(() => res),
            json: jest.fn()
        };
        const next = jest.fn();

        await contactController.submitContactForm(req, res, next);

        expect(contactService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
            subject: 'Need donation receipt'
        }));
        expect(emailService.sendContactNotification).toHaveBeenCalledWith(expect.objectContaining({
            subject: 'Need donation receipt'
        }));
        expect(emailService.sendContactAutoReply).toHaveBeenCalledWith('ayush@example.com', 'Ayush', 'en');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    test('contact auto-reply uses its dedicated email event type', async () => {
        jest.resetModules();

        const emailModule = jest.requireActual('../services/email');
        const sendSpy = jest.spyOn(emailModule, 'send').mockResolvedValue({ success: true });

        await emailModule.sendContactAutoReply('user@example.com', 'User Name', 'en');

        expect(sendSpy).toHaveBeenCalledWith(
            EmailEventTypes.CONTACT_AUTO_REPLY,
            'user@example.com',
            { name: 'User' },
            { lang: 'en' }
        );

        sendSpy.mockRestore();
    });

    test('contact email template escapes user-controlled HTML content', () => {
        const { html } = getContactFormEmail({
            name: '<b>Bad</b>',
            email: 'attacker@example.com',
            subject: '<script>alert(1)</script>',
            message: '<img src=x onerror=alert(1)>',
            lang: 'en',
            t: (key) => key
        });

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toContain('<script>alert(1)</script>');
    });
});
