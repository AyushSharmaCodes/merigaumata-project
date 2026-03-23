-- Create moderation log table to track all moderation actions
-- This provides an immutable audit trail for compliance and debugging

CREATE TABLE IF NOT EXISTS public.comment_moderation_log (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign keys
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(50) NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_action CHECK (action IN (
        'created',
        'edited',
        'deleted',
        'restored',
        'flagged',
        'unflagged',
        'hidden',
        'approved',
        'permanent_delete'
    ))
);

-- Create indexes
CREATE INDEX idx_moderation_log_comment ON public.comment_moderation_log(comment_id);
CREATE INDEX idx_moderation_log_performed_by ON public.comment_moderation_log(performed_by);
CREATE INDEX idx_moderation_log_created_at ON public.comment_moderation_log(created_at DESC);
CREATE INDEX idx_moderation_log_action ON public.comment_moderation_log(action);

-- Enable RLS
ALTER TABLE public.comment_moderation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins and managers can view moderation logs
CREATE POLICY "Admins can view moderation logs"
ON public.comment_moderation_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'manager')
    )
);

-- Only system/admins can insert moderation logs
CREATE POLICY "System can insert moderation logs"
ON public.comment_moderation_log FOR INSERT
WITH CHECK (true); -- Actual permission check handled by backend

-- No updates or deletes allowed (immutable audit trail)

-- Create function to automatically log comment creation
CREATE OR REPLACE FUNCTION log_comment_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.comment_moderation_log (
        comment_id,
        action,
        performed_by,
        metadata
    ) VALUES (
        NEW.id,
        'created',
        NEW.user_id,
        jsonb_build_object(
            'blog_id', NEW.blog_id,
            'parent_id', NEW.parent_id,
            'content_length', char_length(NEW.content)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_comment_creation_trigger
    AFTER INSERT ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION log_comment_creation();

-- Create function to automatically log comment updates
CREATE OR REPLACE FUNCTION log_comment_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Log content edits
    IF OLD.content != NEW.content THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            action,
            performed_by,
            metadata
        ) VALUES (
            NEW.id,
            'edited',
            auth.uid(),
            jsonb_build_object(
                'old_content_length', char_length(OLD.content),
                'new_content_length', char_length(NEW.content),
                'edit_count', NEW.edit_count
            )
        );
    END IF;
    
    -- Log status changes
    IF OLD.status != NEW.status THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            action,
            performed_by,
            metadata
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.status = 'hidden' THEN 'hidden'
                WHEN NEW.status = 'deleted' THEN 'deleted'
                WHEN NEW.status = 'active' AND OLD.status = 'deleted' THEN 'restored'
                WHEN NEW.status = 'active' AND OLD.status = 'hidden' THEN 'approved'
                ELSE 'updated'
            END,
            COALESCE(NEW.deleted_by, auth.uid()),
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    
    -- Log flagging changes
    IF OLD.is_flagged = false AND NEW.is_flagged = true THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            action,
            performed_by,
            reason,
            metadata
        ) VALUES (
            NEW.id,
            'flagged',
            NEW.flagged_by,
            NEW.flag_reason,
            jsonb_build_object(
                'flag_count', NEW.flag_count
            )
        );
    ELSIF OLD.is_flagged = true AND NEW.is_flagged = false THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            action,
            performed_by,
            metadata
        ) VALUES (
            NEW.id,
            'unflagged',
            auth.uid(),
            jsonb_build_object(
                'previous_flag_reason', OLD.flag_reason,
                'previous_flag_count', OLD.flag_count
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_comment_updates_trigger
    AFTER UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION log_comment_updates();

-- Create function to log permanent deletions
CREATE OR REPLACE FUNCTION log_comment_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.comment_moderation_log (
        comment_id,
        action,
        performed_by,
        metadata
    ) VALUES (
        OLD.id,
        'permanent_delete',
        auth.uid(),
        jsonb_build_object(
            'status', OLD.status,
            'was_flagged', OLD.is_flagged,
            'reply_count', OLD.reply_count
        )
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_comment_deletion_trigger
    BEFORE DELETE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION log_comment_deletion();

-- Add helpful comments
COMMENT ON TABLE public.comment_moderation_log IS 'Immutable audit trail of all comment moderation actions';
COMMENT ON COLUMN public.comment_moderation_log.action IS 'Type of moderation action performed';
COMMENT ON COLUMN public.comment_moderation_log.metadata IS 'Additional context stored as JSON (previous values, counts, etc.)';
COMMENT ON COLUMN public.comment_moderation_log.reason IS 'User-provided reason for the moderation action';
