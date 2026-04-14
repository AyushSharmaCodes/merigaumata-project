-- Migration: Auth and Email Hardening
-- Created: 2026-04-13
-- Description: Adds priority to email logs, leeway support to refresh tokens, and retention logic.

BEGIN;

-- 1. Add priority to email_notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_notifications' AND column_name = 'priority'
    ) THEN
        ALTER TABLE public.email_notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'NORMAL';
        COMMENT ON COLUMN public.email_notifications.priority IS 'Priority of the email (HIGH, NORMAL). High priority emails may be retried more aggressively.';
    END IF;
END $$;

-- 2. Add rotated_at to app_refresh_tokens for grace period support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_refresh_tokens' AND column_name = 'rotated_at'
    ) THEN
        ALTER TABLE public.app_refresh_tokens ADD COLUMN rotated_at TIMESTAMPTZ;
        COMMENT ON COLUMN public.app_refresh_tokens.rotated_at IS 'Timestamp when this token was rotated. Used for the 60-second grace period.';
    END IF;
END $$;

-- 3. Cleanup logic for old email logs (30 days retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_email_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.email_notifications
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Cleanup logic for expired refresh tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
    -- Delete tokens that are expired OR rotated tokens that have exceeded their grace period (60s)
    DELETE FROM public.app_refresh_tokens
    WHERE expires_at < NOW()
       OR (rotated_at IS NOT NULL AND rotated_at < NOW() - INTERVAL '60 seconds');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic metadata merge for email notifications
CREATE OR REPLACE FUNCTION public.merge_email_notification_metadata(
    p_log_id UUID,
    p_updates JSONB,
    p_metadata_updates JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
    UPDATE public.email_notifications
    SET 
        status = COALESCE((p_updates->>'status'), status),
        retry_count = COALESCE((p_updates->>'retry_count')::INTEGER, retry_count),
        user_id = COALESCE((p_updates->>'user_id')::UUID, user_id),
        metadata = metadata || COALESCE(p_metadata_updates, '{}'::jsonb),
        updated_at = NOW()
    WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Updated log_email_notification with priority support
CREATE OR REPLACE FUNCTION public.log_email_notification(
    p_email_type email_notification_type,
    p_recipient_email TEXT,
    p_subject TEXT,
    p_html_preview TEXT,
    p_user_id UUID DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_priority VARCHAR(20) DEFAULT 'NORMAL'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_combined_metadata JSONB;
BEGIN
    v_combined_metadata := p_metadata || jsonb_build_object(
        'subject', p_subject,
        'html_preview', p_html_preview
    );

    INSERT INTO public.email_notifications (
        user_id,
        email_type,
        recipient_email,
        reference_id,
        status,
        metadata,
        priority
    ) VALUES (
        p_user_id,
        p_email_type,
        p_recipient_email,
        p_reference_id,
        'PENDING',
        v_combined_metadata,
        COALESCE(p_priority, 'NORMAL')
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
