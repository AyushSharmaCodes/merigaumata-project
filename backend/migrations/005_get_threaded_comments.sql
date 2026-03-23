-- Function to fetch threaded comments with pagination for root comments
-- Returns a flat list of comments that includes root comments (paginated) 
-- and all their descendants (recursively)

-- Drop the function first because we changed the return type (first_name/last_name -> name)
DROP FUNCTION IF EXISTS get_threaded_comments(UUID, INTEGER, INTEGER, TEXT);

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
    -- 1. Get IDs of root comments for the requested page
    -- Optimize by using a direct index scan on blog_id, parent_id, and status
    SELECT ARRAY_AGG(root_cm.id) INTO v_root_ids
    FROM (
        SELECT cm.id
        FROM public.comments cm
        WHERE cm.blog_id = p_blog_id
        AND cm.parent_id IS NULL
        AND cm.status = 'active'
        ORDER BY 
            CASE WHEN p_sort_by = 'newest' THEN cm.created_at END DESC,
            CASE WHEN p_sort_by = 'oldest' THEN cm.created_at END ASC,
            CASE WHEN p_sort_by = 'most-replies' THEN cm.reply_count END DESC,
            cm.created_at DESC -- Stable fallback
        LIMIT p_limit
        OFFSET p_offset
    ) root_cm;

    -- Handle case where no root comments found
    IF v_root_ids IS NULL OR ARRAY_LENGTH(v_root_ids, 1) = 0 THEN
        RETURN;
    END IF;

    -- 2. Return root comments AND their descendants using recursive CTE
    -- Added depth limit (max 10 levels) for safety and performance
    RETURN QUERY
    WITH RECURSIVE comment_tree AS (
        -- Base case: Root comments
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
            p.first_name as user_name,
            p.avatar_url,
            COALESCE(r.name::TEXT, 'customer') as role_name,
            1 as depth
        FROM public.comments c
        LEFT JOIN public.profiles p ON c.user_id = p.id
        LEFT JOIN public.roles r ON p.role_id = r.id
        WHERE c.id = ANY(v_root_ids)
        
        UNION ALL
        
        -- Recursive step: Descendants
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
            p.first_name as user_name,
            p.avatar_url,
            COALESCE(r.name::TEXT, 'customer') as role_name,
            ct.depth + 1
        FROM public.comments c
        LEFT JOIN public.profiles p ON c.user_id = p.id
        LEFT JOIN public.roles r ON p.role_id = r.id
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE c.status = 'active'
        AND ct.depth < 10 -- Safety limit
    )
    SELECT 
        ct.id, ct.blog_id, ct.user_id, ct.parent_id, ct.content, ct.status, 
        ct.is_flagged, ct.flag_reason, ct.flag_count, ct.flagged_by, ct.flagged_at, 
        ct.created_at, ct.updated_at, ct.deleted_at, ct.deleted_by, ct.edit_count, 
        ct.last_edited_at, ct.reply_count, ct.upvotes, ct.downvotes, 
        ct.user_name, ct.user_avatar_url, ct.user_role
    FROM (
        -- Select all but excluding depth for the final return
        SELECT 
            t.id, t.blog_id, t.user_id, t.parent_id, t.content, t.status, 
            t.is_flagged, t.flag_reason, t.flag_count, t.flagged_by, t.flagged_at, 
            t.created_at, t.updated_at, t.deleted_at, t.deleted_by, t.edit_count, 
            t.last_edited_at, t.reply_count, t.upvotes, t.downvotes, 
            t.user_name, t.user_avatar_url, t.role_name as user_role
        FROM comment_tree t
    ) ct
    ORDER BY ct.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION get_threaded_comments IS 'Fetches paginated root comments and all their descendants for a blog post';

-- Grant execute permission to authenticated users and anon (for public blogs)
GRANT EXECUTE ON FUNCTION get_threaded_comments(UUID, INTEGER, INTEGER, TEXT) TO authenticated, anon;
