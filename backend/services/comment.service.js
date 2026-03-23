const supabase = require('../config/supabase');

const logger = require('../utils/logger');
const CommentMessages = require('../constants/messages/CommentMessages');

class CommentService {
    /**
   * Get comments for a blog post with pagination (threaded)
   */
    async getComments(blogId, page = 1, limit = 20, sortBy = 'newest') {
        const offset = (page - 1) * limit;

        logger.info({ blogId, page, limit, sortBy }, 'Service: Fetching threaded comments via fallback (non-RPC)');

        // Fallback: Fetch ALL active comments for the blog to build thread in-memory
        // This is a workaround for the broken get_threaded_comments RPC which has a schema mismatch
        const { data: rawComments, error } = await supabase
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
            .eq('blog_id', blogId)
            .in('status', ['active', 'deleted']);

        if (error) {
            logger.error({ err: error, blogId }, 'Service: Error fetching raw comments');
            throw error;
        }

        // Build nested tree structure
        const commentMap = {};
        const allRootComments = [];

        // First pass: Create objects and map them
        rawComments.forEach(c => {
            // Map DB columns to frontend expected structure
            // Handle profile data structure difference (RPC vs Raw)
            const roleName = c.profiles?.roles?.name || 'customer';

            // Scrub deleted comments content only, keep profile unless profile is missing
            const isDeleted = c.status === 'deleted';
            const displayContent = isDeleted ? '[This comment has been deleted]' : c.content;

            // Only show "Deleted User" if the profile itself is missing (hard deleted)
            // Otherwise show original author even if comment is deleted
            const displayProfile = c.profiles ? {
                id: c.user_id,
                first_name: c.profiles.first_name || 'Unknown',
                avatar_url: c.profiles.avatar_url,
                role: roleName
            } : {
                id: null,
                first_name: 'Deleted User',
                avatar_url: null,
                role: 'customer'
            };

            const comment = {
                id: c.id,
                blog_id: c.blog_id,
                user_id: c.user_id,
                parent_id: c.parent_id,
                content: displayContent,
                status: c.status,
                created_at: c.created_at,
                updated_at: c.updated_at,
                reply_count: c.reply_count || 0, // Note: This might include deleted replies
                upvotes: c.upvotes || 0,
                downvotes: c.downvotes || 0,
                is_flagged: c.is_flagged,
                profiles: displayProfile,
                replies: []
            };

            commentMap[c.id] = comment;
        });

        // Second pass: Link parents and children
        rawComments.forEach(c => {
            const comment = commentMap[c.id];
            if (c.parent_id && commentMap[c.parent_id]) {
                commentMap[c.parent_id].replies.push(comment);
            } else if (!c.parent_id) {
                allRootComments.push(comment);
            }
        });

        // Recursive pruning: Remove deleted comments that have no visible replies
        const pruneComments = (comments) => {
            return comments.filter(comment => {
                if (comment.replies.length > 0) {
                    comment.replies = pruneComments(comment.replies);
                }
                // Keep if active OR has visible replies remaining
                return comment.status === 'active' || comment.replies.length > 0;
            });
        };

        const prunedRoots = pruneComments(allRootComments);

        // Update total count after pruning (for accurate pagination)
        const rootCount = prunedRoots.length;

        // Determine sort function
        const getSortValue = (a) => {
            if (sortBy === 'oldest') return new Date(a.created_at).getTime();
            if (sortBy === 'most-replies') return a.replies.length; // Approximate using actual replies loaded
            // Default newest
            return -new Date(a.created_at).getTime();
        };

        const sortDir = sortBy === 'oldest' ? 1 : -1;

        // Sort roots
        prunedRoots.sort((a, b) => {
            if (sortBy === 'most-replies') return b.replies.length - a.replies.length;
            if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            return new Date(b.created_at) - new Date(a.created_at);
        });

        // Pagination
        const paginatedRoots = prunedRoots.slice(offset, offset + limit);

        logger.info({
            blogId,
            fetchedTotal: rawComments.length,
            rootCount: paginatedRoots.length,
            totalRootCount: rootCount
        }, 'Service: Threaded comments built successfully (In-Memory)');

        return {
            comments: paginatedRoots,
            pagination: {
                page,
                limit,
                total: rootCount,
                totalPages: Math.ceil(rootCount / limit)
            }
        };
    }

    /**
     * Create a new comment
     */
    async createComment(userId, blogId, content, parentId = null) {
        logger.info({ userId, blogId, parentId }, 'Service: Creating comment');

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
            .select('userId, CreatedAt')
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
        if (minutesSincePost > 60) {
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
            .select('userId, ReplyCount')
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
