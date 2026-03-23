--  FAQ System Setup Migration
-- This migration creates the FAQs table and uses the existing categories table

-- FAQs Table
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category_id);
CREATE INDEX IF NOT EXISTS idx_faqs_display_order ON faqs(display_order);
CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Public can view active FAQs" ON faqs;
DROP POLICY IF EXISTS "Service role can manage FAQs" ON faqs;

-- Policy: Allow anyone to read active FAQs with active categories
CREATE POLICY "Public can view active FAQs" 
    ON faqs 
    FOR SELECT 
    USING (
        is_active = true 
        AND EXISTS (
            SELECT 1 FROM categories 
            WHERE categories.id = faqs.category_id
        )
    );

-- Policy: Service role can manage all FAQs (admin)
CREATE POLICY "Service role can manage FAQs" 
    ON faqs 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_faqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS faqs_updated_at ON faqs;

-- Trigger to automatically update updated_at
CREATE TRIGGER faqs_updated_at
    BEFORE UPDATE ON faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_faqs_updated_at();

-- Insert sample FAQs
-- Note: This uses categories with type='faq' that already exist in the categories table
-- Categories: General, Products, Shipping, Returns, Account
INSERT INTO faqs (question, answer, category_id, display_order, is_active)
SELECT 
    'What is Gaushala''s mission?',
    'Our mission is to provide a safe haven for cows, protect them from harm, and promote their welfare while preserving traditional Vedic values. We are dedicated to creating awareness about the importance of cow protection and sustainable farming practices that benefit both animals and the environment.',
    id,
    1,
    true
FROM categories WHERE name = 'General' AND type = 'faq'
UNION ALL
SELECT
    'How can I contact customer support?',
    'You can reach our customer support team via email at support@gaushala.com, call us at +91-XXX-XXX-XXXX, or use the contact form on our website. Our support hours are Monday to Saturday, 9 AM to 6 PM IST.',
    id,
    2,
    true
FROM categories WHERE name = 'General' AND type = 'faq'
UNION ALL
SELECT
    'Do you provide veterinary services?',
    'Yes, we have a fully equipped veterinary facility with experienced vets who provide regular check-ups, emergency care, and treatment for all our cows. We also offer veterinary consultation for cow owners in the community.',
    id,
    3,
    true
FROM categories WHERE name = 'General' AND type = 'faq'
UNION ALL
SELECT
    'What products do you offer?',
    'We offer a range of authentic, cow-based products including pure ghee, paneer, traditional sweets, and organic dairy products. All products are made using traditional methods and come from cows raised in our Gaushala with love and care.',
    id,
    1,
    true
FROM categories WHERE name = 'Products' AND type = 'faq'
UNION ALL
SELECT
    'Are your products organic and chemical-free?',
    'Yes, absolutely! All our products are 100% organic and free from harmful chemicals, preservatives, and additives. We follow traditional Ayurvedic and Vedic practices in producing our dairy products, ensuring the highest quality and purity.',
    id,
    2,
    true
FROM categories WHERE name = 'Products' AND type = 'faq'
UNION ALL
SELECT
    'What is the shelf life of your products?',
    'Our products have varying shelf lives. Pure ghee lasts 12+ months when stored properly, paneer should be consumed within 3-4 days, and sweets within 5-7 days. All products come with manufacturing and expiry dates clearly marked on the packaging.',
    id,
    3,
    true
FROM categories WHERE name = 'Products' AND type = 'faq'
UNION ALL
SELECT
    'Do you ship across India?',
    'Yes, we ship to all major cities and towns across India. We use reliable courier services to ensure your products reach you fresh and in perfect condition. Remote areas may have extended delivery times.',
    id,
    1,
    true
FROM categories WHERE name = 'Shipping' AND type = 'faq'
UNION ALL
SELECT
    'What are the shipping charges?',
    'Shipping charges vary based on your location and order value. Orders above ₹999 qualify for free shipping. For orders below ₹999, shipping charges range from ₹50 to ₹150 depending on the delivery location.',
    id,
    2,
    true
FROM categories WHERE name = 'Shipping' AND type = 'faq'
UNION ALL
SELECT
    'How long does delivery take?',
    'Delivery typically takes 3-7 business days for most locations. Metro cities receive deliveries within 2-4 days, while remote areas may take up to 10 days. You will receive a tracking number once your order is shipped.',
    id,
    3,
    true
FROM categories WHERE name = 'Shipping' AND type = 'faq'
UNION ALL
SELECT
    'What is your return policy?',
    'We accept returns within 7 days of delivery if the product is damaged, defective, or not as described. Perishable items like paneer and sweets cannot be returned unless damaged during shipping. Please contact us with photos for return approval.',
    id,
    1,
    true
FROM categories WHERE name = 'Returns' AND type = 'faq'
UNION ALL
SELECT
    'How do I initiate a return?',
    'To initiate a return, please email us at returns@gaushala.com with your order number, reason for return, and photos of the product. Our team will review and provide return instructions within 24 hours.',
    id,
    2,
    true
FROM categories WHERE name = 'Returns' AND type = 'faq'
UNION ALL
SELECT
    'When will I receive my refund?',
    'Refunds are processed within 5-7 business days after we receive the returned product. The amount will be credited to your original payment method. Bank transfers may take an additional 3-5 days to reflect in your account.',
    id,
    3,
    true
FROM categories WHERE name = 'Returns' AND type = 'faq'
UNION ALL
SELECT
    'How do I create an account?',
    'Click on the "Sign Up" button in the top right corner of our website. Fill in your details including name, email, phone number, and create a password. You will receive a verification email to activate your account.',
    id,
    1,
    true
FROM categories WHERE name = 'Account' AND type = 'faq'
UNION ALL
SELECT
    'Can I change my delivery address?',
    'Yes, you can update your delivery address in your account settings. If you need to change the address for an order already placed, please contact us immediately. Address changes are only possible before the order is shipped.',
    id,
    2,
    true
FROM categories WHERE name = 'Account' AND type = 'faq'
UNION ALL
SELECT
    'How do I track my order?',
    'Once your order is shipped, you will receive an email and SMS with a tracking link. You can also view order status by logging into your account and going to "My Orders". Click on the specific order to see detailed tracking information.',
    id,
    3,
    true
FROM categories WHERE name = 'Account' AND type = 'faq';
