import { apiClient } from "@/core/api/api-client";
import {
    Comment,
    CommentListResponse,
    CreateCommentPayload,
    UpdateCommentPayload,
    FlagCommentPayload,
    ModerationLog
} from "@/domains/content/model/comment.types";

class CommentService {
    private baseUrl = "/comments";

    /**
     * Get comments for a blog post
     */
    async getComments(blogId: string, page = 1, limit = 20, sortBy = 'newest'): Promise<CommentListResponse> {
        const response = await apiClient.get(`${this.baseUrl}/${blogId}`, {
            params: { page, limit, sortBy }
        });
        return response.data;
    }

    /**
     * Create a new comment
     */
    async createComment(payload: CreateCommentPayload): Promise<Comment> {
        const response = await apiClient.post(this.baseUrl, payload);
        return response.data;
    }

    /**
     * Update a comment
     */
    async updateComment(id: string, payload: UpdateCommentPayload): Promise<Comment> {
        const response = await apiClient.put(`${this.baseUrl}/${id}`, payload);
        return response.data;
    }

    /**
     * Delete a comment (soft delete)
     */
    async deleteComment(id: string): Promise<{ message: string; comment: Comment }> {
        const response = await apiClient.delete(`${this.baseUrl}/${id}`);
        return response.data;
    }

    /**
     * Flag a comment
     */
    async flagComment(id: string, payload: FlagCommentPayload): Promise<{ message: string; flag: Record<string, unknown> }> {
        const response = await apiClient.post(`${this.baseUrl}/${id}/flag`, payload);
        return response.data;
    }

    // --- Admin Methods ---

    /**
     * Get flagged comments (Admin)
     */
    async getFlaggedComments(page = 1, limit = 20, status?: string): Promise<CommentListResponse> {
        const response = await apiClient.get(`${this.baseUrl}/admin/flagged`, {
            params: { page, limit, status }
        });
        return response.data;
    }

    /**
     * Approve a comment (Admin)
     */
    async approveComment(id: string): Promise<{ message: string; comment: Comment }> {
        const response = await apiClient.post(`${this.baseUrl}/${id}/approve`);
        return response.data;
    }

    /**
     * Hide a comment (Admin)
     */
    async hideComment(id: string): Promise<{ message: string; comment: Comment }> {
        const response = await apiClient.post(`${this.baseUrl}/${id}/hide`);
        return response.data;
    }

    /**
     * Restore a comment (Admin)
     */
    async restoreComment(id: string): Promise<{ message: string; comment: Comment }> {
        const response = await apiClient.post(`${this.baseUrl}/${id}/restore`);
        return response.data;
    }

    /**
     * Permanently delete a comment (Admin)
     */
    async deleteCommentPermanently(id: string): Promise<{ message: string }> {
        const response = await apiClient.delete(`${this.baseUrl}/${id}/permanent`);
        return response.data;
    }

    /**
     * Get moderation history (Admin)
     */
    async getModerationHistory(id: string): Promise<ModerationLog[]> {
        const response = await apiClient.get(`${this.baseUrl}/${id}/history`);
        return response.data;
    }
}

export const commentService = new CommentService();
