const moderationService = require('../services/moderation.service');
const supabase = require('../lib/supabase');

jest.mock('../lib/supabase', () => ({
    from: jest.fn()
}));

function createChain({
    singleResult,
    insertResult = { error: null },
    deleteResult = { error: null },
    orderResult,
    rangeResult
} = {}) {
    const builder = {
        eq: jest.fn(() => builder),
        select: jest.fn(() => builder),
        order: jest.fn(() => {
            if (orderResult) {
                return Promise.resolve(orderResult);
            }
            return builder;
        }),
        range: jest.fn(() => Promise.resolve(rangeResult || { data: [], count: 0, error: null })),
        single: jest.fn(() => Promise.resolve(singleResult || { data: null, error: null })),
        insert: jest.fn(() => Promise.resolve(insertResult)),
        delete: jest.fn(() => builder),
        update: jest.fn(() => builder)
    };

    return builder;
}

describe('ModerationService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('getFlaggedComments supports all-status pagination without applying a status filter', async () => {
        const commentsBuilder = createChain({
            rangeResult: {
                data: [{ id: 'comment-1', status: 'hidden' }],
                count: 1,
                error: null
            }
        });

        supabase.from.mockReturnValue(commentsBuilder);

        const result = await moderationService.getFlaggedComments(2, 20, 'all');

        expect(commentsBuilder.eq).toHaveBeenCalledWith('is_flagged', true);
        expect(commentsBuilder.eq).not.toHaveBeenCalledWith('status', 'all');
        expect(commentsBuilder.range).toHaveBeenCalledWith(20, 39);
        expect(result.pagination.page).toBe(2);
        expect(result.comments).toHaveLength(1);
    });

    test('approveComment logs unflagged and approved actions for a hidden flagged comment', async () => {
        const currentCommentBuilder = createChain({
            singleResult: {
                data: { flag_reason: 'spam', flag_count: 2, status: 'hidden' },
                error: null
            }
        });
        const unflagLogBuilder = createChain();
        const deleteFlagsBuilder = createChain();
        const updatedCommentBuilder = createChain({
            singleResult: {
                data: { id: 'comment-1', status: 'hidden' },
                error: null
            }
        });
        const activateCommentBuilder = createChain({
            singleResult: {
                data: { id: 'comment-1', status: 'active', is_flagged: false },
                error: null
            }
        });
        const approveLogBuilder = createChain();

        const builders = [
            currentCommentBuilder,
            unflagLogBuilder,
            deleteFlagsBuilder,
            updatedCommentBuilder,
            activateCommentBuilder,
            approveLogBuilder
        ];

        supabase.from.mockImplementation(() => builders.shift());

        const result = await moderationService.approveComment('comment-1', 'admin-1');

        expect(unflagLogBuilder.insert).toHaveBeenCalledWith({
            comment_id: 'comment-1',
            original_comment_id: 'comment-1',
            action: 'unflagged',
            performed_by: 'admin-1',
            metadata: {
                previous_flag_reason: 'spam',
                previous_flag_count: 2
            }
        });
        expect(deleteFlagsBuilder.eq).toHaveBeenCalledWith('comment_id', 'comment-1');
        expect(activateCommentBuilder.update).toHaveBeenCalledWith({ status: 'active' });
        expect(approveLogBuilder.insert).toHaveBeenCalledWith({
            comment_id: 'comment-1',
            original_comment_id: 'comment-1',
            action: 'approved',
            performed_by: 'admin-1',
            metadata: {
                old_status: 'hidden',
                new_status: 'active'
            }
        });
        expect(result.status).toBe('active');
    });

    test('getModerationHistory maps nested performer roles and queries by original comment id', async () => {
        const historyBuilder = createChain({
            orderResult: {
                data: [{
                    id: 'log-1',
                    original_comment_id: 'comment-1',
                    action: 'hidden',
                    performer: {
                        id: 'admin-1',
                        first_name: 'Alex',
                        last_name: 'Admin',
                        roles: { name: 'manager' }
                    }
                }],
                error: null
            }
        });

        supabase.from.mockReturnValue(historyBuilder);

        const result = await moderationService.getModerationHistory('comment-1');

        expect(historyBuilder.eq).toHaveBeenCalledWith('original_comment_id', 'comment-1');
        expect(result[0].performer.role).toBe('manager');
    });
});
