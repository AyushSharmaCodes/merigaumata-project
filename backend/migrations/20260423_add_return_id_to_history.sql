-- Migration: Add return_id to order_status_history for per-return request tracking
-- Date: 2026-04-23

DO $$ 
BEGIN 
    -- 1. Add return_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_status_history' AND column_name = 'return_id') THEN
        ALTER TABLE public.order_status_history ADD COLUMN return_id UUID;
    END IF;

    -- 2. Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_status_history_return_id_fkey') THEN
        ALTER TABLE public.order_status_history
        ADD CONSTRAINT order_status_history_return_id_fkey
        FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Create index for faster filtering by return_id
CREATE INDEX IF NOT EXISTS idx_order_status_history_return_id ON public.order_status_history(return_id);
