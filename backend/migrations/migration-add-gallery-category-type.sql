-- Migration: Update category type constraint to include 'gallery'
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;

-- Add the updated constraint with 'gallery' included
ALTER TABLE categories ADD CONSTRAINT categories_type_check 
  CHECK (type IN ('product', 'event', 'faq', 'gallery'));

-- Insert default gallery categories (optional)
INSERT INTO categories (name, type) VALUES
  ('Festivals', 'gallery'),
  ('Ceremonies', 'gallery'),
  ('General', 'gallery')
ON CONFLICT (name, type) DO NOTHING;
