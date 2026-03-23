-- 1. Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INTEGER;
    meta_name TEXT;
    user_first_name TEXT;
    user_last_name TEXT;
BEGIN
    -- Get customer role id (fallback to 3 if not found, but should exist)
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer';
    
    -- Extract name from metadata
    meta_name := NEW.raw_user_meta_data->>'name';
    
    -- Determine First/Last Name
    IF meta_name IS NOT NULL AND length(meta_name) > 0 THEN
        user_first_name := split_part(meta_name, ' ', 1);
        IF position(' ' in meta_name) > 0 THEN
             user_last_name := substring(meta_name from position(' ' in meta_name) + 1);
        ELSE
             user_last_name := NULL;
        END IF;
    ELSE
        -- Fallback: use email prefix as First Name
        user_first_name := split_part(NEW.email, '@', 1);
        user_last_name := NULL;
    END IF;

    -- Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        name,
        phone,
        role_id,
        created_at,
        updated_at,
        email_verified,
        phone_verified,
        is_deleted,
        is_blocked,
        first_name,
        last_name
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(meta_name, NEW.email),
        NEW.raw_user_meta_data->>'phone',
        default_role_id,
        NOW(),
        NOW(),
        (NEW.email_confirmed_at IS NOT NULL),
        (NEW.phone_confirmed_at IS NOT NULL),
        false,
        false,
        user_first_name,
        user_last_name
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill missing profiles for existing users
-- Includes logic to generate required first_name from email if name is missing
INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    role_id, 
    created_at, 
    updated_at, 
    is_deleted, 
    is_blocked,
    first_name,
    last_name
)
SELECT 
    au.id,
    au.email,
    -- name (fallback to email)
    COALESCE(au.raw_user_meta_data->>'name', au.email),
    (SELECT id FROM public.roles WHERE name = 'customer'),
    au.created_at,
    NOW(),
    false,
    false,
    -- first_name (Required: fallback to email prefix)
    COALESCE(
        NULLIF(split_part(au.raw_user_meta_data->>'name', ' ', 1), ''),
        split_part(au.email, '@', 1)
    ),
    -- last_name (Optional)
    CASE 
        WHEN position(' ' in COALESCE(au.raw_user_meta_data->>'name', '')) > 0 
        THEN substring(COALESCE(au.raw_user_meta_data->>'name', '') from position(' ' in COALESCE(au.raw_user_meta_data->>'name', '')) + 1)
        ELSE NULL 
    END
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
