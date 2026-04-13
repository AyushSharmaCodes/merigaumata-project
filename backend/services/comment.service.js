const supabase = require('../lib/supabase');

const logger = require('../utils/logger');
const CommentMessages = require('../constants/messages/CommentMessages');

class CommentService {
    getVisibleRootFilter() {
        return 'status.eq.active,and(status.eq.deleted,reply_count.gt.0)';
    }

    buildThreadedCommentTree(rawComments) {
        const commentMap = {};
        const allRootComments = [];

        rawComments.forEach(c => {
            const roleName = c.user_role || c.profiles?.roles?.name || 'customer';
            const isDeleted = c.status === 'deleted';
            const displayContent = isDeleted ? '[This comment has been deleted]' : c.content;
            const hasProfileData = c.profiles || c.user_name || c.user_avatar_url;

            const displayProfile = hasProfileData ? {
                id: c.user_id,
                first_name: c.user_name || c.profiles?.first_name || 'Unknown',
                avatar_url: c.user_avatar_url || c.profiles?.avatar_url || null,
                role: roleName
            } : {
                id: null,
                first_name: 'Deleted User',
                avatar_url: null,
                role: 'customer'
            };

            commentMap[c.id] = {
                id: c.id,
                blog_id: c.blog_id,
                user_id: c.user_id,
                parent_id: c.parent_id,
                content: displayContent,
                status: c.status,
                created_at: c.created_at,
                updated_at: c.updated_at,
                reply_count: c.reply_count || 0,
                upvotes: c.upvotes || 0,
                downvotes: c.downvotes || 0,
                is_flagged: c.is_flagged,
                profiles: displayProfile,
                replies: []
            };
        });

        rawComments.forEach(c => {
            const comment = commentMap[c.id];
            if (c.parent_id && commentMap[c.parent_id]) {
                commentMap[c.parent_id].replies.push(comment);
            } else if (!c.parent_id) {
                allRootComments.push(comment);
            }
        });

        const pruneComments = (comments) => {
            return comments.filter(comment => {
                if (comment.replies.length > 0) {
                    comment.replies = pruneComments(comment.replies);
                }
                return comment.status === 'active' || comment.replies.length > 0;
            });
        };

        return pruneComments(allRootComments);
    }

    async fetchCommentsViaRpc(blogId, limit, offset, sortBy) {
        const { data, error } = await supabase.rpc('get_threaded_comments', {
            p_blog_id: blogId,
            p_limit: limit,
            p_offset: offset,
            p_sort_by: sortBy || 'newest'
        });

        if (error) throw error;

        const { count, error: countError } = await supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('blog_id', blogId)
            .is('parent_id', null)
            .or(this.getVisibleRootFilter());

        if (countError) throw countError;

        return {
            comments: this.buildThreadedCommentTree(data || []),
            pagination: {
                page: Math.floor(offset / limit) + 1,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        };
    }

    async fetchCommentsViaPagedFallback(blogId, page, limit, sortBy) {
        const offset = (page - 1) * limit;
        let rootQuery = supabase
            .from('comments')
            .select(`
                *,
                profiles: user_id (
                    id,
                    first_name,
                    last_name,
                    avatar_url,
                    roles ( name )
                )
            `, { count: 'exact' })
            .eq('blog_id', blogId)
            .is('parent_id', null)
            .or(this.getVisibleRootFilter());

        if (sortBy === 'oldest') {
            rootQuery = rootQuery.order('created_at', { ascending: true });
        } else if (sortBy === 'most-replies') {
            rootQuery = rootQuery.order('reply_count', { ascending: false }).order('created_at', { ascending: false });
        } else {
            rootQuery = rootQuery.order('created_at', { ascending: false });
        }

        const { data: rootComments, error: rootError, count } = await rootQuery.range(offset, offset + limit - 1);

        if (rootError) {
            logger.error({ err: rootError, blogId }, 'Service: Error fetching paged root comments');
            throw rootError;
        }

        if (!rootComments || rootComments.length === 0) {
            return {
                comments: [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };
        }

        const collectedComments = [...rootComments];
        const seenIds = new Set(rootComments.map(comment => comment.id));
        let parentIds = rootComments.map(comment => comment.id);
        let depth = 0;

        while (parentIds.length > 0 && depth < 10) {
            const { data: childComments, error: childError } = await supabase
                .from('comments')
                .select(`
                    *,
                    profiles: user_id (
                        id,
                        first_name,
                        last_name,
                        avatar_url,
                        roles ( name )
                    )
                `)
                .in('parent_id', parentIds)
                .in('status', ['active', 'deleted'])
                .order('created_at', { ascending: true });

            if (childError) {
                logger.error({ err: childError, blogId, parentIds }, 'Service: Error fetching paged child comments');
                throw childError;
            }

            const nextParentIds = [];

            (childComments || []).forEach(comment => {
                if (!seenIds.has(comment.id)) {
                    seenIds.add(comment.id);
                    collectedComments.push(comment);
                    nextParentIds.push(comment.id);
                }
            });

            parentIds = nextParentIds;
            depth += 1;
        }

        return {
            comments: this.buildThreadedCommentTree(collectedComments),
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        };
    }

    /**
   * Get comments for a blog post with pagination (threaded)
   */
    async getComments(blogId, page = 1, limit = 20, sortBy = 'newest') {
        const offset = (page - 1) * limit;

        logger.info({ blogId, page, limit, sortBy }, 'Service: Fetching threaded comments');

        try {
            return await this.fetchCommentsViaRpc(blogId, limit, offset, sortBy);
        } catch (rpcError) {
            logger.warn({ err: rpcError, blogId }, 'Service: RPC comment fetch failed, using paged fallback');
        }

        return this.fetchCommentsViaPagedFallback(blogId, page, limit, sortBy);
    }

    /**
     * Create a new comment
     */
    async createComment(userId, blogId, content, parentId = null) {
        logger.info({ userId, blogId, parentId }, 'Service: Creating comment');

        if (parentId) {
            const { data: parentComment, error: parentError } = await supabase
                .from('comments')
                .select('id, blog_id, status')
                .eq('id', parentId)
                .single();

            if (parentError) {
                logger.error({ err: parentError, parentId, blogId, userId }, 'Service: Error validating parent comment');
                throw parentError;
            }

            if (!parentComment) {
                throw new Error('Parent comment not found');
            }

            if (parentComment.blog_id !== blogId) {
                logger.warn({ parentId, parentBlogId: parentComment.blog_id, blogId, userId }, 'Service: Parent comment blog mismatch');
                throw new Error('Reply must belong to the same blog post');
            }

            if (parentComment.status !== 'active') {
                logger.warn({ parentId, parentStatus: parentComment.status, blogId, userId }, 'Service: Reply attempted on non-active parent');
                throw new Error('Cannot reply to a comment that is no longer active');
            }
        }

        const { data, error } = await supabase
            .from('comments')
            .insert({
                user_id: userId,
                blog_id: blogId,
                content,
                parent_id: parentId,
                status: 'active'
            })
            .select(`
                *,
                profiles: user_id(id, first_name, last_name, avatar_url, roles(name))
            `)
            .single();

        if (error) {
            logger.error({ err: error, userId, blogId }, 'Service: Error inserting comment');
            throw error;
        }

        // Flatten the role structure to match frontend expectation
        if (data.profiles) {
            data.profiles.role = data.profiles.roles?.name || 'customer';
            delete data.profiles.roles;
        }

        return data;
    }

    /**
     * Update a comment (owner only)
     */
    async updateComment(commentId, userId, content) {
        logger.info({ commentId, userId }, 'Service: Updating comment');

        // First check ownership and time limit (15 mins)
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id, created_at')
            .eq('id', commentId)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, commentId }, 'Service: Error fetching comment for update');
            throw fetchError;
        }
        if (!comment) throw new Error(CommentMessages.NOT_FOUND);

        if (comment.user_id !== userId) {
            logger.warn({ commentId, userId, ownerId: comment.user_id }, 'Service: Unauthorized update attempt');
            throw new Error(CommentMessages.UNAUTHORIZED);
        }

        const minutesSincePost = (new Date() - new Date(comment.created_at)) / 60000;
        if (minutesSincePost > 15) {
            logger.warn({ commentId, minutesSincePost }, 'Service: Update time limit exceeded');
            throw new Error(CommentMessages.UPDATE_FAILED); // Using UPDATE_FAILED as EDIT_TIME_LIMIT doesn't exist yet, can add later
        }

        const { data, error } = await supabase
            .from('comments')
            .update({
                content,
                updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) {
            logger.error({ err: error, commentId }, 'Service: Error updating comment content');
            throw error;
        }
        return data;
    }

    /**
     * Soft delete a comment
     */
    async deleteComment(commentId, userId, userRole, token = null) {
        logger.info({ commentId, userId, userRole }, 'Service: Deleting comment (Smart Delete)');

        // Check permissions and reply count
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id, reply_count')
            .eq('id', commentId)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, commentId }, 'Service: Error fetching comment for deletion');
            throw fetchError;
        }
        if (!comment) throw new Error(CommentMessages.NOT_FOUND);

        const isOwner = comment.user_id === userId;
        const isAdmin = ['admin', 'manager'].includes(userRole);

        if (!isOwner && !isAdmin) {
            logger.warn({ commentId, userId, userRole }, 'Service: Unauthorized deletion attempt');
            throw new Error(CommentMessages.UNAUTHORIZED);
        }

        // Use service role client (supabase) to avoid RLS issues in triggers
        // Specifically, update_parent_reply_count trigger needs to update parent comments
        // which may belong to other users. RLS would block this if using scoped client.
        const dbClient = supabase;

        let data, error;

        // Smart Delete Logic
        if (comment.reply_count > 0) {
            // Soft Delete
            logger.info({ commentId }, 'Service: Comment has replies, performing Soft Delete');
            ({ data, error } = await dbClient
                .from('comments')
                .update({
                    status: 'deleted',
                    deleted_at: new Date().toISOString(),
                    deleted_by: userId
                })
                .eq('id', commentId)
                .select()
                .single());
        } else {
            // Hard Delete
            logger.info({ commentId }, 'Service: Comment has no replies, performing Hard Delete');
            ({ data, error } = await dbClient
                .from('comments')
                .delete()
                .eq('id', commentId)
                .select()
                .single());
        }

        if (error) {
            logger.error({ err: error, commentId }, 'Service: Error deleting comment');
            throw error;
        }
        return data;
    }

    /**
     * Flag a comment
     */
    async flagComment(commentId, userId, reason, details) {
        logger.info({ commentId, userId, reason }, 'Service: Flagging comment');

        const { data, error } = await supabase
            .from('comment_flags')
            .insert({
                comment_id: commentId,
                flagged_by: userId,
                reason,
                details
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                logger.warn({ commentId, userId }, 'Service: User already flagged this comment');
                throw new Error(CommentMessages.ALREADY_FLAGGED);
            }
            logger.error({ err: error, commentId, userId }, 'Service: Error flagging comment');
            throw error;
        }
        return data;
    }
}

module.exports = new CommentService();
