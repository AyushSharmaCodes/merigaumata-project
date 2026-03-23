-- Fix limits on adding multiple variants of the same product to cart
-- Currently there is a UNIQUE(cart_id, product_id) which prevents adding different variants
-- We need to change this to UNIQUE(cart_id, product_id, variant_id)

-- 1. Drop existing constraint
ALTER TABLE public.cart_items
DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_id_key;

-- 2. Add new constraint that includes variant_id
-- Note: In older Postgres versions, NULL != NULL in unique constraints.
-- However, we want to ensure only ONE "null variant" (no variant) item exists per product per cart.
-- We can use a unique index with COALESCE to handle the nulls correctly if needed,
-- or just use a standard unique index if we are on PG 15+ with NULLS NOT DISTINCT or if we trust the application logic.
-- Given Supabase usually runs recent Postgres, let's try the modern approach or a partial index approach for safety.

-- Option A: Standard partial indexes (safest across versions)

-- i. For items with variants
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique_variant 
ON public.cart_items (cart_id, product_id, variant_id)
WHERE variant_id IS NOT NULL;

-- ii. For items without variants (variant_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique_no_variant
ON public.cart_items (cart_id, product_id)
WHERE variant_id IS NULL;
