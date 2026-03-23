-- Optimizing purchase verification for reviews
-- Use GIN index for JSONB path queries
CREATE INDEX IF NOT EXISTS idx_orders_items_gin ON public.orders USING GIN (items jsonb_path_ops);

COMMENT ON INDEX idx_orders_items_gin IS 'Optimizes JSONB searches in order items, specifically for purchase verification (reviews).';
