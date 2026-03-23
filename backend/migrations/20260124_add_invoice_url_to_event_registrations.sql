-- Add invoice_url column to event_registrations table
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS invoice_url TEXT DEFAULT NULL;

-- Log the change
DO $$
BEGIN
    RAISE NOTICE 'Added invoice_url column to event_registrations table';
END $$;
