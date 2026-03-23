-- Fix all null auth.uid() issues in moderation logging trigger
-- This prevents "null value in performed_by" errors when actions are performed via backend

CREATE OR REPLACE FUNCTION log_comment_updates()
RETURNS TRIGGER AS $$
DECLARE
    performer_id UUID;
BEGIN
    -- Log content edits (only if auth.uid() is available)
    IF OLD.content != NEW.content AND auth.uid() IS NOT NULL THEN
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
    
    -- Log status changes (use deleted_by if available, otherwise skip if no performer)
    IF OLD.status != NEW.status THEN
        -- Determine who performed the action
        performer_id := COALESCE(NEW.deleted_by, auth.uid());
        
        -- Only log if we have a performer ID
        IF performer_id IS NOT NULL THEN
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
                performer_id,
                jsonb_build_object(
                    'old_status', OLD.status,
                    'new_status', NEW.status
                )
            );
        END IF;
    END IF;
    
    -- Log flagging (only if we have flagged_by)
    IF OLD.is_flagged = false AND NEW.is_flagged = true AND NEW.flagged_by IS NOT NULL THEN
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
        -- Skip automatic unflag logging (backend handles it manually with admin ID)
        -- Only log if auth.uid() is available
        IF auth.uid() IS NOT NULL THEN
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Run this SQL in your Supabase SQL Editor to fix all moderation logging issues
