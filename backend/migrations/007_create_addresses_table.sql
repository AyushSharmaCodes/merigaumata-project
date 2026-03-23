-- Create addresses table for user address management
-- Supports multiple addresses per user with type constraints

CREATE TABLE IF NOT EXISTS public.addresses (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign key
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Address type with constraints
    type VARCHAR(20) NOT NULL CHECK (type IN ('home', 'work', 'other')),
    
    -- Primary address flag (only one per user)
    is_primary BOOLEAN DEFAULT false,
    
    -- Address fields
    street_address TEXT NOT NULL,
    apartment VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    
    -- Additional info
    label VARCHAR(100), -- Optional custom label like "Mom's House", "Office"
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX idx_addresses_type ON public.addresses(type);
CREATE INDEX idx_addresses_is_primary ON public.addresses(is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own addresses
CREATE POLICY "Users can view own addresses"
ON public.addresses FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own addresses
CREATE POLICY "Users can create own addresses"
ON public.addresses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own addresses
CREATE POLICY "Users can update own addresses"
ON public.addresses FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
ON public.addresses FOR DELETE
USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_addresses_timestamp
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_addresses_updated_at();

-- Function to ensure only one primary address per user
CREATE OR REPLACE FUNCTION ensure_one_primary_address()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting an address as primary, unset all other primary addresses for this user
    IF NEW.is_primary = true THEN
        UPDATE public.addresses 
        SET is_primary = false 
        WHERE user_id = NEW.user_id 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    END IF;
    
    -- If this is the user's first address, make it primary by default
    IF NOT EXISTS (
        SELECT 1 FROM public.addresses 
        WHERE user_id = NEW.user_id 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
        NEW.is_primary = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_primary_address
    BEFORE INSERT OR UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_one_primary_address();

-- Function to enforce one home and one work address per user
CREATE OR REPLACE FUNCTION check_address_type_limit()
RETURNS TRIGGER AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    -- Only check for home and work types
    IF NEW.type IN ('home', 'work') THEN
        SELECT COUNT(*) INTO existing_count
        FROM public.addresses
        WHERE user_id = NEW.user_id 
        AND type = NEW.type
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
        
        IF existing_count > 0 THEN
            RAISE EXCEPTION 'User can only have one % address', NEW.type;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_address_type_limit_trigger
    BEFORE INSERT OR UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION check_address_type_limit();

-- Add helpful comments
COMMENT ON TABLE public.addresses IS 'User addresses with type constraints (one home, one work, multiple other)';
COMMENT ON COLUMN public.addresses.type IS 'Address type: home (max 1), work (max 1), or other (unlimited)';
COMMENT ON COLUMN public.addresses.is_primary IS 'Primary address flag - only one per user (enforced by trigger)';
