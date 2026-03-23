-- Create contact_office_hours table
CREATE TABLE IF NOT EXISTS contact_office_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT NOT NULL, -- e.g., "Monday", "Tuesday"
    open_time TEXT, -- e.g., "09:00 AM"
    close_time TEXT, -- e.g., "06:00 PM"
    is_closed BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contact_office_hours ENABLE ROW LEVEL SECURITY;

-- Policies for contact_office_hours
DROP POLICY IF EXISTS "Public can view office hours" ON contact_office_hours;
CREATE POLICY "Public can view office hours" ON contact_office_hours FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage office hours" ON contact_office_hours;
CREATE POLICY "Service role can manage office hours" ON contact_office_hours FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS contact_office_hours_updated_at ON contact_office_hours;
CREATE TRIGGER contact_office_hours_updated_at BEFORE UPDATE ON contact_office_hours FOR EACH ROW EXECUTE FUNCTION update_contact_updated_at();

-- Insert initial data if empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM contact_office_hours) THEN
        INSERT INTO contact_office_hours (day_of_week, open_time, close_time, display_order)
        VALUES 
            ('Monday', '9:00 AM', '6:00 PM', 1),
            ('Tuesday', '9:00 AM', '6:00 PM', 2),
            ('Wednesday', '9:00 AM', '6:00 PM', 3),
            ('Thursday', '9:00 AM', '6:00 PM', 4),
            ('Friday', '9:00 AM', '6:00 PM', 5),
            ('Saturday', '10:00 AM', '4:00 PM', 6);

        INSERT INTO contact_office_hours (day_of_week, is_closed, display_order)
        VALUES 
            ('Sunday', true, 7);
    END IF;
END $$;
