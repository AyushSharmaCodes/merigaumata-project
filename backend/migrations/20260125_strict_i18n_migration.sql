-- ========================================================
-- STRICT i18n DATABASE MIGRATION
-- Converts text columns to JSONB objects: { "en": "...", "hi": "..." }
-- ========================================================

BEGIN;

-- 0. CORE (User Preferences)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi'));

-- 1. PRODUCTS TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits_i18n JSONB DEFAULT '{}';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='title') THEN
      EXECUTE 'UPDATE products SET 
        title_i18n = jsonb_build_object(''en'', title, ''hi'', title),
        description_i18n = jsonb_build_object(''en'', description, ''hi'', description),
        benefits_i18n = jsonb_build_object(''en'', benefits, ''hi'', benefits)';
    END IF;
  END IF;
END $$;

-- 2. BLOGS TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blogs') THEN
    ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS excerpt_i18n JSONB DEFAULT '{}';
    ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS content_i18n JSONB DEFAULT '{}';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blogs' AND column_name='title') THEN
      EXECUTE 'UPDATE public.blogs SET 
        title_i18n = jsonb_build_object(''en'', title, ''hi'', title),
        excerpt_i18n = jsonb_build_object(''en'', excerpt, ''hi'', excerpt),
        content_i18n = jsonb_build_object(''en'', content, ''hi'', content)';
    END IF;
  END IF;
END $$;

-- 3. EVENTS TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    ALTER TABLE events ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS key_highlights_i18n JSONB DEFAULT '{}';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS special_privileges_i18n JSONB DEFAULT '{}';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='title') THEN
      EXECUTE 'UPDATE events SET 
        title_i18n = jsonb_build_object(''en'', title, ''hi'', title),
        description_i18n = jsonb_build_object(''en'', description, ''hi'', description),
        key_highlights_i18n = jsonb_build_object(''en'', key_highlights, ''hi'', key_highlights),
        special_privileges_i18n = jsonb_build_object(''en'', special_privileges, ''hi'', special_privileges)';
    END IF;
  END IF;
END $$;

-- 4. FAQs TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'faqs') THEN
    ALTER TABLE faqs ADD COLUMN IF NOT EXISTS question_i18n JSONB DEFAULT '{}';
    ALTER TABLE faqs ADD COLUMN IF NOT EXISTS answer_i18n JSONB DEFAULT '{}';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='faqs' AND column_name='question') THEN
      EXECUTE 'UPDATE faqs SET 
        question_i18n = jsonb_build_object(''en'', question, ''hi'', question),
        answer_i18n = jsonb_build_object(''en'', answer, ''hi'', answer)';
    END IF;
  END IF;
END $$;

-- 5. ABOUT TABLES
DO $$ BEGIN
  -- about_cards
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'about_cards') THEN
    ALTER TABLE about_cards ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE about_cards ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='about_cards' AND column_name='title') THEN
      EXECUTE 'UPDATE about_cards SET title_i18n = jsonb_build_object(''en'', title, ''hi'', title), description_i18n = jsonb_build_object(''en'', description, ''hi'', description)';
    END IF;
  END IF;

  -- about_impact_stats
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'about_impact_stats') THEN
    ALTER TABLE about_impact_stats ADD COLUMN IF NOT EXISTS label_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='about_impact_stats' AND column_name='label') THEN
      EXECUTE 'UPDATE about_impact_stats SET label_i18n = jsonb_build_object(''en'', label, ''hi'', label)';
    END IF;
  END IF;

  -- about_timeline
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'about_timeline') THEN
    ALTER TABLE about_timeline ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE about_timeline ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='about_timeline' AND column_name='title') THEN
      EXECUTE 'UPDATE about_timeline SET title_i18n = jsonb_build_object(''en'', title, ''hi'', title), description_i18n = jsonb_build_object(''en'', description, ''hi'', description)';
    END IF;
  END IF;

  -- about_team_members
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'about_team_members') THEN
    ALTER TABLE about_team_members ADD COLUMN IF NOT EXISTS role_i18n JSONB DEFAULT '{}';
    ALTER TABLE about_team_members ADD COLUMN IF NOT EXISTS bio_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='about_team_members' AND column_name='role') THEN
      EXECUTE 'UPDATE about_team_members SET role_i18n = jsonb_build_object(''en'', role, ''hi'', role), bio_i18n = jsonb_build_object(''en'', bio, ''hi'', bio)';
    END IF;
  END IF;

  -- about_future_goals
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'about_future_goals') THEN
    ALTER TABLE about_future_goals ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE about_future_goals ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='about_future_goals' AND column_name='title') THEN
      EXECUTE 'UPDATE about_future_goals SET title_i18n = jsonb_build_object(''en'', title, ''hi'', title), description_i18n = jsonb_build_object(''en'', description, ''hi'', description)';
    END IF;
  END IF;

  -- about_settings
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'about_settings') THEN
    ALTER TABLE about_settings ADD COLUMN IF NOT EXISTS footer_description_i18n JSONB DEFAULT '{}';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='about_settings' AND column_name='footer_description') THEN
      EXECUTE 'UPDATE about_settings SET footer_description_i18n = jsonb_build_object(''en'', footer_description, ''hi'', footer_description)';
    END IF;
  END IF;
END $$;

-- 6. POLICIES TABLE
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'policy_pages') THEN
    ALTER TABLE policy_pages ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
    ALTER TABLE policy_pages ADD COLUMN IF NOT EXISTS content_html_i18n JSONB DEFAULT '{}';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='policy_pages' AND column_name='title') THEN
      EXECUTE 'UPDATE policy_pages SET 
        title_i18n = jsonb_build_object(''en'', title, ''hi'', title),
        content_html_i18n = jsonb_build_object(''en'', content_html, ''hi'', content_html)';
    END IF;
  END IF;
END $$;

COMMIT;
