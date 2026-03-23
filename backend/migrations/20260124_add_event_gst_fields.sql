-- Add GST fields to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMP WITH TIME ZONE;

-- Add GST fields to event_registrations table
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10, 2) DEFAULT 0;

-- Comment on columns for clarity
COMMENT ON COLUMN events.gst_rate IS 'GST Rate selected (e.g., 0, 5, 12, 18)';
COMMENT ON COLUMN events.base_price IS 'Calculated base price (Total / (1 + Rate/100))';
COMMENT ON COLUMN events.gst_amount IS 'Calculated GST amount (Total - Base Price)';
COMMENT ON COLUMN events.registration_deadline IS 'Deadline for event registration. If null, registration is open until event start.';

COMMENT ON COLUMN event_registrations.gst_rate IS 'GST Rate at the time of registration';
COMMENT ON COLUMN event_registrations.base_price IS 'Base price at the time of registration';
COMMENT ON COLUMN event_registrations.gst_amount IS 'GST amount at the time of registration';
