BEGIN;

CREATE TABLE IF NOT EXISTS public.app_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_token
ON public.app_refresh_tokens(token);

CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user
ON public.app_refresh_tokens(user_id);

ALTER TABLE public.app_refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_app_refresh_tokens" ON public.app_refresh_tokens;
CREATE POLICY "service_role_all_app_refresh_tokens"
ON public.app_refresh_tokens FOR ALL TO service_role
USING (true) WITH CHECK (true);

COMMIT;
