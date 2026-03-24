const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class ModerationService {
    async logModerationAction(commentId, action, adminId, metadata = {}, reason = null) {
        const payload = {
            comment_id: commentId,
            original_comment_id: commentId,
            action,
            performed_by: adminId,
            metadata
        };

        if (reason) {
            payload.reason = reason;
        }

        const { error } = await supabase
            .from('comment_moderation_log')
            .insert(payload);

        if (error) {
            logger.error({ err: error, commentId, action, adminId }, 'Failed to write moderation log entry');
            throw error;
        }
    }

    mapHistoryLogs(history) {
        return (history || []).map((log) => ({
            ...log,
            performer: log.performer
                ? {
                    ...log.performer,
                    role: log.performer.role || log.performer.roles?.name || null
                }
                : log.performer
        }));
    }

    /**
     * Get all flagged comments for moderation
     */
    async getFlaggedComments(page = 1, limit = 20, status = 'active') {
        const offset = (page - 1) * limit;

        let query = supabase
            .from('comments')
            .select(`
        *,
        profiles:user_id (id, first_name, last_name, email, avatar_url),
        flags:comment_flags (
          id,
          reason,
          details,
          created_at,
          flagger:flagged_by (id, first_name, last_name)
        )
      `, { count: 'exact' })
            .eq('is_flagged', true)
            .order('flag_count', { ascending: false })
            .order('created_at', { ascending: false });

        // Filter by status if provided
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
            comments: data,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Approve a flagged comment (clear flags)
     */
    async approveComment(commentId, adminId) {
        // First, get the current comment state for logging
        const { data: currentComment } = await supabase
            .from('comments')
            .select('flag_reason, flag_count, status')
            .eq('id', commentId)
            .single();

        // Manually log the unflagging action with admin ID
        // (This prevents the trigger from failing with null auth.uid())
        await this.logModerationAction(commentId, 'unflagged', adminId, {
            previous_flag_reason: currentComment?.flag_reason,
            previous_flag_count: currentComment?.flag_count || 0
        });

        // Delete all flag records for this comment
        // The trigger will automatically clear the flag data in comments table
        await supabase
            .from('comment_flags')
            .delete()
            .eq('comment_id', commentId);

        // Get the updated comment to return
        const { data, error } = await supabase
            .from('comments')
            .select()
            .eq('id', commentId)
            .single();

        if (error) throw error;

        // Ensure the comment is active (in case it was hidden)
        if (data.status !== 'active') {
            const { data: updatedData, error: updateError } = await supabase
                .from('comments')
                .update({ status: 'active' })
                .eq('id', commentId)
                .select()
                .single();

            if (updateError) throw updateError;

            const action = currentComment?.status === 'deleted' ? 'restored' : 'approved';
            await this.logModerationAction(commentId, action, adminId, {
                old_status: currentComment?.status || data.status,
                new_status: 'active'
            });

            return updatedData;
        }

        return data;
    }

    /**
     * Hide a comment (soft delete / hide from public)
     */
    async hideComment(commentId, adminId) {
        const { data: currentComment, error: fetchError } = await supabase
            .from('comments')
            .select('status')
            .eq('id', commentId)
            .single();

        if (fetchError) throw fetchError;

        const { data, error } = await supabase
            .from('comments')
            .update({
                status: 'hidden'
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) throw error;

        if (currentComment?.status !== 'hidden') {
            await this.logModerationAction(commentId, 'hidden', adminId, {
                old_status: currentComment?.status || null,
                new_status: 'hidden'
            });
        }

        return data;
    }

    /**
     * Restore a hidden/deleted comment
     */
    async restoreComment(commentId, adminId) {
        const { data: currentComment, error: fetchError } = await supabase
            .from('comments')
            .select('status')
            .eq('id', commentId)
            .single();

        if (fetchError) throw fetchError;

        const { data, error } = await supabase
            .from('comments')
            .update({
                status: 'active',
                deleted_at: null,
                deleted_by: null
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) throw error;

        if (currentComment?.status && currentComment.status !== 'active') {
            const action = currentComment.status === 'deleted' ? 'restored' : 'approved';
            await this.logModerationAction(commentId, action, adminId, {
                old_status: currentComment.status,
                new_status: 'active'
            });
        }

        return data;
    }

    /**
     * Permanently delete a comment
     */
    async deleteCommentPermanently(commentId, adminId) {
        const { data: currentComment, error: fetchError } = await supabase
            .from('comments')
            .select('status, is_flagged, reply_count')
            .eq('id', commentId)
            .single();

        if (fetchError) throw fetchError;

        await this.logModerationAction(commentId, 'permanent_delete', adminId, {
            status: currentComment?.status || null,
            was_flagged: currentComment?.is_flagged || false,
            reply_count: currentComment?.reply_count || 0
        });

        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;
        return { success: true, id: commentId };
    }

    /**
     * Get moderation history for a comment
     */
    async getModerationHistory(commentId) {
        const { data, error } = await supabase
            .from('comment_moderation_log')
            .select(`
        *,
        performer:performed_by (id, first_name, last_name, roles ( name ))
      `)
            .eq('original_comment_id', commentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return this.mapHistoryLogs(data);
    }
}

module.exports = new ModerationService();
