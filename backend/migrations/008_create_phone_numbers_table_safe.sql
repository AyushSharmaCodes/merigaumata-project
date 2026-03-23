-- Safe migration: Only add what's missing

-- Add phone_number_id to addresses table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'addresses' 
        AND column_name = 'phone_number_id'
    ) THEN
        ALTER TABLE public.addresses 
        ADD COLUMN phone_number_id UUID REFERENCES public.phone_numbers(id);
        
        CREATE INDEX idx_addresses_phone_number_id ON public.addresses(phone_number_id);
    END IF;
END $$;
