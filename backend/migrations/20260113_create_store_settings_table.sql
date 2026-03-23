-- Create store_settings table for dynamic configuration
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed delivery settings
INSERT INTO store_settings (key, value, description)
VALUES 
    ('delivery_threshold', '1500', 'Minimum order amount for free delivery'),
    ('delivery_charge', '50', 'Standard delivery charge for orders below threshold')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of delivery settings
CREATE POLICY "Public can view delivery settings" ON store_settings
    FOR SELECT
    USING (key IN ('delivery_threshold', 'delivery_charge'));

-- Allow admin/service_role to manage all settings
CREATE POLICY "Service role can manage all settings" ON store_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER store_settings_updated_at
    BEFORE UPDATE ON store_settings
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();
