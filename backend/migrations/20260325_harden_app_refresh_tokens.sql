BEGIN;

ALTER TABLE public.app_refresh_tokens
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS ip_address TEXT;

UPDATE public.app_refresh_tokens
SET last_used_at = COALESCE(last_used_at, created_at, NOW())
WHERE last_used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user_expires
ON public.app_refresh_tokens(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_revoked
ON public.app_refresh_tokens(revoked_at)
WHERE revoked_at IS NOT NULL;

COMMIT;
