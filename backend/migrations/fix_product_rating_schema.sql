-- Add rating and review columns to products table to fix schema cache error

ALTER TABLE products ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 1) DEFAULT 0;

COMMENT ON COLUMN products."ratingCount" IS 'Total number of ratings';
COMMENT ON COLUMN products."reviewCount" IS 'Total number of written reviews';
COMMENT ON COLUMN products.rating IS 'Average rating (0-5)';
