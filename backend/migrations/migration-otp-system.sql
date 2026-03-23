-- OTP Storage Table
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    code TEXT NOT NULL, -- Stores bcrypt hashed OTP
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT max_attempts_check CHECK (attempts <= 3)
);

-- Index for faster lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_codes(identifier) WHERE verified = false;
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at) WHERE verified = false;
CREATE INDEX IF NOT EXISTS idx_otp_created ON otp_codes(created_at);

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Policies (service role can do everything)
CREATE POLICY "Enable all operations for otp_codes" ON otp_codes
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for refresh_tokens" ON refresh_tokens
    FOR ALL USING (true) WITH CHECK (true);

-- Update profiles table to support independent email/phone
ALTER TABLE profiles 
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN phone DROP NOT NULL;

-- Add verification fields
ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Add constraint: at least one of email or phone must be present
ALTER TABLE profiles 
    ADD CONSTRAINT email_or_phone_required 
    CHECK (email IS NOT NULL OR phone IS NOT NULL);
