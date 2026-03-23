-- Ensure RLS is enabled
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any to avoid conflict error (or use DO block)
DROP POLICY IF EXISTS "Service role can manage all settings" ON store_settings;

-- Re-create the policy explicitly
CREATE POLICY "Service role can manage all settings" ON store_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Also ensure public read access
DROP POLICY IF EXISTS "Public can view delivery settings" ON store_settings;

CREATE POLICY "Public can view delivery settings" ON store_settings
    FOR SELECT
    USING (key IN ('delivery_threshold', 'delivery_charge', 'delivery_gst'));
