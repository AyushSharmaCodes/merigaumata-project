-- Fix RLS Access for History and Items using Security Definer
-- Reason: Nested RLS checks can be fragile or recursive.
-- This approach bypasses RLS on the 'orders' table for the specific purpose of checking ownership.

-- 1. Create Helper Function
CREATE OR REPLACE FUNCTION check_order_access(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the order belongs to the current user
    RETURN EXISTS (
        SELECT 1 FROM orders
        WHERE id = p_order_id
        AND user_id = auth.uid()
    );
END;
$$;

-- 2. Update Policies for order_status_history

-- Drop all known variations to ensure clean slate
DROP POLICY IF EXISTS "Users can view their own order history" ON order_status_history;
DROP POLICY IF EXISTS "Users can view their own order status history" ON order_status_history;

-- Create robust policy
CREATE POLICY "Users can view their own order history" ON order_status_history
FOR SELECT
TO authenticated
USING (
    check_order_access(order_id)
);

-- 3. Update Policies for order_items

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;

CREATE POLICY "Users can view own order items" ON order_items
FOR SELECT
TO authenticated
USING (
    check_order_access(order_id)
);
