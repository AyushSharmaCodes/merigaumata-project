-- Create comment flags table for multi-user flagging
-- Allows multiple users to flag the same comment with different reasons

CREATE TABLE IF NOT EXISTS public.comment_flags (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign keys
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    flagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Flag details
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_reason CHECK (reason IN (
        'spam',
        'offensive',
        'harassment',
        'misinformation',
        'inappropriate',
        'copyright',
        'personal_info',
        'other'
    )),
    UNIQUE(comment_id, flagged_by) -- Each user can only flag a comment once
);

-- Create indexes
CREATE INDEX idx_comment_flags_comment ON public.comment_flags(comment_id);
CREATE INDEX idx_comment_flags_flagged_by ON public.comment_flags(flagged_by);
CREATE INDEX idx_comment_flags_created_at ON public.comment_flags(created_at DESC);
CREATE INDEX idx_comment_flags_reason ON public.comment_flags(reason);

-- Enable RLS
ALTER TABLE public.comment_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own flags
CREATE POLICY "Users can view their own flags"
ON public.comment_flags FOR SELECT
USING (auth.uid() = flagged_by);

-- Admins can view all flags
CREATE POLICY "Admins can view all flags"
ON public.comment_flags FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'manager')
    )
);

-- Authenticated users can create flags
CREATE POLICY "Authenticated users can create flags"
ON public.comment_flags FOR INSERT
WITH CHECK (
    auth.uid() = flagged_by
    AND auth.role() = 'authenticated'
);

-- No updates allowed on flags (immutable once created)
-- Users can delete their own flags (unflag)
CREATE POLICY "Users can delete their own flags"
ON public.comment_flags FOR DELETE
USING (auth.uid() = flagged_by);

-- Create function to update comment flag status when flags are added
CREATE OR REPLACE FUNCTION update_comment_flag_status()
RETURNS TRIGGER AS $$
DECLARE
    v_flag_count INTEGER;
    v_first_flag RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Count total flags for this comment
        SELECT COUNT(*) INTO v_flag_count
        FROM public.comment_flags
        WHERE comment_id = NEW.comment_id;
        
        -- Get the first flag for this comment
        SELECT * INTO v_first_flag
        FROM public.comment_flags
        WHERE comment_id = NEW.comment_id
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- Update comment's flag status
        UPDATE public.comments
        SET 
            is_flagged = true,
            flag_count = v_flag_count,
            flagged_by = v_first_flag.flagged_by,
            flagged_at = v_first_flag.created_at,
            flag_reason = v_first_flag.reason || CASE 
                WHEN v_flag_count > 1 THEN ' (+' || (v_flag_count - 1)::TEXT || ' more)'
                ELSE ''
            END
        WHERE id = NEW.comment_id;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Recount flags after deletion
        SELECT COUNT(*) INTO v_flag_count
        FROM public.comment_flags
        WHERE comment_id = OLD.comment_id;
        
        IF v_flag_count = 0 THEN
            -- No more flags, unflag the comment
            UPDATE public.comments
            SET 
                is_flagged = false,
                flag_count = 0,
                flagged_by = NULL,
                flagged_at = NULL,
                flag_reason = NULL
            WHERE id = OLD.comment_id;
        ELSE
            -- Update count and first flag info
            SELECT * INTO v_first_flag
            FROM public.comment_flags
            WHERE comment_id = OLD.comment_id
            ORDER BY created_at ASC
            LIMIT 1;
            
            UPDATE public.comments
            SET 
                flag_count = v_flag_count,
                flagged_by = v_first_flag.flagged_by,
                flagged_at = v_first_flag.created_at,
                flag_reason = v_first_flag.reason || CASE 
                    WHEN v_flag_count > 1 THEN ' (+' || (v_flag_count - 1)::TEXT || ' more)'
                    ELSE ''
                END
            WHERE id = OLD.comment_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_comment_flag_status_trigger
    AFTER INSERT OR DELETE ON public.comment_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_flag_status();

-- Add helpful comments
COMMENT ON TABLE public.comment_flags IS 'Individual flags from users for inappropriate comments (allows multiple users to flag same comment)';
COMMENT ON COLUMN public.comment_flags.reason IS 'Predefined reason category for the flag';
COMMENT ON COLUMN public.comment_flags.details IS 'Optional additional context provided by the flagger';
COMMENT ON CONSTRAINT comment_flags_comment_id_flagged_by_key ON public.comment_flags IS 'Ensures each user can only flag a comment once';
