-- Migration: Atomic Inventory Functions
-- Purpose: PostgreSQL functions for thread-safe inventory operations with optimistic locking
-- These functions ensure atomic inventory updates to prevent race conditions

-- ============================================================================
-- Function: decrement_inventory_atomic
-- Purpose: Atomically decrease inventory for a product with stock validation
-- Returns: JSON with success status, new inventory, and error details if any
-- ============================================================================

CREATE OR REPLACE FUNCTION decrement_inventory_atomic(
    p_product_id UUID,
    p_quantity INT,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_inventory INT;
    v_new_inventory INT;
    v_product_title TEXT;
BEGIN
    -- Acquire row-level lock and get current inventory
    SELECT inventory, title 
    INTO v_current_inventory, v_product_title
    FROM products 
    WHERE id = p_product_id
    FOR UPDATE;
    
    -- Check if product exists
    IF v_current_inventory IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PRODUCT_NOT_FOUND',
            'message', format('Product %s not found', p_product_id),
            'traceId', p_trace_id
        );
    END IF;
    
    -- Check if sufficient stock
    IF v_current_inventory < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INSUFFICIENT_STOCK',
            'message', format('Insufficient stock for %s. Available: %s, Requested: %s', 
                v_product_title, v_current_inventory, p_quantity),
            'available', v_current_inventory,
            'requested', p_quantity,
            'productId', p_product_id,
            'productTitle', v_product_title,
            'traceId', p_trace_id
        );
    END IF;
    
    -- Calculate new inventory
    v_new_inventory := v_current_inventory - p_quantity;
    
    -- Update inventory
    UPDATE products 
    SET inventory = v_new_inventory, 
        updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'previousInventory', v_current_inventory,
        'newInventory', v_new_inventory,
        'decremented', p_quantity,
        'productId', p_product_id,
        'productTitle', v_product_title,
        'traceId', p_trace_id
    );
END;
$$;

-- ============================================================================
-- Function: increment_inventory_atomic
-- Purpose: Atomically increase inventory for a product (for restores/returns)
-- Returns: JSON with success status and new inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_inventory_atomic(
    p_product_id UUID,
    p_quantity INT,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_inventory INT;
    v_new_inventory INT;
    v_product_title TEXT;
BEGIN
    -- Acquire row-level lock and get current inventory
    SELECT inventory, title 
    INTO v_current_inventory, v_product_title
    FROM products 
    WHERE id = p_product_id
    FOR UPDATE;
    
    -- Check if product exists
    IF v_current_inventory IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PRODUCT_NOT_FOUND',
            'message', format('Product %s not found', p_product_id),
            'traceId', p_trace_id
        );
    END IF;
    
    -- Calculate new inventory
    v_new_inventory := v_current_inventory + p_quantity;
    
    -- Update inventory
    UPDATE products 
    SET inventory = v_new_inventory, 
        updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'previousInventory', v_current_inventory,
        'newInventory', v_new_inventory,
        'incremented', p_quantity,
        'productId', p_product_id,
        'productTitle', v_product_title,
        'traceId', p_trace_id
    );
END;
$$;

-- ============================================================================
-- Function: batch_decrement_inventory_atomic
-- Purpose: Atomically decrease inventory for multiple products in a single transaction
-- Returns: JSON with overall success and per-item results
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_decrement_inventory_atomic(
    p_items JSONB, -- Array of { product_id, quantity }
    p_trace_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_quantity INT;
    v_result JSONB;
    v_results JSONB := '[]'::JSONB;
    v_all_success BOOLEAN := true;
    v_failed_items JSONB := '[]'::JSONB;
BEGIN
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        
        -- Call single decrement function
        v_result := decrement_inventory_atomic(v_product_id, v_quantity, p_trace_id);
        
        -- Track results
        v_results := v_results || jsonb_build_array(v_result);
        
        IF NOT (v_result->>'success')::BOOLEAN THEN
            v_all_success := false;
            v_failed_items := v_failed_items || jsonb_build_array(v_result);
        END IF;
    END LOOP;
    
    -- If any failed, we need to rollback (by raising exception)
    IF NOT v_all_success THEN
        -- Note: In PostgreSQL, raising exception will rollback entire transaction
        RAISE EXCEPTION 'INVENTORY_BATCH_FAILED: %', v_failed_items::TEXT;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'itemsProcessed', jsonb_array_length(p_items),
        'results', v_results,
        'traceId', p_trace_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error details without re-raising (let caller handle)
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BATCH_DECREMENT_FAILED',
            'message', SQLERRM,
            'failedItems', v_failed_items,
            'traceId', p_trace_id
        );
END;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION decrement_inventory_atomic TO service_role;
GRANT EXECUTE ON FUNCTION increment_inventory_atomic TO service_role;
GRANT EXECUTE ON FUNCTION batch_decrement_inventory_atomic TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION decrement_inventory_atomic IS 
'Atomically decreases product inventory with row-level locking. Returns success/error as JSONB.';

COMMENT ON FUNCTION increment_inventory_atomic IS 
'Atomically increases product inventory for returns/cancellations. Returns success/error as JSONB.';

COMMENT ON FUNCTION batch_decrement_inventory_atomic IS 
'Atomically decreases inventory for multiple products. Rolls back all if any fails.';
