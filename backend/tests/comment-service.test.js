const commentService = require('../services/comment.service');
const supabase = require('../config/supabase');

jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn()
}));

function createDeferredQuery(resolver) {
    const state = {
        filters: {},
        rangeArgs: null
    };

    const builder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column, value) => {
            state.filters[column] = value;
            return builder;
        }),
        is: jest.fn((column, value) => {
            state.filters[`is:${column}`] = value;
            return builder;
        }),
        in: jest.fn((column, value) => {
            state.filters[`in:${column}`] = value;
            return builder;
        }),
        or: jest.fn((value) => {
            state.filters.or = value;
            return builder;
        }),
        order: jest.fn(() => builder),
        range: jest.fn((from, to) => {
            state.rangeArgs = [from, to];
            return Promise.resolve(resolver(state));
        }),
        then(resolve, reject) {
            return Promise.resolve(resolver(state)).then(resolve, reject);
        }
    };

    return builder;
}

function createSingleResultBuilder(result) {
    const builder = {
        select: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        insert: jest.fn(() => builder),
        update: jest.fn(() => builder),
        delete: jest.fn(() => builder),
        single: jest.fn(() => Promise.resolve(result))
    };

    return builder;
}

describe('CommentService.getComments', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('uses RPC results when available and builds nested replies', async () => {
        supabase.rpc.mockResolvedValue({
            data: [
                {
                    id: 'root-1',
                    blog_id: 'blog-1',
                    user_id: 'user-1',
                    parent_id: null,
                    content: 'Root comment',
                    status: 'active',
                    created_at: '2026-03-20T10:00:00.000Z',
                    updated_at: '2026-03-20T10:00:00.000Z',
                    reply_count: 1,
                    upvotes: 0,
                    downvotes: 0,
                    is_flagged: false,
                    user_name: 'Alice',
                    user_avatar_url: null,
                    user_role: 'customer'
                },
                {
                    id: 'reply-1',
                    blog_id: 'blog-1',
                    user_id: 'user-2',
                    parent_id: 'root-1',
                    content: 'Reply comment',
                    status: 'active',
                    created_at: '2026-03-20T11:00:00.000Z',
                    updated_at: '2026-03-20T11:00:00.000Z',
                    reply_count: 0,
                    upvotes: 0,
                    downvotes: 0,
                    is_flagged: false,
                    user_name: 'Bob',
                    user_avatar_url: null,
                    user_role: 'manager'
                }
            ],
            error: null
        });

        supabase.from.mockImplementation((table) => {
            if (table !== 'comments') {
                throw new Error(`Unexpected table ${table}`);
            }

            return createDeferredQuery(() => ({
                count: 1,
                error: null
            }));
        });

        const result = await commentService.getComments('blog-1', 1, 10, 'newest');

        expect(supabase.rpc).toHaveBeenCalledWith('get_threaded_comments', {
            p_blog_id: 'blog-1',
            p_limit: 10,
            p_offset: 0,
            p_sort_by: 'newest'
        });
        expect(result.pagination.total).toBe(1);
        expect(result.comments).toHaveLength(1);
        expect(result.comments[0].replies).toHaveLength(1);
        expect(result.comments[0].profiles.first_name).toBe('Alice');
        expect(result.comments[0].replies[0].profiles.role).toBe('manager');
    });

    test('falls back to paged root/child fetch when RPC fails', async () => {
        supabase.rpc.mockResolvedValue({
            data: null,
            error: new Error('rpc unavailable')
        });

        supabase.from.mockImplementation((table) => {
            if (table !== 'comments') {
                throw new Error(`Unexpected table ${table}`);
            }

            return createDeferredQuery((state) => {
                if (state.filters['is:parent_id'] === null) {
                    return {
                        data: [
                            {
                                id: 'root-1',
                                blog_id: 'blog-1',
                                user_id: 'user-1',
                                parent_id: null,
                                content: 'Root',
                                status: 'active',
                                created_at: '2026-03-20T10:00:00.000Z',
                                updated_at: '2026-03-20T10:00:00.000Z',
                                reply_count: 1,
                                upvotes: 0,
                                downvotes: 0,
                                is_flagged: false,
                                profiles: {
                                    first_name: 'Alice',
                                    avatar_url: null,
                                    roles: { name: 'customer' }
                                }
                            }
                        ],
                        count: 1,
                        error: null
                    };
                }

                const parentIds = state.filters['in:parent_id'] || [];
                if (parentIds.includes('root-1')) {
                    return {
                        data: [
                            {
                                id: 'reply-1',
                                blog_id: 'blog-1',
                                user_id: 'user-2',
                                parent_id: 'root-1',
                                content: 'Reply',
                                status: 'active',
                                created_at: '2026-03-20T11:00:00.000Z',
                                updated_at: '2026-03-20T11:00:00.000Z',
                                reply_count: 0,
                                upvotes: 0,
                                downvotes: 0,
                                is_flagged: false,
                                profiles: {
                                    first_name: 'Bob',
                                    avatar_url: null,
                                    roles: { name: 'customer' }
                                }
                            }
                        ],
                        error: null
                    };
                }

                return {
                    data: [],
                    error: null
                };
            });
        });

        const result = await commentService.getComments('blog-1', 1, 10, 'newest');

        expect(result.pagination.total).toBe(1);
        expect(result.comments).toHaveLength(1);
        expect(result.comments[0].id).toBe('root-1');
        expect(result.comments[0].replies).toHaveLength(1);
        expect(result.comments[0].replies[0].id).toBe('reply-1');
    });

    test('keeps deleted root comments visible when they still have replies', async () => {
        supabase.rpc.mockResolvedValue({
            data: [
                {
                    id: 'root-deleted',
                    blog_id: 'blog-1',
                    user_id: 'user-1',
                    parent_id: null,
                    content: 'Deleted root',
                    status: 'deleted',
                    created_at: '2026-03-20T10:00:00.000Z',
                    updated_at: '2026-03-20T10:00:00.000Z',
                    reply_count: 1,
                    upvotes: 0,
                    downvotes: 0,
                    is_flagged: false,
                    user_name: 'Alice',
                    user_avatar_url: null,
                    user_role: 'customer'
                },
                {
                    id: 'reply-1',
                    blog_id: 'blog-1',
                    user_id: 'user-2',
                    parent_id: 'root-deleted',
                    content: 'Still visible reply',
                    status: 'active',
                    created_at: '2026-03-20T11:00:00.000Z',
                    updated_at: '2026-03-20T11:00:00.000Z',
                    reply_count: 0,
                    upvotes: 0,
                    downvotes: 0,
                    is_flagged: false,
                    user_name: 'Bob',
                    user_avatar_url: null,
                    user_role: 'customer'
                }
            ],
            error: null
        });

        const countBuilder = createDeferredQuery(() => ({
            count: 1,
            error: null
        }));

        supabase.from.mockReturnValue(countBuilder);

        const result = await commentService.getComments('blog-1', 1, 10, 'newest');

        expect(countBuilder.or).toHaveBeenCalledWith('status.eq.active,and(status.eq.deleted,reply_count.gt.0)');
        expect(result.comments).toHaveLength(1);
        expect(result.comments[0].status).toBe('deleted');
        expect(result.comments[0].replies).toHaveLength(1);
    });
});

describe('CommentService.createComment', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('rejects replies when the parent belongs to a different blog', async () => {
        const parentBuilder = createSingleResultBuilder({
            data: {
                id: 'parent-1',
                blog_id: 'blog-2',
                status: 'active'
            },
            error: null
        });

        supabase.from.mockReturnValue(parentBuilder);

        await expect(
            commentService.createComment('user-1', 'blog-1', 'Reply body', 'parent-1')
        ).rejects.toThrow('Reply must belong to the same blog post');
    });

    test('rejects replies when the parent comment is no longer active', async () => {
        const parentBuilder = createSingleResultBuilder({
            data: {
                id: 'parent-1',
                blog_id: 'blog-1',
                status: 'deleted'
            },
            error: null
        });

        supabase.from.mockReturnValue(parentBuilder);

        await expect(
            commentService.createComment('user-1', 'blog-1', 'Reply body', 'parent-1')
        ).rejects.toThrow('Cannot reply to a comment that is no longer active');
    });

    test('creates replies after validating an active parent in the same blog', async () => {
        const parentBuilder = createSingleResultBuilder({
            data: {
                id: 'parent-1',
                blog_id: 'blog-1',
                status: 'active'
            },
            error: null
        });

        const insertBuilder = createSingleResultBuilder({
            data: {
                id: 'comment-1',
                blog_id: 'blog-1',
                user_id: 'user-1',
                parent_id: 'parent-1',
                content: 'Reply body',
                status: 'active',
                profiles: {
                    id: 'user-1',
                    first_name: 'Alice',
                    avatar_url: null,
                    roles: { name: 'customer' }
                }
            },
            error: null
        });

        supabase.from
            .mockReturnValueOnce(parentBuilder)
            .mockReturnValueOnce(insertBuilder);

        const result = await commentService.createComment('user-1', 'blog-1', 'Reply body', 'parent-1');

        expect(insertBuilder.insert).toHaveBeenCalledWith({
            user_id: 'user-1',
            blog_id: 'blog-1',
            content: 'Reply body',
            parent_id: 'parent-1',
            status: 'active'
        });
        expect(result.profiles.role).toBe('customer');
    });
});
