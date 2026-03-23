-- DANGER: THIS SCRIPT DELETES ALL ORDER AND RETURN DATA
-- Run this in the Supabase SQL Editor

BEGIN;

-- 1. Truncate Transactional Tables (Cascading to items, history, logs)
TRUNCATE TABLE 
  orders, 
  order_items, 
  payments, 
  returns, 
  return_items, 
  refunds, 
  invoices,
  order_status_history,
  email_logs
CASCADE;

-- 2. Clear Storage Buckets (Invoices & Return Images)
-- Note: 'storage.objects' is in the 'storage' schema.
-- We delete files associated with 'invoices' and 'return-requests' buckets.
DELETE FROM storage.objects 
WHERE bucket_id IN ('invoices', 'return-requests', 'return-images');

COMMIT;

-- Verification
SELECT count(*) as orders_count FROM orders;
SELECT count(*) as returns_count FROM returns;
