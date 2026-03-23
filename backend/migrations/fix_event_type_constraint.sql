-- Migration: Fix order_status_history event_type CHECK constraint
-- Purpose: Allow new event types for better timeline labels

-- Root Cause: The event_type column has a CHECK constraint that only allows
-- a limited set of values. New event types added to history.service.js
-- (ORDER_CONFIRMED, ORDER_PACKED, ORDER_SHIPPED, etc.) are being blocked.

-- Solution: Drop the old constraint and create a new one with all supported event types

BEGIN;

-- 1. Drop existing constraint
ALTER TABLE order_status_history 
DROP CONSTRAINT IF EXISTS order_status_history_event_type_check;

-- 2. Add new constraint with all event types
ALTER TABLE order_status_history
ADD CONSTRAINT order_status_history_event_type_check
CHECK (event_type IN (
    -- Order lifecycle
    'ORDER_PLACED',
    'ORDER_CONFIRMED',
    'ORDER_PROCESSING',
    'ORDER_PACKED',
    'ORDER_SHIPPED',
    'OUT_FOR_DELIVERY',
    'ORDER_DELIVERED',
    
    -- Cancellation & Returns
    'ORDER_CANCELLED',
    'CANCELLED', -- Legacy value, keep for backwards compatibility
    'ORDER_RETURNED',
    'RETURN_REQUESTED',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
    
    -- Refunds
    'REFUND_INITIATED',
    'REFUND_COMPLETED',
    'REFUND_PARTIAL',
    'REFUND_FAILED',
    
    -- Payment events
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
    'PAYMENT_PENDING',
    
    -- Generic fallback
    'STATUS_CHANGE',
    'MANUAL_UPDATE'
));

COMMIT;

-- Verification: Insert a test entry
-- You can uncomment this to test after running the migration
-- INSERT INTO order_status_history (order_id, status, event_type, actor, notes)
-- SELECT id, 'pending', 'ORDER_PLACED', 'SYSTEM', 'Migration test'
-- FROM orders LIMIT 1;
--
-- Then delete it:
-- DELETE FROM order_status_history WHERE notes = 'Migration test';
