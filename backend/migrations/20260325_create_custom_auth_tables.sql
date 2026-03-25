BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_accounts (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    password_set_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('LOCAL', 'GOOGLE')),
    provider_user_id TEXT,
    provider_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_user
ON public.auth_identities(provider, provider_user_id)
WHERE provider_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_email
ON public.auth_identities(provider, provider_email)
WHERE provider_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON public.auth_accounts(email);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON public.auth_identities(user_id);

DROP TRIGGER IF EXISTS auth_accounts_updated_at ON public.auth_accounts;
CREATE TRIGGER auth_accounts_updated_at
BEFORE UPDATE ON public.auth_accounts
FOR EACH ROW
EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS auth_identities_updated_at ON public.auth_identities;
CREATE TRIGGER auth_identities_updated_at
BEFORE UPDATE ON public.auth_identities
FOR EACH ROW
EXECUTE PROCEDURE handle_updated_at();

ALTER TABLE public.auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_auth_accounts" ON public.auth_accounts;
CREATE POLICY "service_role_all_auth_accounts"
ON public.auth_accounts FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_auth_identities" ON public.auth_identities;
CREATE POLICY "service_role_all_auth_identities"
ON public.auth_identities FOR ALL TO service_role
USING (true) WITH CHECK (true);

INSERT INTO public.auth_accounts (user_id, email, created_at, updated_at)
SELECT p.id, lower(trim(p.email)), NOW(), NOW()
FROM public.profiles p
WHERE p.email IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = NOW();

INSERT INTO public.auth_identities (user_id, provider, provider_email, created_at, updated_at)
SELECT
    p.id,
    COALESCE(p.auth_provider, 'LOCAL'),
    lower(trim(p.email)),
    NOW(),
    NOW()
FROM public.profiles p
WHERE p.email IS NOT NULL
ON CONFLICT (user_id, provider) DO UPDATE
SET provider_email = EXCLUDED.provider_email,
    updated_at = NOW();

COMMIT;
