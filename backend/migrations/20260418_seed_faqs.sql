-- Application FAQ Seeding Migration
-- Created: 2026-04-18
-- Goal: Provide default FAQs for cow welfare, products, orders, and donations.

BEGIN;

-- 1. Create FAQ Categories
INSERT INTO public.categories (id, name, type, category_code, name_i18n)
VALUES 
    ('f0000000-0000-0000-0000-000000000001', 'General', 'faq', 'faq-general', '{"hi": "सामान्य", "ta": "பொதுவானது", "te": "సాధారణ"}'),
    ('f0000000-0000-0000-0000-000000000002', 'Cow Welfare', 'faq', 'faq-welfare', '{"hi": "गौ कल्याण", "ta": "பசு நலன்", "te": "గో సంక్షేమం"}'),
    ('f0000000-0000-0000-0000-000000000003', 'Products & Quality', 'faq', 'faq-products', '{"hi": "उत्पाद और गुणवत्ता", "ta": "தயாரிப்புகள் மற்றும் தரம்", "te": "ఉత్పత్తులు మరియు నాణ్యత"}'),
    ('f0000000-0000-0000-0000-000000000004', 'Orders & Shipping', 'faq', 'faq-shipping', '{"hi": "आदेश और शिपिंग", "ta": "ஆர்டர்கள் மற்றும் ஷிப்பிங்", "te": "ఆర్డర్లు మరియు షిప్పింగ్"}'),
    ('f0000000-0000-0000-0000-000000000005', 'Donations & Tax', 'faq', 'faq-donations', '{"hi": "दान और कर", "ta": "நன்கொடைகள் மற்றும் வரி", "te": "విరాళాలు మరియు పన్ను"}')
ON CONFLICT (category_code) DO UPDATE
SET name = EXCLUDED.name, name_i18n = EXCLUDED.name_i18n;

-- 2. Seed FAQs with deterministic IDs so reruns replace rather than duplicate
WITH seed_faqs(id, question, answer, category, category_id, display_order, is_active) AS (
    VALUES
        -- General
        ('f1000000-0000-0000-0000-000000000001'::uuid, 'What is the mission of MeriGaumata?', 'Our mission is to rescue, rehabilitate, and provide lifetime care for abandoned and injured cows while promoting sustainable cow protection practices.', 'General', 'f0000000-0000-0000-0000-000000000001'::uuid, 1, true),
        ('f1000000-0000-0000-0000-000000000002'::uuid, 'How can I visit the Gaushala?', 'Visitors are welcome between 8:00 AM and 5:00 PM. Please schedule your visit in advance via the contact page for a guided experience.', 'General', 'f0000000-0000-0000-0000-000000000001'::uuid, 2, true),

        -- Cow Welfare
        ('f1000000-0000-0000-0000-000000000003'::uuid, 'How many cows are currently in your care?', 'We currently provide a safe haven for over 500 cows, including those rescued from accidents and abandonment.', 'Cow Welfare', 'f0000000-0000-0000-0000-000000000002'::uuid, 1, true),
        ('f1000000-0000-0000-0000-000000000004'::uuid, 'Do you provide medical treatment for rescued cows?', 'Yes, we have a specialized veterinary team and medical bay to provide intensive care and standard health checkups for all our cows.', 'Cow Welfare', 'f0000000-0000-0000-0000-000000000002'::uuid, 2, true),

        -- Products & Quality
        ('f1000000-0000-0000-0000-000000000005'::uuid, 'Is your Ghee made from A2 milk?', 'Absolutely. Our Ghee is authentic A2 Bilona Ghee, handcrafted using traditional methods from the milk of indigenous Desi cows.', 'Products & Quality', 'f0000000-0000-0000-0000-000000000003'::uuid, 1, true),
        ('f1000000-0000-0000-0000-000000000006'::uuid, 'Are your dairy products hormone-free?', 'Yes, all our products are 100% natural, hormone-free, and produced following organic ethical standards.', 'Products & Quality', 'f0000000-0000-0000-0000-000000000003'::uuid, 2, true),

        -- Orders & Shipping
        ('f1000000-0000-0000-0000-000000000007'::uuid, 'What is the typical delivery time?', 'Orders are usually delivered within 3-5 business days across India. Remote locations may take 5-7 days.', 'Orders & Shipping', 'f0000000-0000-0000-0000-000000000004'::uuid, 1, true),
        ('f1000000-0000-0000-0000-000000000008'::uuid, 'Can I track my order?', 'Yes, once your order is shipped, you will receive a tracking ID via email and your user dashboard.', 'Orders & Shipping', 'f0000000-0000-0000-0000-000000000004'::uuid, 2, true),

        -- Donations & Tax
        ('f1000000-0000-0000-0000-000000000009'::uuid, 'Are my donations tax-exempt?', 'Yes, donations to MeriGaumata are eligible for tax deduction under Section 80G of the Income Tax Act.', 'Donations & Tax', 'f0000000-0000-0000-0000-000000000005'::uuid, 1, true),
        ('f1000000-0000-0000-0000-000000000010'::uuid, 'Can I donate in memory of a loved one?', 'Yes, we facilitate commemorative donations for cow welfare in memory of loved ones or for special occasions.', 'Donations & Tax', 'f0000000-0000-0000-0000-000000000005'::uuid, 2, true)
),
legacy_seed_rows AS (
    UPDATE public.faqs AS f
    SET
        id = s.id,
        answer = s.answer,
        category = s.category,
        category_id = s.category_id,
        display_order = s.display_order,
        is_active = s.is_active,
        updated_at = NOW()
    FROM seed_faqs s
    WHERE f.category_id = s.category_id
      AND f.question = s.question
      AND f.id <> s.id
      AND NOT EXISTS (
          SELECT 1
          FROM public.faqs existing
          WHERE existing.id = s.id
      )
    RETURNING f.id
)
INSERT INTO public.faqs (id, question, answer, category, category_id, display_order, is_active)
SELECT id, question, answer, category, category_id, display_order, is_active
FROM seed_faqs
ON CONFLICT (id) DO UPDATE
SET
    question = EXCLUDED.question,
    answer = EXCLUDED.answer,
    category = EXCLUDED.category,
    category_id = EXCLUDED.category_id,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Clean up exact duplicates left behind by older non-deterministic inserts
WITH seed_faqs(id, question, category_id) AS (
    VALUES
        ('f1000000-0000-0000-0000-000000000001'::uuid, 'What is the mission of MeriGaumata?', 'f0000000-0000-0000-0000-000000000001'::uuid),
        ('f1000000-0000-0000-0000-000000000002'::uuid, 'How can I visit the Gaushala?', 'f0000000-0000-0000-0000-000000000001'::uuid),
        ('f1000000-0000-0000-0000-000000000003'::uuid, 'How many cows are currently in your care?', 'f0000000-0000-0000-0000-000000000002'::uuid),
        ('f1000000-0000-0000-0000-000000000004'::uuid, 'Do you provide medical treatment for rescued cows?', 'f0000000-0000-0000-0000-000000000002'::uuid),
        ('f1000000-0000-0000-0000-000000000005'::uuid, 'Is your Ghee made from A2 milk?', 'f0000000-0000-0000-0000-000000000003'::uuid),
        ('f1000000-0000-0000-0000-000000000006'::uuid, 'Are your dairy products hormone-free?', 'f0000000-0000-0000-0000-000000000003'::uuid),
        ('f1000000-0000-0000-0000-000000000007'::uuid, 'What is the typical delivery time?', 'f0000000-0000-0000-0000-000000000004'::uuid),
        ('f1000000-0000-0000-0000-000000000008'::uuid, 'Can I track my order?', 'f0000000-0000-0000-0000-000000000004'::uuid),
        ('f1000000-0000-0000-0000-000000000009'::uuid, 'Are my donations tax-exempt?', 'f0000000-0000-0000-0000-000000000005'::uuid),
        ('f1000000-0000-0000-0000-000000000010'::uuid, 'Can I donate in memory of a loved one?', 'f0000000-0000-0000-0000-000000000005'::uuid)
)
DELETE FROM public.faqs AS f
USING seed_faqs s
WHERE f.category_id = s.category_id
  AND f.question = s.question
  AND f.id <> s.id;

COMMIT;
