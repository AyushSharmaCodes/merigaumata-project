CREATE TABLE IF NOT EXISTS idempotency_keys (
    cache_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    correlation_id TEXT,
    in_progress BOOLEAN NOT NULL DEFAULT TRUE,
    status_code INTEGER,
    response JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id ON idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage idempotency keys" ON idempotency_keys;
CREATE POLICY "Service role can manage idempotency keys" ON idempotency_keys
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS idempotency_keys_updated_at ON idempotency_keys;
CREATE TRIGGER idempotency_keys_updated_at
    BEFORE UPDATE ON idempotency_keys
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

CREATE TABLE IF NOT EXISTS request_locks (
    lock_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    correlation_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_locks_user_id ON request_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_request_locks_expires_at ON request_locks(expires_at);

ALTER TABLE request_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage request locks" ON request_locks;
CREATE POLICY "Service role can manage request locks" ON request_locks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS request_locks_updated_at ON request_locks;
CREATE TRIGGER request_locks_updated_at
    BEFORE UPDATE ON request_locks
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();
