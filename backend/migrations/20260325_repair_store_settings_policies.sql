ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO store_settings (key, value, description)
VALUES
    ('delivery_threshold', '1500', 'Minimum order amount for free delivery'),
    ('delivery_charge', '50', 'Standard delivery charge for orders below threshold'),
    ('delivery_gst', '0', 'Standard GST rate for delivery charges'),
    ('base_currency', '"INR"', 'Default display currency for the storefront')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Public can view delivery settings" ON store_settings;
DROP POLICY IF EXISTS "Public view store settings" ON store_settings;
DROP POLICY IF EXISTS "Admins manage store settings" ON store_settings;
DROP POLICY IF EXISTS "Service role can manage all settings" ON store_settings;

CREATE POLICY "Public view store settings" ON store_settings
    FOR SELECT
    USING (true);

CREATE POLICY "Admins manage store settings" ON store_settings
    FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

CREATE POLICY "Service role can manage all settings" ON store_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
