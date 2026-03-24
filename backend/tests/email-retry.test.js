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

describe('EmailRetryService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processFailedEmails', () => {
        it('retries ORDER_CONFIRMATION records using the internal ORDER_PLACED template type', async () => {
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

            const selectQuery = createSelectQuery(mockEmails);
            const updateQuery = createUpdateQuery();

            supabase.from
                .mockReturnValueOnce(selectQuery)
                .mockReturnValueOnce(updateQuery);

            emailService.send.mockResolvedValue({ success: true });

            const result = await EmailRetryService.processFailedEmails(1);

            expect(result).toEqual({ processed: 1, successful: 1 });
            expect(emailService.send).toHaveBeenCalledWith(
                'ORDER_PLACED',
                'test@example.com',
                { orderId: '123' },
                { userId: 'user1', lang: undefined }
            );
            expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'SENT',
                retry_count: 1,
                next_retry_at: null
            }));
        });

        it('marks missing-template retries as permanently failed after the final allowed attempt', async () => {
            const mockEmails = [
                {
                    id: '2',
                    email_type: 'ORDER_CONFIRMATION',
                    recipient_email: 'test@example.com',
                    retry_count: 2,
                    max_retries: 3,
                    metadata: {}
                }
            ];

            const selectQuery = createSelectQuery(mockEmails);
            const updateQuery = createUpdateQuery();

            supabase.from
                .mockReturnValueOnce(selectQuery)
                .mockReturnValueOnce(updateQuery);

            const result = await EmailRetryService.processFailedEmails(1);

            expect(result).toEqual({ processed: 1, successful: 0 });
            expect(emailService.send).not.toHaveBeenCalled();
            expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'PERMANENTLY_FAILED',
                retry_count: 3,
                next_retry_at: null,
                error_message: 'Missing reference_id for order email retry'
            }));
        });
    });
});
