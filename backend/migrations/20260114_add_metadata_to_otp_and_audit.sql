-- Add metadata column to otp_codes to support cross-service tracking (Deletion, etc)
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add metadata column to account_deletion_audit if missing (belt and suspenders)
ALTER TABLE public.account_deletion_audit ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Ensure deletion_authorization_tokens has metadata for auditing
ALTER TABLE public.deletion_authorization_tokens ADD COLUMN IF NOT EXISTS metadata JSONB;
