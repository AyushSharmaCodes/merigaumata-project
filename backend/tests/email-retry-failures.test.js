const EmailRetryService = require('../services/email-retry.service');
const emailService = require('../services/email');
const supabase = require('../config/supabase');

jest.mock('../services/email');
jest.mock('../config/supabase');

function createSelectQuery(mockEmails) {
    const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        lt: jest.fn(() => query),
        or: jest.fn(() => query),
        order: jest.fn(() => query),
        limit: jest.fn().mockResolvedValue({ data: mockEmails, error: null })
    };
    return query;
}

function createUpdateQuery() {
    const query = {
        update: jest.fn(() => query),
        eq: jest.fn().mockResolvedValue({ error: null })
    };
    return query;
}

describe('EmailRetryService repeated provider failure handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('marks retried email as FAILED with next_retry_at when provider fails before max retries', async () => {
        const mockEmails = [
            {
                id: 'email-1',
                email_type: 'ORDER_CONFIRMATION',
                recipient_email: 'test@example.com',
                retry_count: 1,
                user_id: 'user-1',
                metadata: { template_data: { orderId: '123' } }
            }
        ];

        const selectQuery = createSelectQuery(mockEmails);
        const updateQuery = createUpdateQuery();

        supabase.from
            .mockReturnValueOnce(selectQuery)
            .mockReturnValueOnce(updateQuery);

        emailService.send.mockResolvedValue({ success: false, error: 'SMTP connection timed out.' });

        const result = await EmailRetryService.processFailedEmails(1);

        expect(result).toEqual({ processed: 1, successful: 0 });
        expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'FAILED',
            retry_count: 2,
            error_message: 'SMTP connection timed out.'
        }));
        expect(updateQuery.update.mock.calls[0][0].next_retry_at).toBeTruthy();
    });

    test('marks retried email as PERMANENTLY_FAILED after final provider failure', async () => {
        const mockEmails = [
            {
                id: 'email-2',
                email_type: 'ORDER_CONFIRMATION',
                recipient_email: 'test@example.com',
                retry_count: 2,
                user_id: 'user-1',
                metadata: { template_data: { orderId: '123' } }
            }
        ];

        const selectQuery = createSelectQuery(mockEmails);
        const updateQuery = createUpdateQuery();

        supabase.from
            .mockReturnValueOnce(selectQuery)
            .mockReturnValueOnce(updateQuery);

        emailService.send.mockResolvedValue({ success: false, error: 'SMTP connection timed out.' });

        const result = await EmailRetryService.processFailedEmails(1);

        expect(result).toEqual({ processed: 1, successful: 0 });
        expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'PERMANENTLY_FAILED',
            retry_count: 3,
            next_retry_at: null,
            error_message: 'SMTP connection timed out.'
        }));
    });
});
