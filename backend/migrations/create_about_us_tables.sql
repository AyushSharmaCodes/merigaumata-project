-- Create tables for About Us page content

-- 1. About Cards (Mission & Vision)
CREATE TABLE IF NOT EXISTS about_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Impact Stats
CREATE TABLE IF NOT EXISTS about_impact_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Timeline (Our Story)
CREATE TABLE IF NOT EXISTS about_timeline (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year TEXT NOT NULL,
    month TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Team Members
CREATE TABLE IF NOT EXISTS about_team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    bio TEXT NOT NULL,
    image_url TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Future Goals
CREATE TABLE IF NOT EXISTS about_future_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. About Settings (Footer & Visibility)
CREATE TABLE IF NOT EXISTS about_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    footer_description TEXT DEFAULT '',
    section_visibility JSONB DEFAULT '{
        "missionVision": true,
        "impactStats": true,
        "ourStory": true,
        "team": true,
        "futureGoals": true,
        "callToAction": true
    }'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings row if not exists
INSERT INTO about_settings (id, footer_description)
SELECT gen_random_uuid(), 'Dedicated to the welfare and protection of cows.'
WHERE NOT EXISTS (SELECT 1 FROM about_settings);

-- Enable RLS
ALTER TABLE about_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_impact_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_future_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (Public Read, Admin Write)

-- About Cards
CREATE POLICY "Public read access" ON about_cards FOR SELECT TO public USING (true);
CREATE POLICY "Admin full access" ON about_cards FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Impact Stats
CREATE POLICY "Public read access" ON about_impact_stats FOR SELECT TO public USING (true);
CREATE POLICY "Admin full access" ON about_impact_stats FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Timeline
CREATE POLICY "Public read access" ON about_timeline FOR SELECT TO public USING (true);
CREATE POLICY "Admin full access" ON about_timeline FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Team Members
CREATE POLICY "Public read access" ON about_team_members FOR SELECT TO public USING (true);
CREATE POLICY "Admin full access" ON about_team_members FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Future Goals
CREATE POLICY "Public read access" ON about_future_goals FOR SELECT TO public USING (true);
CREATE POLICY "Admin full access" ON about_future_goals FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Settings
CREATE POLICY "Public read access" ON about_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admin full access" ON about_settings FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
