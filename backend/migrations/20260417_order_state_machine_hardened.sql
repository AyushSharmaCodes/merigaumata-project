-- ==========================================
-- ORDER & REFUND STATE MACHINE HARDENING
-- Date: 2026-04-17
-- Description: Adds persistent state tracking for decoupled order-refund lifecycle.
-- ==========================================

-- 1. ENHANCE ORDERS TABLE
DO $$
BEGIN
    -- Add previous_state if not exists (required for RTO/Return Reversion)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'previous_state') THEN
        ALTER TABLE public.orders ADD COLUMN previous_state TEXT;
    END IF;
END $$;

-- 2. ENHANCE ORDER STATUS HISTORY
DO $$
BEGIN
    -- Add event_type (e.g., STATUS_CHANGE, REFUND_INITIATED, COMMUNICATION_SENT)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_status_history' AND column_name = 'event_type') THEN
        ALTER TABLE public.order_status_history ADD COLUMN event_type TEXT DEFAULT 'STATUS_CHANGE';
    END IF;

    -- Add metadata (for rich timeline: Razorpay IDs, specific notes, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_status_history' AND column_name = 'metadata') THEN
        ALTER TABLE public.order_status_history ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. UPDATE RETURNS STATUS CONSTRAINTS
-- We use a flexible approach if the constraint exists, otherwise no action needed.
DO $$
BEGIN
    -- Only try to modify if we find a constraint related to return status
    -- Currently expanding TO include 'picked_up'
    ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
    ALTER TABLE public.returns ADD CONSTRAINT returns_status_check CHECK (status IN ('requested', 'approved', 'rejected', 'completed', 'picked_up'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Skipping returns_status_check update: %', SQLERRM;
END $$;

-- 4. PERFORMANCE OPTIMIZATION
-- Create composite index for the Unified Roadmap visualizer
CREATE INDEX IF NOT EXISTS idx_order_status_history_tracking 
ON public.order_status_history(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_previous_state 
ON public.orders(previous_state) WHERE previous_state IS NOT NULL;

-- 5. PERMISSIONS (RLS)
-- Ensure order history is manageable by admins/managers through the system
DROP POLICY IF EXISTS "Admins can manage order history" ON public.order_status_history;
CREATE POLICY "Admins can manage order history" 
ON public.order_status_history FOR ALL 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());
