-- Migration: Add type column to categories table for unified category management
-- This allows using a single table for product, event, and FAQ categories
-- Run this in Supabase SQL Editor

-- 1. Add type column with default 'product' (for existing categories)
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'product';

-- 2. Add check constraint to ensure only valid types
ALTER TABLE categories ADD CONSTRAINT categories_type_check 
  CHECK (type IN ('product', 'event', 'faq'));

-- 3. Create index for faster type filtering
CREATE INDEX idx_categories_type ON categories(type);

-- 4. Update unique constraint to allow same name for different types
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_name_type_unique 
  UNIQUE (name, type);

-- 5. Insert default event categories
INSERT INTO categories (name, type) VALUES
  ('Katha', 'event'),
  ('Workshop', 'event'),
  ('Awareness', 'event'),
  ('Celebration', 'event'),
  ('Other', 'event')
ON CONFLICT (name, type) DO NOTHING;

-- 6. Insert default FAQ categories
INSERT INTO categories (name, type) VALUES
  ('General', 'faq'),
  ('Products', 'faq'),
  ('Shipping', 'faq'),
  ('Returns', 'faq'),
  ('Account', 'faq')
ON CONFLICT (name, type) DO NOTHING;
