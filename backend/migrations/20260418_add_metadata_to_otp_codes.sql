-- Migration: Add metadata column to otp_codes
-- This migration adds a JSONB column to store session context during OTP generation.

BEGIN;

-- 1. Add metadata column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'otp_codes'
          AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.otp_codes ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

COMMIT;
