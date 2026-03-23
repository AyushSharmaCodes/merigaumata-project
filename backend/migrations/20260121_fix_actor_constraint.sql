-- Fix: Remove invalid check constraint on order_status_history.actor
-- The constraint is blocking 'SYSTEM' as a valid actor, which prevents 
-- background refund processes from logging history

-- Drop the problematic constraint
ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_actor_check;

-- Recreate it with 'SYSTEM' included
ALTER TABLE order_status_history 
ADD CONSTRAINT order_status_history_actor_check 
CHECK (actor IN ('USER', 'ADMIN', 'SYSTEM'));

COMMENT ON CONSTRAINT order_status_history_actor_check ON order_status_history IS 
'Allows USER (customer actions), ADMIN (staff actions), and SYSTEM (automated processes like refunds)';
