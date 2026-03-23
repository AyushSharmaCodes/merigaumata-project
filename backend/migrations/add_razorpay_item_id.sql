-- Add GST and Razorpay fields to product_variants table

ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS razorpay_item_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_applicable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS price_includes_tax BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_razorpay_item_id ON product_variants(razorpay_item_id);
