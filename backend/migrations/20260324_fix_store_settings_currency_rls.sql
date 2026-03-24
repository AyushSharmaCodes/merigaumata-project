INSERT INTO store_settings (key, value, description)
VALUES ('base_currency', '"INR"', 'Default display currency for the storefront')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage store settings" ON store_settings;
CREATE POLICY "Admins manage store settings" ON store_settings
    FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS "Service role can manage all settings" ON store_settings;
CREATE POLICY "Service role can manage all settings" ON store_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
