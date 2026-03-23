const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class ModerationService {
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
        if (status) {
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
            .select('flagReason, FlagCount')
            .eq('id', commentId)
            .single();

        // Manually log the unflagging action with admin ID
        // (This prevents the trigger from failing with null auth.uid())
        await supabase
            .from('comment_moderation_log')
            .insert({
                comment_id: commentId,
                action: 'unflagged',
                performed_by: adminId,
                metadata: {
                    previous_flag_reason: currentComment?.flag_reason,
                    previous_flag_count: currentComment?.flag_count || 0
                }
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
            return updatedData;
        }

        return data;
    }

    /**
     * Hide a comment (soft delete / hide from public)
     */
    async hideComment(commentId, adminId) {
        const { data, error } = await supabase
            .from('comments')
            .update({
                status: 'hidden'
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Restore a hidden/deleted comment
     */
    async restoreComment(commentId, adminId) {
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
        return data;
    }

    /**
     * Permanently delete a comment
     */
    async deleteCommentPermanently(commentId, adminId) {
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
        performer:performed_by (id, first_name, last_name, role)
      `)
            .eq('comment_id', commentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}

module.exports = new ModerationService();
