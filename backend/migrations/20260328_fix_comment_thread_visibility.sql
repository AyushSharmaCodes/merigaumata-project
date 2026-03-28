-- Ensure public threaded comment reads preserve deleted placeholders when they
-- still anchor active replies, and keep the return column aliases consistent.

CREATE OR REPLACE FUNCTION get_threaded_comments(
    p_blog_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_sort_by TEXT DEFAULT 'newest'
)
RETURNS TABLE (
    id UUID,
    blog_id UUID,
    user_id UUID,
    parent_id UUID,
    content TEXT,
    status VARCHAR,
    is_flagged BOOLEAN,
    flag_reason TEXT,
    flag_count INTEGER,
    flagged_by UUID,
    flagged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    edit_count INTEGER,
    last_edited_at TIMESTAMP WITH TIME ZONE,
    reply_count INTEGER,
    upvotes INTEGER,
    downvotes INTEGER,
    user_name TEXT,
    user_avatar_url TEXT,
    user_role TEXT
) AS $$
DECLARE
    v_root_ids UUID[];
BEGIN
    SELECT ARRAY_AGG(root_cm.id) INTO v_root_ids
    FROM (
        SELECT cm.id
        FROM public.comments cm
        WHERE cm.blog_id = p_blog_id
        AND cm.parent_id IS NULL
        AND (
            cm.status = 'active'
            OR (cm.status = 'deleted' AND cm.reply_count > 0)
        )
        ORDER BY
            CASE WHEN p_sort_by = 'newest' THEN cm.created_at END DESC,
            CASE WHEN p_sort_by = 'oldest' THEN cm.created_at END ASC,
            CASE WHEN p_sort_by = 'most-replies' THEN cm.reply_count END DESC,
            cm.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) root_cm;

    IF v_root_ids IS NULL OR ARRAY_LENGTH(v_root_ids, 1) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH RECURSIVE comment_tree AS (
        SELECT
            c.id,
            c.blog_id,
            c.user_id,
            c.parent_id,
            c.content,
            c.status,
            c.is_flagged,
            c.flag_reason,
            c.flag_count,
            c.flagged_by,
            c.flagged_at,
            c.created_at,
            c.updated_at,
            c.deleted_at,
            c.deleted_by,
            c.edit_count,
            c.last_edited_at,
            c.reply_count,
            c.upvotes,
            c.downvotes,
            p.first_name AS user_name,
            p.avatar_url,
            COALESCE(r.name::TEXT, 'customer') AS role_name,
            1 AS depth
        FROM public.comments c
        LEFT JOIN public.profiles p ON c.user_id = p.id
        LEFT JOIN public.roles r ON p.role_id = r.id
        WHERE c.id = ANY(v_root_ids)

        UNION ALL

        SELECT
            c.id,
            c.blog_id,
            c.user_id,
            c.parent_id,
            c.content,
            c.status,
            c.is_flagged,
            c.flag_reason,
            c.flag_count,
            c.flagged_by,
            c.flagged_at,
            c.created_at,
            c.updated_at,
            c.deleted_at,
            c.deleted_by,
            c.edit_count,
            c.last_edited_at,
            c.reply_count,
            c.upvotes,
            c.downvotes,
            p.first_name AS user_name,
            p.avatar_url,
            COALESCE(r.name::TEXT, 'customer') AS role_name,
            ct.depth + 1
        FROM public.comments c
        LEFT JOIN public.profiles p ON c.user_id = p.id
        LEFT JOIN public.roles r ON p.role_id = r.id
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE c.status IN ('active', 'deleted')
        AND ct.depth < 10
    )
    SELECT
        ct.id, ct.blog_id, ct.user_id, ct.parent_id, ct.content, ct.status,
        ct.is_flagged, ct.flag_reason, ct.flag_count, ct.flagged_by, ct.flagged_at,
        ct.created_at, ct.updated_at, ct.deleted_at, ct.deleted_by, ct.edit_count,
        ct.last_edited_at, ct.reply_count, ct.upvotes, ct.downvotes,
        ct.user_name, ct.avatar_url AS user_avatar_url, ct.role_name AS user_role
    FROM comment_tree ct
    ORDER BY ct.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
