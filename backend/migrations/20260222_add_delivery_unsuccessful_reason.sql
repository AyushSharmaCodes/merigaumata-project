-- Migration: Add Delivery Unsuccessful Reason to Orders
-- Description: Adds a column to store the reason when a delivery attempt fails.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_unsuccessful_reason TEXT;

-- Index for searching if needed (though mostly for display)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_unsuccessful_reason ON public.orders(delivery_unsuccessful_reason) WHERE status = 'delivery_unsuccessful';
