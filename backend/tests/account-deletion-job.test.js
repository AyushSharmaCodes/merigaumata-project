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
    supabase: require('../config/supabase').supabase,
    supabaseAdmin: require('../config/supabase').supabaseAdmin
}));

jest.mock('../services/email', () => ({
    sendAccountDeletionScheduledEmail: jest.fn(),
    sendAccountDeletedEmail: jest.fn(),
}));

const { supabase, supabaseAdmin } = require('../lib/supabase');

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

    test('deleteCart removes cart items through cart_id before deleting the cart', async () => {
        const cartsQuery = {
            select: jest.fn(() => cartsQuery),
            eq: jest.fn(() => cartsQuery),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'cart-1' },
                error: null
            })
        };
        const cartItemsQuery = {
            delete: jest.fn(() => cartItemsQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };
        const deleteCartQuery = {
            delete: jest.fn(() => deleteCartQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        supabaseAdmin.from
            .mockReturnValueOnce(cartsQuery)
            .mockReturnValueOnce(cartItemsQuery)
            .mockReturnValueOnce(deleteCartQuery);

        await DeletionJobProcessor.deleteCart(jobId, userId);

        expect(supabaseAdmin.from).toHaveBeenNthCalledWith(1, 'carts');
        expect(cartsQuery.eq).toHaveBeenCalledWith('user_id', userId);
        expect(supabaseAdmin.from).toHaveBeenNthCalledWith(2, 'cart_items');
        expect(cartItemsQuery.eq).toHaveBeenCalledWith('cart_id', 'cart-1');
        expect(supabaseAdmin.from).toHaveBeenNthCalledWith(3, 'carts');
        expect(deleteCartQuery.eq).toHaveBeenCalledWith('id', 'cart-1');
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

describe('DeletionJobProcessor orchestration safety', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('retryFailedJobs restores deletion status before reprocessing', async () => {
        const failedJobsQuery = {
            select: jest.fn(() => failedJobsQuery),
            eq: jest.fn(() => failedJobsQuery),
            lt: jest.fn(() => failedJobsQuery),
            lte: jest.fn().mockResolvedValue({
                data: [{ id: 'job-1', user_id: 'user-1', current_step: 'DELETE_CART', retry_count: 1 }],
                error: null
            })
        };
        const profileUpdateQuery = {
            update: jest.fn(() => profileUpdateQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };
        const jobResetQuery = {
            update: jest.fn(() => jobResetQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        supabaseAdmin.from
            .mockReturnValueOnce(failedJobsQuery)
            .mockReturnValueOnce(profileUpdateQuery)
            .mockReturnValueOnce(jobResetQuery);

        jest.spyOn(DeletionJobProcessor, 'processJob').mockResolvedValue({ success: true });

        const result = await DeletionJobProcessor.retryFailedJobs();

        expect(result).toEqual({ processed: 1, successful: 1, failed: 0 });
        expect(supabaseAdmin.from).toHaveBeenNthCalledWith(2, 'profiles');
        expect(profileUpdateQuery.update).toHaveBeenCalledWith({ deletion_status: 'DELETION_IN_PROGRESS' });
        expect(supabaseAdmin.from).toHaveBeenNthCalledWith(3, 'account_deletion_jobs');
        expect(jobResetQuery.update).toHaveBeenCalledWith({
            status: 'PENDING',
            current_step: 'DELETE_CART'
        });
        expect(DeletionJobProcessor.processJob).toHaveBeenCalledWith('job-1');
    });

    test('processScheduledDeletions retries blocked due jobs once blockers are cleared', async () => {
        const dueJobsQuery = {
            select: jest.fn(() => dueJobsQuery),
            in: jest.fn().mockResolvedValue({
                data: [{
                    id: 'job-2',
                    user_id: 'user-2',
                    mode: 'SCHEDULED',
                    status: 'BLOCKED',
                    scheduled_for: '2026-03-24T00:00:00.000Z',
                    profiles: { deletion_status: 'PENDING_DELETION_BLOCKED' }
                }],
                error: null
            })
        };
        const jobResetQuery = {
            update: jest.fn(() => jobResetQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };
        const profileUpdateQuery = {
            update: jest.fn(() => profileUpdateQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        supabaseAdmin.from
            .mockReturnValueOnce(dueJobsQuery)
            .mockReturnValueOnce(jobResetQuery)
            .mockReturnValueOnce(profileUpdateQuery);

        jest.spyOn(AccountDeletionService, 'checkEligibility').mockResolvedValue({ eligible: true, blockingReasons: [] });
        jest.spyOn(DeletionJobProcessor, 'processJob').mockResolvedValue({ success: true });

        const result = await DeletionJobProcessor.processScheduledDeletions();

        expect(result).toEqual({ success: true, processed: 1 });
        expect(jobResetQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
        expect(profileUpdateQuery.update).toHaveBeenCalledWith({ deletion_status: 'DELETION_IN_PROGRESS' });
        expect(DeletionJobProcessor.processJob).toHaveBeenCalledWith('job-2');
    });

    test('processScheduledDeletions recovers immediate jobs stranded after restart', async () => {
        const dueJobsQuery = {
            select: jest.fn(() => dueJobsQuery),
            in: jest.fn().mockResolvedValue({
                data: [{
                    id: 'job-3',
                    user_id: 'user-3',
                    mode: 'IMMEDIATE',
                    status: 'PENDING',
                    scheduled_for: null,
                    profiles: { deletion_status: 'DELETION_IN_PROGRESS' }
                }],
                error: null
            })
        };
        const profileUpdateQuery = {
            update: jest.fn(() => profileUpdateQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        supabaseAdmin.from
            .mockReturnValueOnce(dueJobsQuery)
            .mockReturnValueOnce(profileUpdateQuery);

        jest.spyOn(AccountDeletionService, 'checkEligibility').mockResolvedValue({ eligible: true, blockingReasons: [] });
        jest.spyOn(DeletionJobProcessor, 'processJob').mockResolvedValue({ success: true });

        const result = await DeletionJobProcessor.processScheduledDeletions();

        expect(result).toEqual({ success: true, processed: 1 });
        expect(profileUpdateQuery.update).toHaveBeenCalledWith({ deletion_status: 'DELETION_IN_PROGRESS' });
        expect(DeletionJobProcessor.processJob).toHaveBeenCalledWith('job-3');
    });
});

describe('AccountDeletionService consistency safeguards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('confirmImmediateDeletion cancels the job if profile mutation fails', async () => {
        jest.spyOn(AccountDeletionService, 'validateDAT').mockResolvedValue({ valid: true, tokenId: 'dat-1' });
        jest.spyOn(AccountDeletionService, 'checkEligibility').mockResolvedValue({ eligible: true, blockingReasons: [] });
        jest.spyOn(AccountDeletionService, 'markDATUsed').mockResolvedValue();
        jest.spyOn(AccountDeletionService, 'writeAuditLog').mockResolvedValue();

        const profileReadQuery = {
            select: jest.fn(() => profileReadQuery),
            eq: jest.fn(() => profileReadQuery),
            single: jest.fn().mockResolvedValue({
                data: { email: 'user@example.com', name: 'Test User' },
                error: null
            })
        };

        const jobInsertQuery = {
            insert: jest.fn(() => jobInsertQuery),
            select: jest.fn(() => jobInsertQuery),
            single: jest.fn().mockResolvedValue({
                data: { id: 'job-rollback' },
                error: null
            })
        };

        const profileUpdateQuery = {
            update: jest.fn(() => profileUpdateQuery),
            eq: jest.fn().mockResolvedValue({
                error: new Error('profile write failed')
            })
        };

        const cancelJobQuery = {
            update: jest.fn(() => cancelJobQuery),
            eq: jest.fn().mockResolvedValue({ error: null })
        };

        supabase.from = jest.fn().mockReturnValue(profileReadQuery);
        supabaseAdmin.from
            .mockReturnValueOnce(jobInsertQuery)
            .mockReturnValueOnce(profileUpdateQuery)
            .mockReturnValueOnce(cancelJobQuery);

        await expect(
            AccountDeletionService.confirmImmediateDeletion('user-1', 'token', 'requested by user')
        ).rejects.toThrow('profile write failed');

        expect(cancelJobQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'CANCELLED',
            error_log: [expect.objectContaining({ reason: 'PROFILE_UPDATE_FAILED' })]
        }));
        expect(cancelJobQuery.eq).toHaveBeenCalledWith('id', 'job-rollback');
    });
});
