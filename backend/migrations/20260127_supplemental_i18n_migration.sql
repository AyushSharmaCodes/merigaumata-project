-- ========================================================
-- SUPPLEMENTAL i18n DATABASE MIGRATION
-- Adds localization support to missing UI-facing tables
-- ========================================================

BEGIN;

-- 1. CATEGORIES TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_name_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='name') THEN
      EXECUTE 'UPDATE categories SET display_name_i18n = jsonb_build_object(''en'', name, ''hi'', name)';
    END IF;
  END IF;
END $$;

-- 2. CAROUSEL SLIDES TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'carousel_slides') THEN
    ALTER TABLE carousel_slides ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE carousel_slides ADD COLUMN IF NOT EXISTS subtitle_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carousel_slides' AND column_name='title') THEN
      EXECUTE 'UPDATE carousel_slides SET 
        title_i18n = jsonb_build_object(''en'', title, ''hi'', title),
        subtitle_i18n = jsonb_build_object(''en'', COALESCE(subtitle, ''''), ''hi'', COALESCE(subtitle, ''''))';
    END IF;
  END IF;
END $$;

-- 3. BANK DETAILS TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_details') THEN
    ALTER TABLE bank_details ADD COLUMN IF NOT EXISTS account_name_i18n JSONB DEFAULT '{}';
    ALTER TABLE bank_details ADD COLUMN IF NOT EXISTS bank_name_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_details' AND column_name='account_name') THEN
      EXECUTE 'UPDATE bank_details SET 
        account_name_i18n = jsonb_build_object(''en'', account_name, ''hi'', account_name),
        bank_name_i18n = jsonb_build_object(''en'', bank_name, ''hi'', bank_name)';
    END IF;
  END IF;
END $$;

-- 4. EMAIL NOTIFICATIONS TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_notifications') THEN
    ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS content_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_notifications' AND column_name='title') THEN
      EXECUTE 'UPDATE email_notifications SET 
        title_i18n = jsonb_build_object(''en'', title, ''hi'', title),
        content_i18n = jsonb_build_object(''en'', content, ''hi'', content)';
    END IF;
  END IF;
END $$;

-- 5. NEWSLETTER CONFIG TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_config') THEN
    ALTER TABLE newsletter_config ADD COLUMN IF NOT EXISTS sender_name_i18n JSONB DEFAULT '{}';
    ALTER TABLE newsletter_config ADD COLUMN IF NOT EXISTS footer_text_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='newsletter_config' AND column_name='sender_name') THEN
      EXECUTE 'UPDATE newsletter_config SET 
        sender_name_i18n = jsonb_build_object(''en'', COALESCE(sender_name, ''''), ''hi'', COALESCE(sender_name, '''')),
        footer_text_i18n = jsonb_build_object(''en'', COALESCE(footer_text, ''''), ''hi'', COALESCE(footer_text, ''''))';
    END IF;
  END IF;
END $$;

-- 6. SOCIAL MEDIA TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'social_media') THEN
    ALTER TABLE social_media ADD COLUMN IF NOT EXISTS platform_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_media' AND column_name='platform') THEN
      EXECUTE 'UPDATE social_media SET platform_i18n = jsonb_build_object(''en'', platform, ''hi'', platform)';
    END IF;
  END IF;
END $$;

COMMIT;
