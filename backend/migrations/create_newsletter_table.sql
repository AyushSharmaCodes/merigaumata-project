-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT true,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create newsletter_config table (singleton)
CREATE TABLE IF NOT EXISTS newsletter_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name TEXT NOT NULL DEFAULT 'Gau Gyaan',
    sender_email TEXT NOT NULL DEFAULT 'newsletter@gaugyan.com',
    footer_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_config ENABLE ROW LEVEL SECURITY;

-- Policies for newsletter_subscribers
DROP POLICY IF EXISTS "Public can subscribe" ON newsletter_subscribers;
CREATE POLICY "Public can subscribe" ON newsletter_subscribers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage subscribers" ON newsletter_subscribers;
CREATE POLICY "Service role can manage subscribers" ON newsletter_subscribers FOR ALL USING (true) WITH CHECK (true);

-- Policies for newsletter_config
DROP POLICY IF EXISTS "Public can view config" ON newsletter_config;
CREATE POLICY "Public can view config" ON newsletter_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage config" ON newsletter_config;
CREATE POLICY "Service role can manage config" ON newsletter_config FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_is_active ON newsletter_subscribers(is_active);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_subscribed_at ON newsletter_subscribers(subscribed_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_newsletter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS newsletter_subscribers_updated_at ON newsletter_subscribers;
CREATE TRIGGER newsletter_subscribers_updated_at 
    BEFORE UPDATE ON newsletter_subscribers 
    FOR EACH ROW EXECUTE FUNCTION update_newsletter_updated_at();

DROP TRIGGER IF EXISTS newsletter_config_updated_at ON newsletter_config;
CREATE TRIGGER newsletter_config_updated_at 
    BEFORE UPDATE ON newsletter_config 
    FOR EACH ROW EXECUTE FUNCTION update_newsletter_updated_at();

-- Insert default config if empty
INSERT INTO newsletter_config (sender_name, sender_email, footer_text)
SELECT 
    'Gau Gyaan Newsletter',
    'newsletter@gaugyan.com',
    'Thank you for subscribing to our newsletter. You can unsubscribe at any time.'
WHERE NOT EXISTS (SELECT 1 FROM newsletter_config);
