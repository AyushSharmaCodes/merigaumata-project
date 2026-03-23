-- Migration: 20260119_fix_refund_refunds_relation.sql
-- Description: Fixes the missing Foreign Key relationship between refunds and orders, required for PostgREST embedding.

-- 1. Ensure order_id column exists
ALTER TABLE refunds 
ADD COLUMN IF NOT EXISTS order_id UUID;

-- 2. Add Foreign Key Constraint if it doesn't exist
-- We use a DO block to safely add the constraint only if it's missing to avoid 'relation already exists' errors.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'refunds_order_id_fkey'
    ) THEN
        ALTER TABLE refunds 
        ADD CONSTRAINT refunds_order_id_fkey 
        FOREIGN KEY (order_id) 
        REFERENCES orders(id);
    END IF;
END $$;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
