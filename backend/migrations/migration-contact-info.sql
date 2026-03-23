-- Create contact_info table (for address and general info)
CREATE TABLE IF NOT EXISTS contact_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT DEFAULT 'India',
    google_maps_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contact_phones table
CREATE TABLE IF NOT EXISTS contact_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL,
    label TEXT, -- e.g., "Support", "Sales"
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contact_emails table
CREATE TABLE IF NOT EXISTS contact_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    label TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;

-- Policies for contact_info
DROP POLICY IF EXISTS "Public can view contact info" ON contact_info;
CREATE POLICY "Public can view contact info" ON contact_info FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage contact info" ON contact_info;
CREATE POLICY "Service role can manage contact info" ON contact_info FOR ALL USING (true) WITH CHECK (true);

-- Policies for contact_phones
DROP POLICY IF EXISTS "Public can view active phones" ON contact_phones;
CREATE POLICY "Public can view active phones" ON contact_phones FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage phones" ON contact_phones;
CREATE POLICY "Service role can manage phones" ON contact_phones FOR ALL USING (true) WITH CHECK (true);

-- Policies for contact_emails
DROP POLICY IF EXISTS "Public can view active emails" ON contact_emails;
CREATE POLICY "Public can view active emails" ON contact_emails FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage emails" ON contact_emails;
CREATE POLICY "Service role can manage emails" ON contact_emails FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_info_updated_at ON contact_info;
CREATE TRIGGER contact_info_updated_at BEFORE UPDATE ON contact_info FOR EACH ROW EXECUTE FUNCTION update_contact_updated_at();

DROP TRIGGER IF EXISTS contact_phones_updated_at ON contact_phones;
CREATE TRIGGER contact_phones_updated_at BEFORE UPDATE ON contact_phones FOR EACH ROW EXECUTE FUNCTION update_contact_updated_at();

DROP TRIGGER IF EXISTS contact_emails_updated_at ON contact_emails;
CREATE TRIGGER contact_emails_updated_at BEFORE UPDATE ON contact_emails FOR EACH ROW EXECUTE FUNCTION update_contact_updated_at();

-- Insert initial data if empty
INSERT INTO contact_info (address_line1, city, state, pincode)
SELECT '123 Gau Seva Road', 'Vrindavan', 'Uttar Pradesh', '281121'
WHERE NOT EXISTS (SELECT 1 FROM contact_info);

INSERT INTO contact_phones (number, label, is_primary, display_order)
SELECT '+91 98765 43210', 'Support', true, 1
WHERE NOT EXISTS (SELECT 1 FROM contact_phones);

INSERT INTO contact_emails (email, label, is_primary, display_order)
SELECT 'info@gaushala.org', 'General', true, 1
WHERE NOT EXISTS (SELECT 1 FROM contact_emails);
