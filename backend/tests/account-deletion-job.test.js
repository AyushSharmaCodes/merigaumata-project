const crypto = require('crypto');
const { DeletionJobProcessor } = require('../services/deletion-job-processor');
const AccountDeletionService = require('../services/account-deletion.service');

// Mock dependencies
jest.mock('../config/supabase', () => ({
    supabase: {},
    supabaseAdmin: {
        from: jest.fn(),
        storage: { from: jest.fn() },
        auth: { admin: { deleteUser: jest.fn() } }
    }
}));

jest.mock('../lib/supabase', () => ({
    supabaseAdmin: require('../config/supabase').supabaseAdmin
}));

jest.mock('../services/email', () => ({
    sendAccountDeletionScheduledEmail: jest.fn(),
    sendAccountDeletedEmail: jest.fn(),
}));

const { supabaseAdmin } = require('../lib/supabase');

describe('DeletionJobProcessor PII Anonymization', () => {
    const jobId = 'test-job-id';
    const userId = 'test-user-id';
    const mockProfile = { email: 'user@example.com', name: 'Test User' };

    let mockQuery;

    beforeEach(() => {
        jest.clearAllMocks();

        mockQuery = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };

        supabaseAdmin.from.mockReturnValue(mockQuery);
        supabaseAdmin.storage.from.mockReturnValue({ remove: jest.fn().mockResolvedValue({ error: null }) });

        // Mock updateJobStep to bypass DB calls during unit test logic check
        jest.spyOn(DeletionJobProcessor, 'updateJobStep').mockResolvedValue();
    });

    test('anonymizeInvoices clears file_path and public_url', async () => {
        mockQuery.eq.mockResolvedValueOnce({ data: [{ id: 'order1' }, { id: 'order2' }], error: null });
        mockQuery.in.mockResolvedValueOnce({ error: null });

        await DeletionJobProcessor.anonymizeInvoices(jobId, userId);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('orders');
        expect(mockQuery.select).toHaveBeenCalledWith('id');
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('invoices');
        expect(mockQuery.update).toHaveBeenCalledWith({
            file_path: null,
            public_url: null,
        });
        expect(mockQuery.in).toHaveBeenCalledWith('order_id', ['order1', 'order2']);
    });

    test('deleteInvoiceFiles removes physical files from storage', async () => {
        mockQuery.eq.mockResolvedValueOnce({ data: [{ id: 'order1' }], error: null }); // orders
        mockQuery.not.mockResolvedValueOnce({ data: [{ file_path: 'invoices/order1.pdf' }], error: null }); // invoices

        const mockRemove = jest.fn().mockResolvedValue({ error: null });
        supabaseAdmin.storage.from.mockReturnValue({ remove: mockRemove });

        await DeletionJobProcessor.deleteInvoiceFiles(jobId, userId);

        expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('invoices');
        expect(mockRemove).toHaveBeenCalledWith(['invoices/order1.pdf']);
    });

    test('anonymizeContactMessages anonymizes based on profile email', async () => {
        mockQuery.eq.mockResolvedValueOnce({ error: null });

        await DeletionJobProcessor.anonymizeContactMessages(jobId, userId, mockProfile);

        const anonymizedHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('contact_messages');
        expect(mockQuery.update).toHaveBeenCalledWith({
            name: 'Deleted User',
            email: `deleted-${anonymizedHash}@anonymous.local`,
            ip_address: null,
            user_agent: null,
        });
        expect(mockQuery.eq).toHaveBeenCalledWith('email', mockProfile.email);
    });

    test('anonymizeCouponUsage removes user association', async () => {
        mockQuery.eq.mockResolvedValueOnce({ error: null });

        await DeletionJobProcessor.anonymizeCouponUsage(jobId, userId);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('coupon_usage');
        expect(mockQuery.update).toHaveBeenCalledWith({ user_id: null });
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);
    });

    test('anonymizeAuditLogs removes actor_id', async () => {
        mockQuery.eq.mockResolvedValueOnce({ error: null });

        await DeletionJobProcessor.anonymizeAuditLogs(jobId, userId);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('audit_logs');
        expect(mockQuery.update).toHaveBeenCalledWith({ actor_id: null });
        expect(mockQuery.eq).toHaveBeenCalledWith('actor_id', userId);
    });

    test('deleteNotifications removes newsletter subscriber entry using profile email', async () => {
        const orderNotificationsQuery = {
            delete: jest.fn(() => orderNotificationsQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };
        const profilesQuery = {
            select: jest.fn(() => profilesQuery),
            eq: jest.fn(() => profilesQuery),
            single: jest.fn().mockResolvedValue({
                data: { email: mockProfile.email },
                error: null
            })
        };
        const newsletterQuery = {
            delete: jest.fn(() => newsletterQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        supabaseAdmin.from
            .mockReturnValueOnce(orderNotificationsQuery)
            .mockReturnValueOnce(profilesQuery)
            .mockReturnValueOnce(newsletterQuery);

        await DeletionJobProcessor.deleteNotifications(jobId, userId);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('order_notifications');
        expect(supabaseAdmin.from).toHaveBeenCalledWith('profiles');
        expect(supabaseAdmin.from).toHaveBeenCalledWith('newsletter_subscribers');
        expect(newsletterQuery.eq).toHaveBeenCalledWith('email', mockProfile.email);
    });

    test('deleteStorageAssets removes private profile and testimonial uploads recorded in photos', async () => {
        mockQuery.in.mockResolvedValueOnce({
            data: [
                { bucket_name: 'profiles', image_path: `${userId}/avatar.png` },
                { bucket_name: 'testimonial-user', image_path: 'avatar/testimonial.png' }
            ],
            error: null
        });
        mockQuery.in.mockResolvedValueOnce({ error: null });

        const mockRemove = jest.fn().mockResolvedValue({ error: null });
        supabaseAdmin.storage.from.mockReturnValue({ remove: mockRemove });

        await DeletionJobProcessor.deleteStorageAssets(jobId, userId);

        expect(supabaseAdmin.from).toHaveBeenCalledWith('photos');
        expect(mockQuery.in).toHaveBeenCalledWith('bucket_name', ['profiles', 'testimonial-user']);
        expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('profiles');
        expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('testimonial-user');
        expect(mockRemove).toHaveBeenCalledWith([`${userId}/avatar.png`]);
        expect(mockRemove).toHaveBeenCalledWith(['avatar/testimonial.png']);
    });
});

describe('AccountDeletionService DAT validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('validateDAT queries the expires_at column', async () => {
        const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => query),
            gt: jest.fn(() => query),
            single: jest.fn().mockResolvedValue({
                data: { id: 'token-1' },
                error: null
            })
        };

        supabaseAdmin.from.mockReturnValue(query);

        const result = await AccountDeletionService.validateDAT('user-1', 'plain-token');

        expect(result).toEqual({ valid: true, tokenId: 'token-1' });
        expect(query.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    });
});
