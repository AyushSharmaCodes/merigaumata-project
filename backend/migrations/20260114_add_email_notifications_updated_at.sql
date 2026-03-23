-- Migration: Add updated_at column to email_notifications table
-- This column was missing from the original schema

ALTER TABLE email_notifications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Set default value for new rows
ALTER TABLE email_notifications 
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Update existing rows to have updated_at = sent_at or created_at
UPDATE email_notifications 
SET updated_at = COALESCE(sent_at, created_at) 
WHERE updated_at IS NULL;
