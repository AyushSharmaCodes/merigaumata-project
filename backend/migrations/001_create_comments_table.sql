-- Backup existing table and create new production-grade comments table
-- This migration creates a fresh schema for the comment system

-- Step 1: Backup existing table (keep data safe)
ALTER TABLE IF EXISTS public.blog_comments RENAME TO blog_comments_backup;

-- Step 2: Create new comments table with comprehensive schema
CREATE TABLE IF NOT EXISTS public.comments (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign keys
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    
    -- Status management
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    
    -- Flagging system
    is_flagged BOOLEAN DEFAULT false NOT NULL,
    flag_reason TEXT,
    flag_count INTEGER DEFAULT 0 NOT NULL,
    flagged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    flagged_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit trail
    deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    edit_count INTEGER DEFAULT 0 NOT NULL,
    last_edited_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata for optimization
    reply_count INTEGER DEFAULT 0 NOT NULL,
    upvotes INTEGER DEFAULT 0 NOT NULL,
    downvotes INTEGER DEFAULT 0 NOT NULL,
    
    -- Constraints
    CONSTRAINT content_length CHECK (char_length(content) >= 2 AND char_length(content) <= 2000),
    CONSTRAINT valid_status CHECK (status IN ('active', 'hidden', 'deleted')),
    CONSTRAINT valid_flag_count CHECK (flag_count >= 0),
    CONSTRAINT valid_reply_count CHECK (reply_count >= 0),
    CONSTRAINT valid_votes CHECK (upvotes >= 0 AND downvotes >= 0)
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_comments_blog_id ON public.comments(blog_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_status ON public.comments(status) WHERE status != 'active';
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX idx_comments_flagged ON public.comments(is_flagged, flag_count) WHERE is_flagged = true;
CREATE INDEX idx_comments_deleted ON public.comments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Step 4: Enable Row Level Security
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS Policies

-- Public can view active comments
CREATE POLICY "Anyone can view active comments"
ON public.comments FOR SELECT
USING (status = 'active');

-- Admins and managers can view all comments (including hidden/deleted)
CREATE POLICY "Admins can view all comments"
ON public.comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'manager')
    )
);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
ON public.comments FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND auth.role() = 'authenticated'
    AND status = 'active'
);

-- Users can update their own comments (within constraints handled by backend)
CREATE POLICY "Users can update their own comments"
ON public.comments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can update any comment
CREATE POLICY "Admins can update any comment"
ON public.comments FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'manager')
    )
);

-- Users can delete their own comments (soft delete via backend)
CREATE POLICY "Users can delete their own comments"
ON public.comments FOR DELETE
USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
ON public.comments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'manager')
    )
);

-- Step 6: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_updated_at_trigger
    BEFORE UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comments_updated_at();

-- Step 7: Create function to auto-update reply_count
CREATE OR REPLACE FUNCTION update_parent_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        -- Increment parent's reply count
        UPDATE public.comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        -- Decrement parent's reply count
        UPDATE public.comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        -- Handle parent change (rare, but possible)
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = GREATEST(0, reply_count - 1)
            WHERE id = OLD.parent_id;
        END IF;
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reply_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_reply_count();

-- Step 8: Add helpful comments for documentation
COMMENT ON TABLE public.comments IS 'Production comment system with soft-delete, moderation, and threading';
COMMENT ON COLUMN public.comments.status IS 'Comment visibility: active (public), hidden (admin only), deleted (soft-deleted)';
COMMENT ON COLUMN public.comments.flag_count IS 'Number of times this comment has been flagged by different users';
COMMENT ON COLUMN public.comments.reply_count IS 'Auto-calculated count of direct replies to this comment';
COMMENT ON COLUMN public.comments.edit_count IS 'Number of times this comment has been edited';
