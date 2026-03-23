-- Migration: Create function to pre-generate order numbers
-- Created: 2026-01-21
-- This allows generating order numbers BEFORE creating the order in DB
-- Useful for Razorpay invoice creation where we need the final order number upfront

CREATE OR REPLACE FUNCTION generate_next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_number TEXT;
    v_next_seq INT;
BEGIN
    -- Lock to prevent race conditions (per-day lock)
    PERFORM pg_advisory_xact_lock(hashtext('order_number_' || TO_CHAR(NOW(), 'YYYYMMDD')));
    
    -- Get the next sequential number for today
    SELECT COALESCE(
        (SELECT CAST(SUBSTRING(order_number FROM 12) AS INT) + 1
         FROM orders 
         WHERE order_number LIKE 'ODR' || TO_CHAR(NOW(), 'YYYYMMDD') || '%'
         AND SUBSTRING(order_number FROM 12) ~ '^[0-9]+$'
         ORDER BY order_number DESC 
         LIMIT 1), 
        1
    ) INTO v_next_seq;
    
    -- Build the order number
    v_order_number := 'ODR' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(v_next_seq::TEXT, 6, '0');
    
    -- CRITICAL: Reserve this number by creating a placeholder order
    -- This prevents race conditions where the same number could be generated twice
    -- The actual order will UPDATE this record via create_order_transactional
    INSERT INTO orders (
        order_number,
        user_id, 
        customer_name,
        customer_email,
        shipping_address,
        items,
        status,
        payment_status,
        total_amount,
        subtotal,
        delivery_charge,
        coupon_discount,
        total_taxable_amount,
        total_cgst,
        total_sgst,
        total_igst,
        created_at,
        updated_at
    ) VALUES (
        v_order_number,
        NULL, -- Will be updated when actual order is created
        'PLACEHOLDER', -- Temporary, will be updated
        'placeholder@temp.local', -- Temporary, will be updated
        '{"placeholder": true}'::jsonb, -- Temporary shipping address
        '[]'::jsonb, -- Temporary empty items array
        'pending',
        'pending',
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        NOW(),
        NOW()
    );
    
    RETURN v_order_number;
END;
$$;

COMMENT ON FUNCTION generate_next_order_number() IS 
'Pre-generates and RESERVES the next sequential order number by creating a placeholder order. The placeholder is updated when create_order_transactional is called with this order number. Uses advisory locks to prevent race conditions.';
