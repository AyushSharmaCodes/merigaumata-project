-- Migration: Add delivery_unsuccessful to orders status check constraint
-- Description: Adds the 'delivery_unsuccessful' status to the orders table
--   CHECK constraint to support the delivery failure → return-to-warehouse flow.

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%'
      AND conname NOT LIKE '%payment%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status IN (
    'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery',
    'delivered', 'cancelled',
    'return_requested', 'return_approved', 'return_rejected',
    'partially_returned', 'returned', 'refunded',
    'failed', 'partially_refunded',
    'delivery_unsuccessful'
));
