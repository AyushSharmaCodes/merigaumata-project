-- Update policy types to merge shipping and refund
ALTER TABLE public.policy_pages DROP CONSTRAINT IF EXISTS policy_pages_policy_type_check;

-- Update existing data if any (mapping both old types to the new one)
UPDATE public.policy_pages 
SET policy_type = 'shipping-refund' 
WHERE policy_type IN ('shipping', 'refund');

-- Add new constraint
ALTER TABLE public.policy_pages ADD CONSTRAINT policy_pages_policy_type_check 
    CHECK (policy_type IN ('privacy', 'terms', 'shipping-refund'));
