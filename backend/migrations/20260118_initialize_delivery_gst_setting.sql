-- Migration to add delivery_gst to store_settings and update RLS
-- Created: 2026-01-18

-- 1. Ensure delivery_gst exists in store_settings
INSERT INTO store_settings (key, value, description)
VALUES ('delivery_gst', '0', 'Standard GST rate for delivery charges')
ON CONFLICT (key) DO NOTHING;

-- 2. Update RLS policy to allow public to view delivery_gst
-- We need to drop the old policy first
DROP POLICY IF EXISTS "Public can view delivery settings" ON store_settings;

CREATE POLICY "Public can view delivery settings" ON store_settings
    FOR SELECT
    USING (key IN ('delivery_threshold', 'delivery_charge', 'delivery_gst'));
