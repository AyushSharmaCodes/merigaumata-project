-- Create phone_numbers table
CREATE TABLE IF NOT EXISTS public.phone_numbers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    label VARCHAR(50) DEFAULT 'Mobile', -- e.g., Mobile, Home, Work
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure phone number is unique per user
    UNIQUE(user_id, phone_number)
);

-- Add indexes
CREATE INDEX idx_phone_numbers_user_id ON public.phone_numbers(user_id);

-- Enable RLS
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own phone numbers"
    ON public.phone_numbers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own phone numbers"
    ON public.phone_numbers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phone numbers"
    ON public.phone_numbers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own phone numbers"
    ON public.phone_numbers FOR DELETE
    USING (auth.uid() = user_id);

-- Add phone_number_id to addresses table
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES public.phone_numbers(id);

-- Create index for the foreign key
CREATE INDEX idx_addresses_phone_number_id ON public.addresses(phone_number_id);
