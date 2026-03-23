-- Migration: Add delivery charge snapshot fields to order_items
-- Created: 2026-01-17
-- Purpose: Capture delivery charge calculation details at order time for audit trail

-- Add delivery GST column to order_items
ALTER TABLE order_items 
    ADD COLUMN IF NOT EXISTS delivery_gst DECIMAL(10,2) DEFAULT 0;

-- Add delivery calculation snapshot (stores calculation details as JSON)
ALTER TABLE order_items 
    ADD COLUMN IF NOT EXISTS delivery_calculation_snapshot JSONB;

-- Add comments
COMMENT ON COLUMN order_items.delivery_gst IS 'GST amount charged on delivery for this item';
COMMENT ON COLUMN order_items.delivery_calculation_snapshot IS 'Snapshot of delivery calculation details for audit trail (calculation_type, quantity, packages, base_charge, etc.)';

-- Example snapshot structure:
-- {
--   "calculation_type": "PER_PACKAGE",
--   "quantity": 20,
--   "packages": 7,
--   "base_charge": 123,
--   "delivery_charge": 861,
--   "gst_rate": 18,
--   "delivery_gst": 155
-- }
