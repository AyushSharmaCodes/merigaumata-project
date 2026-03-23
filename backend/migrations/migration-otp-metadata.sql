-- Add metadata column to otp_codes to store usage-specific data (e.g. encrypted session tokens)
ALTER TABLE otp_codes 
ADD COLUMN IF NOT EXISTS metadata JSONB;
