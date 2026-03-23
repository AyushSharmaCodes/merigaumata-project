-- Securely log email notifications via RPC
-- This allows the backend (even with anon key if RLS is strict) or unauthenticated users (if granted) to log emails
-- without exposing the table to direct inserts.

-- 1. Create the RPC function
CREATE OR REPLACE FUNCTION log_email_notification(
    p_email_type email_notification_type,
    p_recipient_email TEXT,
    p_subject TEXT,
    p_html_preview TEXT,
    p_user_id UUID DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
SET search_path = public -- Secure search_path
AS $$
DECLARE
    v_id UUID;
    v_combined_metadata JSONB;
BEGIN
    -- Combine metadata
    v_combined_metadata := p_metadata || jsonb_build_object(
        'subject', p_subject,
        'html_preview', p_html_preview
    );

    INSERT INTO email_notifications (
        user_id,
        email_type,
        recipient_email,
        reference_id,
        status,
        metadata
    ) VALUES (
        p_user_id,
        p_email_type,
        p_recipient_email,
        p_reference_id,
        'LOGGED',
        v_combined_metadata
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- 2. Grant execute permission to anon and authenticated roles
-- This is safe because the function is controlled and only inserts logs
GRANT EXECUTE ON FUNCTION log_email_notification TO anon, authenticated, service_role;
