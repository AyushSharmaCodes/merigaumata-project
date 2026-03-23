-- Events Table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    location JSONB NOT NULL, -- { address: string, lat: number, lng: number }
    image TEXT,
    capacity INTEGER,
    registrations INTEGER DEFAULT 0,
    registration_amount DECIMAL(10, 2) DEFAULT 0,
    category TEXT, -- 'workshop', 'ceremony', 'other'
    status TEXT DEFAULT 'upcoming', -- 'upcoming', 'ongoing', 'completed'
    katha_vachak TEXT,
    contact_address TEXT,
    is_registration_enabled BOOLEAN DEFAULT true,
    key_highlights TEXT[] DEFAULT '{}',
    special_privileges TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Create index on start_date for sorting
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now
CREATE POLICY "Enable all operations for events" ON events
    FOR ALL
    USING (true)
    WITH CHECK (true);
