-- Preserve moderation history even when comments are permanently deleted.
-- Keep a stable original comment id for lookups and avoid cascading deletes.

ALTER TABLE public.comment_moderation_log
ADD COLUMN IF NOT EXISTS original_comment_id UUID;

UPDATE public.comment_moderation_log
SET original_comment_id = comment_id
WHERE original_comment_id IS NULL;

ALTER TABLE public.comment_moderation_log
ALTER COLUMN original_comment_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_moderation_log_original_comment
ON public.comment_moderation_log(original_comment_id);

ALTER TABLE public.comment_moderation_log
ALTER COLUMN comment_id DROP NOT NULL;

ALTER TABLE public.comment_moderation_log
DROP CONSTRAINT IF EXISTS comment_moderation_log_comment_id_fkey;

ALTER TABLE public.comment_moderation_log
ADD CONSTRAINT comment_moderation_log_comment_id_fkey
FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION log_comment_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.comment_moderation_log (
        comment_id,
        original_comment_id,
        action,
        performed_by,
        metadata
    ) VALUES (
        NEW.id,
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

CREATE OR REPLACE FUNCTION log_comment_updates()
RETURNS TRIGGER AS $$
DECLARE
    performer_id UUID;
BEGIN
    IF OLD.content != NEW.content AND auth.uid() IS NOT NULL THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            original_comment_id,
            action,
            performed_by,
            metadata
        ) VALUES (
            NEW.id,
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

    IF OLD.status != NEW.status THEN
        performer_id := COALESCE(NEW.deleted_by, auth.uid());

        IF performer_id IS NOT NULL THEN
            INSERT INTO public.comment_moderation_log (
                comment_id,
                original_comment_id,
                action,
                performed_by,
                metadata
            ) VALUES (
                NEW.id,
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

    IF OLD.is_flagged = false AND NEW.is_flagged = true AND NEW.flagged_by IS NOT NULL THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            original_comment_id,
            action,
            performed_by,
            reason,
            metadata
        ) VALUES (
            NEW.id,
            NEW.id,
            'flagged',
            NEW.flagged_by,
            NEW.flag_reason,
            jsonb_build_object(
                'flag_count', NEW.flag_count
            )
        );
    ELSIF OLD.is_flagged = true AND NEW.is_flagged = false THEN
        IF auth.uid() IS NOT NULL THEN
            INSERT INTO public.comment_moderation_log (
                comment_id,
                original_comment_id,
                action,
                performed_by,
                metadata
            ) VALUES (
                NEW.id,
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

CREATE OR REPLACE FUNCTION log_comment_deletion()
RETURNS TRIGGER AS $$
DECLARE
    performer_id UUID;
BEGIN
    performer_id := auth.uid();

    IF performer_id IS NOT NULL THEN
        INSERT INTO public.comment_moderation_log (
            comment_id,
            original_comment_id,
            action,
            performed_by,
            metadata
        ) VALUES (
            OLD.id,
            OLD.id,
            'permanent_delete',
            performer_id,
            jsonb_build_object(
                'status', OLD.status,
                'was_flagged', OLD.is_flagged,
                'reply_count', OLD.reply_count
            )
        );
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
