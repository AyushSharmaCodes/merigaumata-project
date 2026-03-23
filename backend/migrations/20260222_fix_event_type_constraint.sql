-- Migration: Fix order_status_history event_type constraint + add refunds.metadata column
-- Description: 1) Adds missing event types to order_status_history.event_type CHECK constraint.
--              2) Adds metadata JSONB column to refunds table (required by handleItemRefund).
--   to allow the return flow to log all status transitions.

BEGIN;

-- 1. Drop existing constraint
ALTER TABLE order_status_history 
DROP CONSTRAINT IF EXISTS order_status_history_event_type_check;

-- 2. Add updated constraint with all event types
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
    'CANCELLED',
    'ORDER_RETURNED',
    'PARTIALLY_RETURNED',
    'RETURN_REQUESTED',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
    'RETURN_CANCELLED',
    'RETURN_PICKED_UP',
    'PICKUP_SCHEDULED',
    'ITEM_RETURNED',
    
    -- Delivery
    'DELIVERY_UNSUCCESSFUL',
    
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

-- 2. Add metadata JSONB column to refunds table (used by handleItemRefund for idempotency)
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMIT;
