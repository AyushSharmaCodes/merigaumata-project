-- Create updated_at function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create policy_pages table
CREATE TABLE IF NOT EXISTS public.policy_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_type TEXT NOT NULL CHECK (policy_type IN ('privacy', 'terms', 'shipping', 'refund')),
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx')),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups by policy info
CREATE INDEX IF NOT EXISTS idx_policy_pages_type_active ON public.policy_pages(policy_type, is_active);

-- Handle updated_at trigger
DROP TRIGGER IF EXISTS update_policy_pages_updated_at ON public.policy_pages;
CREATE TRIGGER update_policy_pages_updated_at
    BEFORE UPDATE ON public.policy_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.policy_pages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin/Manager can do everything
DROP POLICY IF EXISTS "Admin can manage policies" ON public.policy_pages;
CREATE POLICY "Admin can manage policies" ON public.policy_pages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            JOIN public.roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid()
            AND roles.name IN ('admin', 'manager')
        )
    );

-- Public can read active policies
DROP POLICY IF EXISTS "Public can read active policies" ON public.policy_pages;
CREATE POLICY "Public can read active policies" ON public.policy_pages
    FOR SELECT
    USING (is_active = true);
