-- Make performed_by nullable to support system/service-role deletions
ALTER TABLE public.comment_moderation_log ALTER COLUMN performed_by DROP NOT NULL;
