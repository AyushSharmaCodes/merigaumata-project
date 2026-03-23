-- Migration: Update Invoice Status Enum
-- Description: Add missing status values to invoice_status enum to prevent query failures

-- Use DO block for safety, though ADD VALUE IF NOT EXISTS is also standard in newer PG
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'invoice_status' AND e.enumlabel = 'paid') THEN
        ALTER TYPE invoice_status ADD VALUE 'paid';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'invoice_status' AND e.enumlabel = 'processed') THEN
        ALTER TYPE invoice_status ADD VALUE 'processed';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'invoice_status' AND e.enumlabel = 'cancelled') THEN
        ALTER TYPE invoice_status ADD VALUE 'cancelled';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'invoice_status' AND e.enumlabel = 'issued') THEN
        ALTER TYPE invoice_status ADD VALUE 'issued';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'invoice_status' AND e.enumlabel = 'partially_refunded') THEN
        ALTER TYPE invoice_status ADD VALUE 'partially_refunded';
    END IF;
END $$;
