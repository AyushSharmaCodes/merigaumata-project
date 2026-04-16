-- Insert manager role if it doesn't exist
INSERT INTO roles (name)
VALUES ('manager')
ON CONFLICT (name) DO NOTHING;

-- Create manager_permissions table
CREATE TABLE IF NOT EXISTS manager_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    
    -- Module permissions
    can_manage_products BOOLEAN DEFAULT false,
    can_manage_categories BOOLEAN DEFAULT false,
    can_manage_orders BOOLEAN DEFAULT false,
    can_manage_events BOOLEAN DEFAULT false,
    can_manage_blogs BOOLEAN DEFAULT false,
    can_manage_testimonials BOOLEAN DEFAULT false,
    can_manage_gallery BOOLEAN DEFAULT false,
    can_manage_faqs BOOLEAN DEFAULT false,
    can_manage_carousel BOOLEAN DEFAULT false,
    can_manage_contact_info BOOLEAN DEFAULT false,
    can_manage_social_media BOOLEAN DEFAULT false,
    can_manage_bank_details BOOLEAN DEFAULT false,
    can_manage_about_us BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE manager_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for manager_permissions
DROP POLICY IF EXISTS "Managers can view their own permissions" ON manager_permissions;
CREATE POLICY "Managers can view their own permissions" 
    ON manager_permissions FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all permissions" ON manager_permissions;
CREATE POLICY "Service role can manage all permissions" 
    ON manager_permissions FOR ALL 
    USING (true) WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_manager_permissions_user_id ON manager_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_manager_permissions_is_active ON manager_permissions(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_manager_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS manager_permissions_updated_at ON manager_permissions;
CREATE TRIGGER manager_permissions_updated_at 
    BEFORE UPDATE ON manager_permissions 
    FOR EACH ROW EXECUTE FUNCTION update_manager_permissions_updated_at();
