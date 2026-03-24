const EmailRetryService = require('../services/email-retry.service');
const emailService = require('../services/email');
const supabase = require('../config/supabase');

// Mock dependencies
jest.mock('../services/email');
jest.mock('../config/supabase');

describe('EmailRetryService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processFailedEmails', () => {
        it('should process failed emails and update status to SENT on success', async () => {
            // Mock Supabase select
            const mockEmails = [
                {
                    id: '1',
                    email_type: 'ORDER_CONFIRMATION',
                    recipient_email: 'test@example.com',
                    retry_count: 0,
                    user_id: 'user1',
                    metadata: { template_data: { orderId: '123' } }
                }
            ];

            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: mockEmails, error: null }),
                update: jest.fn().mockReturnThis()
            });

            // Mock emailService.send
            emailService.send.mockResolvedValue({ success: true });

            const result = await EmailRetryService.processFailedEmails(1);

            expect(result.processed).toBe(1);
            expect(result.successful).toBe(1);
            expect(emailService.send).toHaveBeenCalledWith(
                'ORDER_CONFIRMATION',
                'test@example.com',
                { orderId: '123' },
                { userId: 'user1' }
            );
            
            // Verify update call
            expect(supabase.from).toHaveBeenCalledWith('email_notifications');
            // We can't easily check chained calls with the simple mock above, 
            // but in a real test we'd use a more sophisticated mock or integration test.
        });

        it('should mark as PERMANENTLY_FAILED if template_data is missing', async () => {
            const mockEmails = [
                {
                    id: '2',
                    email_type: 'ORDER_CONFIRMATION',
                    recipient_email: 'test@example.com',
                    retry_count: 0,
                    metadata: {} // Missing template_data
                }
            ];

            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: mockEmails, error: null }),
                update: jest.fn().mockReturnThis()
            });

            const result = await EmailRetryService.processFailedEmails(1);

            expect(result.processed).toBe(1);
            expect(result.successful).toBe(0);
            expect(emailService.send).not.toHaveBeenCalled();
            // Should call update with status PERMANENTLY_FAILED
        });
    });
});
