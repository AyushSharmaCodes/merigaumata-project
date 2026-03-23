-- Add default tax fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS default_hsn_code TEXT,
ADD COLUMN IF NOT EXISTS default_gst_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_tax_applicable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_price_includes_tax BOOLEAN DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN products.default_hsn_code IS 'Default HSN code for the product if no variant override';
COMMENT ON COLUMN products.default_gst_rate IS 'Default GST rate for the product if no variant override';
COMMENT ON COLUMN products.default_tax_applicable IS 'Whether tax is applicable by default';
COMMENT ON COLUMN products.default_price_includes_tax IS 'Whether the price includes tax by default';
