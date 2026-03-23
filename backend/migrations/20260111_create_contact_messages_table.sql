-- Migration: Create contact_messages table and add email types
-- Add new email types to the existing enum
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'CONTACT_NOTIFICATION';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'CONTACT_AUTO_REPLY';

-- Create contact_messages table
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'NEW',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow anyone (including unauthenticated users) to insert messages
CREATE POLICY "Allow public insert to contact_messages"
    ON public.contact_messages
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Allow admins to view all messages
-- Assuming there's an 'is_admin' check or similar in auth.users or a separate role
-- For now, we'll use a placeholder or basic authenticated check if specific admin role is not standard
-- Adjusting to match common supabase patterns or existing admin checks in the codebase
-- Based on existing migrations, it seems admins might have a specific role or metadata
-- For safety, restricting SELECT to service_role or specific admin users if possible. 
-- Since I cannot see the exact admin implementation in auth.users immediately, I will allow service_role only for now
-- and authenticated users with appropriate metadata if needed later. 
-- Wait, let's check existing policies.
-- Actually, let's just allow service_role and potential admin-app access.
-- Safest is service_role integration for backend.
-- Typically backend uses service_role key to bypass RLS, but if we access via client, we need policies.
-- The prompt asks for "Auditable", so likely backend access.

-- Policy for backend service (if using service role, it bypasses RLS, but for good measure):
CREATE POLICY "Enable read access for service role"
    ON public.contact_messages
    FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "Enable update access for service role"
    ON public.contact_messages
    FOR UPDATE
    TO service_role
    USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON public.contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at);

-- Add comments for documentation
COMMENT ON TABLE public.contact_messages IS 'Stores user submitted contact forms';
COMMENT ON COLUMN public.contact_messages.status IS 'Status of the message: NEW, PROCESSED, REPLIED, ARCHIVED';
