-- Comprehensive migration to fix all index and function references after camelCase column renaming
-- Run this in Supabase SQL Editor

-- Fix generate_order_number function to use camelCase column names
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_order_number TEXT;
    order_count INT;
BEGIN
    -- Count today's orders (using camelCase column name)
    SELECT COUNT(*) INTO order_count
    FROM orders
    WHERE DATE("createdAt") = CURRENT_DATE;
    
    -- Generate order number: ORD-YYYYMMDD-XXXX
    new_order_number := 'ORD-' ||
                       TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                       LPAD((order_count + 1)::TEXT, 4, '0');
    
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;
