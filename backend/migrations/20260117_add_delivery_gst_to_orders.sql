-- Migration: Add delivery GST to orders table
-- Created: 2026-01-17
-- Purpose: Track total delivery GST at order level

-- Add delivery_gst column to orders table
ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS delivery_gst DECIMAL(10,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN orders.delivery_gst IS 'Total GST charged on delivery for this order';
