-- Migration: Fix RLS policies for invoices table
-- Created: 2026-01-21
-- Purpose: Allow authenticated users to insert their own invoices

-- Enable RLS on invoices table if not already enabled
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own invoices
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
CREATE POLICY "Users can view their own invoices"
ON invoices FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM orders WHERE id = invoices.order_id
  )
);

-- Policy: Allow users to insert invoices linked to their orders
DROP POLICY IF EXISTS "Users can create invoices for their orders" ON invoices;
CREATE POLICY "Users can create invoices for their orders"
ON invoices FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM orders WHERE id = order_id
  )
);

-- Policy: Allow service role (server-side) full access
-- Note: Service role bypasses RLS, but explicit policies can be safer
DROP POLICY IF EXISTS "Service role has full access to invoices" ON invoices;
CREATE POLICY "Service role has full access to invoices"
ON invoices
USING (true)
WITH CHECK (true);
