const emailService = require('../services/email');
const { EmailEventTypes } = require('../services/email/types');

describe('Email service helper methods', () => {
    const originalSend = emailService.send;

    beforeEach(() => {
        emailService.send = jest.fn().mockResolvedValue({ success: true });
    });

    afterEach(() => {
        emailService.send = originalSend;
        jest.clearAllMocks();
    });

    it('preserves string userId options for donation receipt emails', async () => {
        await emailService.sendDonationReceiptEmail(
            'donor@example.com',
            {
                donation: {
                    id: 'don-1',
                    amount: 500
                },
                donorName: 'Test Donor'
            },
            'user-123'
        );

        expect(emailService.send).toHaveBeenCalledWith(
            EmailEventTypes.DONATION_RECEIPT,
            'donor@example.com',
            expect.objectContaining({
                donorName: 'Test Donor'
            }),
            expect.objectContaining({
                userId: 'user-123',
                referenceId: 'don-1'
            })
        );
    });

    it('preserves string userId options for subscription emails', async () => {
        await emailService.sendSubscriptionConfirmationEmail(
            'donor@example.com',
            {
                subscription: {
                    amount: 999,
                    donationRef: 'sub-ref-1'
                },
                donorName: 'Recurring Donor'
            },
            'user-456'
        );

        expect(emailService.send).toHaveBeenCalledWith(
            EmailEventTypes.SUBSCRIPTION_STARTED,
            'donor@example.com',
            expect.objectContaining({
                donorName: 'Recurring Donor'
            }),
            expect.objectContaining({
                userId: 'user-456',
                referenceId: 'sub-ref-1'
            })
        );
    });
});
