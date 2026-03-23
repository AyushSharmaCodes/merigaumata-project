-- Migration: Drop Legacy create_order_transactional (6-parameter version)
-- Description: Removes the older version of the RPC to resolve Postgres ambiguity errors.
-- Signature: create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT)

DROP FUNCTION IF EXISTS public.create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT);

COMMENT ON FUNCTION public.create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT) IS 
'Primary order creation function. 7-parameter version (includes p_order_number).';
