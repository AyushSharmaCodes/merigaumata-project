-- Add category_id column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Backfill category_id based on existing category string
-- Matches against 'name' or 'original_name' in categories table
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE (p.category IS NOT NULL AND p.category != '')
  AND (c.name = p.category OR (c.name_i18n->>'en') = p.category);

-- Index the new column for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Optional: You may want to verify the backfill before dropping the old column.
-- We will keep 'category' column for now for backward compatibility but stop writing to it.
