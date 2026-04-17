-- ==========================================
-- 2026-04-17: Master QC System Implementation
-- ==========================================

-- 1. Profiles Update for Fraud Detection
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- 2. Products Update for Nuanced Logistics
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_logistics_fee NUMERIC(10,2) DEFAULT 0;

-- 3. QC Audit Table
CREATE TABLE IF NOT EXISTS public.qc_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    return_item_id UUID NOT NULL REFERENCES public.return_items(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    auditor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed')),
    reason_code VARCHAR(50), -- CUSTOMER_DAMAGE, USED_OR_WORN, etc.
    severity INTEGER DEFAULT 0, -- 0-100
    deduction_amount NUMERIC(10,2) DEFAULT 0,
    reverse_logistics_cost NUMERIC(10,2) DEFAULT 0,
    action_taken VARCHAR(50), -- PARTIAL_REFUND, ZERO_REFUND, RETURN_TO_CUSTOMER, DISPOSE
    inventory_action VARCHAR(50), -- DAMAGED, SCRAP, REFURBISHABLE, BLOCKED
    is_fraud_flagged BOOLEAN DEFAULT false,
    evidence_urls TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS and Policies for QC Audits
ALTER TABLE public.qc_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can manage QC Audits" ON public.qc_audits;
CREATE POLICY "Admins and Managers can manage QC Audits" ON public.qc_audits
    FOR ALL USING (public.is_admin_or_manager())
    WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Users can view QC audits for their own orders" ON public.qc_audits;
CREATE POLICY "Users can view QC audits for their own orders" ON public.qc_audits
    FOR SELECT USING (public.user_owns_order(order_id));

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS qc_audits_updated_at ON public.qc_audits;
CREATE TRIGGER qc_audits_updated_at BEFORE UPDATE ON public.qc_audits
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 6. Indices for performance
CREATE INDEX IF NOT EXISTS idx_qc_audits_return_id ON public.qc_audits(return_id);
CREATE INDEX IF NOT EXISTS idx_qc_audits_order_id ON public.qc_audits(order_id);
CREATE INDEX IF NOT EXISTS idx_qc_audits_status ON public.qc_audits(status);
