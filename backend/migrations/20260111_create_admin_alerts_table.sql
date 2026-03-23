-- Migration: Create admin_alerts table for persistent dashboard notifications
-- This table stores alerts that need to be manually dismissed by admins

CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'contact_message', 'order', 'event_registration', etc.
    reference_id TEXT, -- ID of the related object
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON public.admin_alerts(status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON public.admin_alerts(type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON public.admin_alerts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins and Managers can view alerts
CREATE POLICY "Admins and managers can view alerts" ON public.admin_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid()
            AND roles.name IN ('admin', 'manager')
        )
    );

-- Admins and Managers can update alerts (e.g., mark as read)
CREATE POLICY "Admins and managers can update alerts" ON public.admin_alerts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid()
            AND roles.name IN ('admin', 'manager')
        )
    );

-- System/Service Role can insert alerts
CREATE POLICY "Service role can insert alerts" ON public.admin_alerts
    FOR INSERT
    WITH CHECK (true);

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON public.admin_alerts TO authenticated, service_role;
