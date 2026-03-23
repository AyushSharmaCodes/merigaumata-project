-- Migration: Create tables for Item-Level Partial Returns
-- 1. order_items: Normalized storage of items in an order
-- 2. returns: Return requests
-- 3. return_items: Items included in a return request
-- 4. refunds: Razorpay refund logs

-- 1. Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    title TEXT, -- Snapshot of title
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
    is_returnable BOOLEAN DEFAULT TRUE,
    returned_quantity INTEGER DEFAULT 0 CHECK (returned_quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add constraint to ensure returned_quantity <= quantity
ALTER TABLE public.order_items 
ADD CONSTRAINT check_returned_quantity_limit 
CHECK (returned_quantity <= quantity);

-- Index for faster lookups
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- 2. Create returns table
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE NO ACTION, -- Don't delete returns if order deleted (audit trail)
    user_id UUID REFERENCES auth.users(id), -- For easier filtering
    status TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
    refund_amount DECIMAL(10, 2), -- Calculated amount eligible for refund
    reason TEXT,
    staff_notes TEXT, -- Admin internal notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_returns_order_id ON public.returns(order_id);
CREATE INDEX idx_returns_user_id ON public.returns(user_id);

-- 3. Create return_items table (Junction)
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID REFERENCES public.returns(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_return_items_return_id ON public.return_items(return_id);

-- 4. Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL, -- Keep refund log even if return deleted
    order_id UUID REFERENCES public.orders(id),
    razorpay_refund_id TEXT,
    amount DECIMAL(10, 2) NOT NULL, -- Amount refunded in main currency unit (Rupees)
    status TEXT, -- 'processed', 'pending', etc. form Razorpay
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_refunds_order_id ON public.refunds(order_id);


-- RLS Policies
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Order Items: Users can read their own order items
CREATE POLICY "Users can view own order items" ON public.order_items
    FOR SELECT USING (
        exists (
            select 1 from public.orders
            where public.orders.id = public.order_items.order_id
            and public.orders.user_id = auth.uid()
        )
    );

-- Returns: Users can create return requests for their own orders
CREATE POLICY "Users can create return requests" ON public.returns
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Returns: Users can view own returns
CREATE POLICY "Users can view own returns" ON public.returns
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Return Items: Users can insert return items (via return creation) -- simplified
-- Ideally handled by backend wrapper, but if RLS strictly enforced:
CREATE POLICY "Users can view own return items" ON public.return_items
    FOR SELECT USING (
        exists (
            select 1 from public.returns
            where public.returns.id = public.return_items.return_id
            and public.returns.user_id = auth.uid()
        )
    );
-- Allow insert if they own the parent return
CREATE POLICY "Users can insert own return items" ON public.return_items
    FOR INSERT WITH CHECK (
        exists (
            select 1 from public.returns
            where public.returns.id = return_id
            and public.returns.user_id = auth.uid()
        )
    );


-- Admin RLS (If using Service Role for admin API, these might not be needed, but good practice)
-- Grant FULL access to service role (implicit).
-- If you use authenticated admin users with role='admin':
-- Add policies for role IN ('admin', 'manager')
