-- =====================================================
-- ACCOUNT DELETION SYSTEM - DATABASE MIGRATION
-- Version: 1.0
-- Date: 2026-01-14
-- =====================================================

-- =====================================================
-- 1. ADD DELETION COLUMNS TO PROFILES
-- =====================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(50) DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create index for scheduled deletion queries
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_status 
ON profiles(deletion_status) 
WHERE deletion_status != 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_profiles_scheduled_deletion 
ON profiles(scheduled_deletion_at) 
WHERE scheduled_deletion_at IS NOT NULL;

-- =====================================================
-- 2. ACCOUNT DELETION JOBS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS account_deletion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- Status: PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
    mode VARCHAR(20) NOT NULL,
    -- Mode: IMMEDIATE, SCHEDULED
    scheduled_for TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    steps_completed JSONB DEFAULT '[]'::jsonb,
    -- Array of step names completed
    current_step VARCHAR(100),
    error_log JSONB DEFAULT '[]'::jsonb,
    -- Array of error objects
    retry_count INTEGER DEFAULT 0,
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deletion_jobs_user_id 
ON account_deletion_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_deletion_jobs_status 
ON account_deletion_jobs(status) 
WHERE status IN ('PENDING', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_deletion_jobs_scheduled 
ON account_deletion_jobs(scheduled_for) 
WHERE status = 'PENDING' AND mode = 'SCHEDULED';

-- =====================================================
-- 3. ACCOUNT DELETION AUDIT TABLE (IMMUTABLE)
-- =====================================================
CREATE TABLE IF NOT EXISTS account_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_hash VARCHAR(64) NOT NULL,
    -- sha256(user_id) - anonymized for GDPR
    action VARCHAR(50) NOT NULL,
    -- DELETION_REQUESTED, DELETION_SCHEDULED, DELETION_CANCELLED, 
    -- DELETION_STARTED, DELETION_COMPLETED, DELETION_FAILED,
    -- LEGAL_HOLD_APPLIED, LEGAL_HOLD_REMOVED
    actor VARCHAR(20) NOT NULL,
    -- USER, ADMIN, SYSTEM
    actor_id UUID,
    -- NULL if SYSTEM
    mode VARCHAR(20),
    -- IMMEDIATE, SCHEDULED
    result VARCHAR(20) NOT NULL,
    -- SUCCESS, FAILED, BLOCKED
    blocking_reasons JSONB,
    -- Array of blocking reason objects
    metadata JSONB,
    -- Additional context
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_deletion_audit_user_hash 
ON account_deletion_audit(user_hash);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_correlation 
ON account_deletion_audit(correlation_id);

-- =====================================================
-- 4. DELETION AUTHORIZATION TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS deletion_authorization_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    -- sha256(token)
    device_fingerprint VARCHAR(255),
    action VARCHAR(50) NOT NULL DEFAULT 'ACCOUNT_DELETE',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_dat_user_id 
ON deletion_authorization_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_dat_expires 
ON deletion_authorization_tokens(expires_at) 
WHERE used = FALSE;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Account Deletion Jobs (Admin + Service Role only)
ALTER TABLE account_deletion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view deletion jobs" ON account_deletion_jobs;
CREATE POLICY "Admins can view deletion jobs" ON account_deletion_jobs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() 
            AND r.name IN ('admin', 'manager')
        )
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Service role full access" ON account_deletion_jobs;
CREATE POLICY "Service role full access" ON account_deletion_jobs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Account Deletion Audit (Read-only for admins)
ALTER TABLE account_deletion_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit" ON account_deletion_audit;
CREATE POLICY "Admins can view audit" ON account_deletion_audit
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() 
            AND r.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Service role full access" ON account_deletion_audit;
CREATE POLICY "Service role full access" ON account_deletion_audit
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Deletion Authorization Tokens (User owns their tokens)
ALTER TABLE deletion_authorization_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tokens" ON deletion_authorization_tokens;
CREATE POLICY "Users can view own tokens" ON deletion_authorization_tokens
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access" ON deletion_authorization_tokens;
CREATE POLICY "Service role full access" ON deletion_authorization_tokens
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 6. SUCCESS CONFIRMATION
-- =====================================================
SELECT 'Account Deletion System migration completed successfully!' as status;
