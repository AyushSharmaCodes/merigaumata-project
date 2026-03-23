-- Fix policy_type check constraint to include 'shipping-refund'
ALTER TABLE public.policy_pages DROP CONSTRAINT IF EXISTS policy_pages_policy_type_check;

ALTER TABLE public.policy_pages ADD CONSTRAINT policy_pages_policy_type_check 
    CHECK (policy_type IN ('privacy', 'terms', 'shipping-refund'));
