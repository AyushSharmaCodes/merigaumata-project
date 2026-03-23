-- ==========================================================
-- CONSOLIDATED MIGRATION: CONTACT US & ADMIN ALERTS
-- ==========================================================

-- 1. UPDATE EMAIL TYPES ENUM
-- Add new email types to the existing enum if they don't exist
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'CONTACT_NOTIFICATION';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'CONTACT_AUTO_REPLY';

-- 2. CREATE CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'REPLIED', 'ARCHIVED')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE ADMIN ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'contact_message', 'order', etc.
    reference_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE RLS & SET POLICIES
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Contact Messages Policies
DROP POLICY IF EXISTS "Enable public insert for contact messages" ON public.contact_messages;
CREATE POLICY "Enable public insert for contact messages" ON public.contact_messages 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;
CREATE POLICY "Admins can view contact messages" ON public.contact_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

-- Admin Alerts Policies
DROP POLICY IF EXISTS "Admins and managers can view alerts" ON public.admin_alerts;
CREATE POLICY "Admins and managers can view alerts" ON public.admin_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Admins and managers can update alerts" ON public.admin_alerts;
CREATE POLICY "Admins and managers can update alerts" ON public.admin_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Service role can insert alerts" ON public.admin_alerts;
CREATE POLICY "Service role can insert alerts" ON public.admin_alerts 
    FOR INSERT WITH CHECK (true);

-- 5. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE ON public.contact_messages TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE ON public.admin_alerts TO authenticated, service_role;
