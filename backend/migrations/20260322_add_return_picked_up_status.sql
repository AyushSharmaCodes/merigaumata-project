-- Migration: Add return_picked_up to orders_status_check constraint
-- Description: Updates the allowed statuses in the orders table to support the new "Return Picked Up" state.

DO $$
BEGIN
    -- 1. Drop existing status-related constraints to avoid collisions
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS status_check;

    -- 2. Add the updated constraint including 'return_picked_up'
    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_status_check 
    CHECK (status IN (
        'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 
        'return_requested', 'return_approved', 'return_picked_up', 'return_rejected', 
        'partially_returned', 'returned', 'refunded', 'delivery_unsuccessful'
    ));
END $$;
