export interface UserProfile {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string; // keeping for backward compatibility if used elsewhere
    avatar_url?: string;
    role?: 'user' | 'admin' | 'manager';
}

export interface Comment {
    id: string;
    blog_id: string;
    user_id: string;
    parent_id: string | null;
    content: string;
    status: 'active' | 'hidden' | 'deleted';
    is_flagged: boolean;
    flag_reason?: string;
    flag_count: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    reply_count: number;
    edit_count: number;

    // Relations
    profiles?: UserProfile;
    replies?: Comment[]; // For nested structure
}

export interface CommentListResponse {
    comments: Comment[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface CreateCommentPayload {
    blogId: string;
    content: string;
    parentId?: string;
}

export interface UpdateCommentPayload {
    content: string;
}

export interface FlagCommentPayload {
    reason: string;
    details?: string;
}

export interface ModerationLog {
    id: string;
    comment_id: string;
    action: 'created' | 'edited' | 'deleted' | 'restored' | 'flagged' | 'unflagged' | 'hidden' | 'approved' | 'permanent_delete';
    performed_by: string;
    reason?: string;
    metadata: Record<string, unknown>;
    created_at: string;
    performer?: UserProfile;
}
