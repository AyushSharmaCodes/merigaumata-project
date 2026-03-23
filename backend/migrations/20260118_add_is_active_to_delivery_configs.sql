-- Migration: Add is_active column to delivery_configs
-- Purpose: Allow disabling custom delivery rules without deleting them

ALTER TABLE delivery_configs 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN delivery_configs.is_active IS 'Whether this configuration is active. If false, global defaults are used.';
