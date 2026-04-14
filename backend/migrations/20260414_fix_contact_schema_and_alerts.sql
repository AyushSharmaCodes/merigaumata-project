-- Add phone number to contact_messages
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop the incorrectly defined admin_alerts table and recreate it correctly
DROP TABLE IF EXISTS public.admin_alerts CASCADE;

CREATE TABLE public.admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    reference_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Re-apply policies for admin_alerts

-- 1. Admins and managers can view alerts
CREATE POLICY "Admins and managers can view alerts" ON public.admin_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

-- 2. Admins and managers can update alerts (e.g., mark as read)
CREATE POLICY "Admins and managers can update alerts" ON public.admin_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

-- 3. Admins and managers can delete alerts
CREATE POLICY "Admins and managers can delete alerts" ON public.admin_alerts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

-- 4. Service role (backend) can insert alerts
CREATE POLICY "Service role can insert alerts" ON public.admin_alerts
    FOR INSERT WITH CHECK (true);

-- Enable RLS
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
