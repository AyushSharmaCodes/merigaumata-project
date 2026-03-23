-- Migration: Add indexes to delivery_configs for performance
-- File: 20260118_add_delivery_config_indexes.sql

-- Add index on product_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_delivery_configs_product_id 
ON delivery_configs (product_id);

-- Add index on variant_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_delivery_configs_variant_id 
ON delivery_configs (variant_id);

-- Add index on scope for filtering
CREATE INDEX IF NOT EXISTS idx_delivery_configs_scope 
ON delivery_configs (scope);
