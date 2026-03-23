-- Create carts table for storing user shopping carts
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    applied_coupon_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart_items table for individual items in the cart
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cart_id, product_id) -- Prevent duplicate products in same cart
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Function to update cart updated_at timestamp
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE carts SET updated_at = NOW() WHERE id = NEW.cart_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cart timestamp when items are added/updated/removed
CREATE TRIGGER update_cart_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_cart_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (user-specific access should be enforced at API level)
CREATE POLICY "Enable all operations for carts" ON carts
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for cart_items" ON cart_items
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE carts IS 'Stores user shopping carts with applied coupon codes';
COMMENT ON TABLE cart_items IS 'Stores individual items within shopping carts';
COMMENT ON COLUMN carts.user_id IS 'Reference to the user who owns this cart';
COMMENT ON COLUMN carts.applied_coupon_code IS 'Currently applied coupon code (if any)';
COMMENT ON COLUMN cart_items.cart_id IS 'Reference to the parent cart';
COMMENT ON COLUMN cart_items.product_id IS 'Reference to the product in the cart';
COMMENT ON COLUMN cart_items.quantity IS 'Quantity of this product in the cart (must be > 0)';
