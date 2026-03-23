-- Add event_code to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_code VARCHAR(100) UNIQUE;

-- Function to generate event_code
CREATE OR REPLACE FUNCTION generate_event_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_code IS NULL THEN
        -- Format: EVT-<First 3 chars of Title>-<Random 4 chars>
        -- e.g. EVT-KAT-1234
        NEW.event_code := 'EVT-' || 
                          UPPER(SUBSTRING(REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                          '-' || 
                          UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 4));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate event_code
DROP TRIGGER IF EXISTS trigger_generate_event_code ON events;
CREATE TRIGGER trigger_generate_event_code
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION generate_event_code();

-- Backpopulate existing events
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, title FROM events WHERE event_code IS NULL LOOP
        UPDATE events 
        SET event_code = 'EVT-' || 
                         UPPER(SUBSTRING(REGEXP_REPLACE(r.title, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                         '-' || 
                         UPPER(SUBSTRING(MD5(r.id::text || NOW()::text) FROM 1 FOR 4))
        WHERE id = r.id;
    END LOOP;
END $$;
