-- Optimization for Admin Dashboard Analytics
-- Run this in your Supabase SQL Editor to enable server-side aggregations.

-- 1. Function to get Total Donations (Sum of 'amount' where payment_status = 'success')
CREATE OR REPLACE FUNCTION get_total_donations()
RETURNS DECIMAL AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(amount), 0)
    FROM donations
    WHERE payment_status = 'success'
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Function to get Product Counts by Category
CREATE OR REPLACE FUNCTION get_product_category_stats()
RETURNS TABLE (category TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.category, 'Uncategorized') as category, 
    COUNT(*) as count
  FROM products p
  GROUP BY p.category
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders("createdAt");
CREATE INDEX IF NOT EXISTS idx_donations_payment_status ON donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);

-- 4. Grant execute permissions (Adjust 'anon' and 'authenticated' based on needs)
-- Usually for admin dashboard, only 'service_role' (backend) needs access, which implies bypass RLS.
-- But if using client SDK with RLS, we need to grant.
-- Since the backend uses supabase-admin (service key), it should have access.
