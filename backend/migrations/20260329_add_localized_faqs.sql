-- ========================================================
-- ADD LOCALIZED FAQs FOR MERI GAU MATA
-- ========================================================

BEGIN;

-- Ensure i18n columns exist before proceeding
DO $$ 
BEGIN
    -- For categories
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'product';
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_name_i18n JSONB DEFAULT '{}';
    END IF;

    -- For faqs
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'faqs') THEN
        ALTER TABLE faqs ADD COLUMN IF NOT EXISTS question_i18n JSONB DEFAULT '{}';
        ALTER TABLE faqs ADD COLUMN IF NOT EXISTS answer_i18n JSONB DEFAULT '{}';
    END IF;
END $$;

-- 1. Ensure FAQ Categories exist with translations
DO $$ 
DECLARE
    gen_id UUID;
    prod_id UUID;
    don_id UUID;
    ship_id UUID;
    ret_id UUID;
BEGIN
    -- General Category
    INSERT INTO categories (name, type, display_name_i18n)
    VALUES ('General', 'faq', '{"en": "General & Mission", "hi": "सामान्य और मिशन", "ta": "பொது மற்றும் நோக்கம்", "te": "సాధారణ మరియు లక్ష్యం"}')
    ON CONFLICT (name, type) DO UPDATE SET display_name_i18n = EXCLUDED.display_name_i18n
    RETURNING id INTO gen_id;

    -- Products Category
    INSERT INTO categories (name, type, display_name_i18n)
    VALUES ('Products', 'faq', '{"en": "Products & Quality", "hi": "उत्पाद और गुणवत्ता", "ta": "தயாரிப்புகள் மற்றும் தரம்", "te": "ఉత్పత్తులు మరియు నాణ్యత"}')
    ON CONFLICT (name, type) DO UPDATE SET display_name_i18n = EXCLUDED.display_name_i18n
    RETURNING id INTO prod_id;

    -- Donations Category
    INSERT INTO categories (name, type, display_name_i18n)
    VALUES ('Donations', 'faq', '{"en": "Donations & Support", "hi": "दान और सहायता", "ta": "நன்கொடைகள் மற்றும் ஆதரவு", "te": "విరాళాలు మరియు మద్దతు"}')
    ON CONFLICT (name, type) DO UPDATE SET display_name_i18n = EXCLUDED.display_name_i18n
    RETURNING id INTO don_id;

    -- Shipping Category
    INSERT INTO categories (name, type, display_name_i18n)
    VALUES ('Shipping', 'faq', '{"en": "Shipping & Delivery", "hi": "शिपिंग और डिलीवरी", "ta": "ஷிப்பிங் மற்றும் டெலிவரி", "te": "షిప్పింగ్ మరియు డెలివరీ"}')
    ON CONFLICT (name, type) DO UPDATE SET display_name_i18n = EXCLUDED.display_name_i18n
    RETURNING id INTO ship_id;

    -- Returns Category
    INSERT INTO categories (name, type, display_name_i18n)
    VALUES ('Returns', 'faq', '{"en": "Returns & Refunds", "hi": "रिटर्न और रिफंड", "ta": "திரும்புதல் மற்றும் ரீஃபண்ட்", "te": "రిటర్న్స్ మరియు వాపసు"}')
    ON CONFLICT (name, type) DO UPDATE SET display_name_i18n = EXCLUDED.display_name_i18n
    RETURNING id INTO ret_id;

    -- 2. Insert Localized FAQs
    
    -- --- GENERAL ---
    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (gen_id, 'What is Meri Gaumata''s mission?', 'Our mission is to provide a safe haven for indigenous (Desi) cows, protect them from harm, and promote their welfare while preserving traditional Vedic values.',
           '{"en": "What is Meri Gaumata''s mission?", "hi": "मेरी गौमाता का मिशन क्या है?", "ta": "மேரி கோமாதாவின் நோக்கம் என்ன?", "te": "మేరి గోమాత యొక్క లక్ష్యం ఏమిటి?"}',
           '{"en": "Our mission is to provide a safe haven for indigenous (Desi) cows, protect them from harm, and promote their welfare while preserving traditional Vedic values.", "hi": "हमारा मिशन स्वदेशी (देशी) गायों को सुरक्षित आश्रय प्रदान करना, उन्हें नुकसान से बचाना और पारंपरिक वैदिक मूल्यों को संरक्षित करते हुए उनके कल्याण को बढ़ावा देना है।", "ta": "எங்களது நோக்கம் நாட்டுப் பசுக்களுக்கு (தேசி) பாதுகாப்பான புகலிடம் அளிப்பதும், அவற்றிற்கு தீங்கு விளைவிக்காமல் பாதுகாப்பதும், பாரம்பரிய வேத விழுமியங்களைப் பேணி அவற்றின் நலனை மேம்படுத்துவதும் ஆகும்.", "te": "స్వదేశీ (దేశీ) ఆవులకు సురక్షితమైన ఆశ్రయాన్ని అందించడం, వాటిని హాని నుండి రక్షించడం మరియు సంప్రదాయ వైదిక విలువలను కాపాడుతూ వాటి సంక్షేమాన్ని పెంపొందించడం మా లక్ష్యం."}', 1);

    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (gen_id, 'Can I visit the Gaushala?', 'Yes, we welcome visitors! You can experience the serene environment, participate in Gau Seva, and see how our products are made. Please contact us to schedule a visit.',
           '{"en": "Can I visit the Gaushala?", "hi": "क्या मैं गौशाला का भ्रमण कर सकता हूँ?", "ta": "நான் கோசாலையைப் பார்வையிடலாமா?", "te": "నేను గోశాలను సందర్శించవచ్చా?"}',
           '{"en": "Yes, we welcome visitors! You can experience the serene environment, participate in Gau Seva, and see how our products are made. Please contact us to schedule a visit.", "hi": "हाँ, हम आगंतुकों का स्वागत करते हैं! आप शांत वातावरण का अनुभव कर सकते हैं, गौ सेवा में भाग ले सकते हैं और देख सकते हैं कि हमारे उत्पाद कैसे बनाए जाते हैं। कृपया यात्रा निर्धारित करने के लिए हमसे संपर्क करें।", "ta": "ஆம், நாங்கள் பார்வையாளர்களை வரவேற்கிறோம்! நீங்கள் அமைதியான சூழலை அனுபவிக்கலாம், கோ சேவையில் பங்கேற்கலாம் மற்றும் எங்கள் தயாரிப்புகள் எவ்வாறு தயாரிக்கப்படுகின்றன என்பதைப் பார்க்கலாம். வருகையைத் திட்டமிட எங்களைத் தொடர்பு கொள்ளவும்.", "te": "అవును, మేము సందర్శకులను స్వాగతిస్తాము! మీరు ప్రశాంతమైన వాతావరణాన్ని అనుభవించవచ్చు, గో సేవలో పాల్గొనవచ్చు మరియు మా ఉత్పత్తులు ఎలా తయారవుతాయో చూడవచ్చు. సందర్శనను షెడ్యూల్ చేయడానికి దయచేసి మమ్మల్ని సంప్రదించండి."}', 2);

    -- --- PRODUCTS ---
    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (prod_id, 'What is A2 Desi Cow Ghee?', 'A2 Ghee is made from the milk of indigenous cows using the traditional Bilona method, containing only A2 beta-casein protein which is highly beneficial for health.',
           '{"en": "What is A2 Desi Cow Ghee?", "hi": "ए2 देशी गाय का घी क्या है?", "ta": "A2 நாட்டுப் பசு நெய் என்றால் என்ன?", "te": "A2 దేశీ ఆవు నెయ్యి అంటే ఏమిటి?"}',
           '{"en": "A2 Ghee is made from the milk of indigenous cows using the traditional Bilona method, containing only A2 beta-casein protein which is highly beneficial for health.", "hi": "ए2 घी स्वदेशी गायों के दूध से पारंपरिक बिलोना पद्धति का उपयोग करके बनाया जाता है, जिसमें केवल ए2 बीटा-कैसिइन प्रोटीन होता है जो स्वास्थ्य के लिए अत्यधिक फायदेमंद है।", "ta": "A2 நெய் என்பது பாரம்பரிய பிலோனா முறையைப் பயன்படுத்தி நாட்டுப் பசுக்களின் பாலிலிருந்து தயாரிக்கப்படுகிறது, இதில் ஆரோக்கியத்திற்கு மிகவும் நன்மை பயக்கும் A2 பீட்டா-கேசின் புரதம் மட்டுமே உள்ளது.", "te": "A2 నెయ్యి స్వదేశీ ఆవుల పాల నుండి సాంప్రదాయ బిలోనా పద్ధతిని ఉపయోగించి తయారు చేయబడుతుంది, ఇందులో ఆరోగ్యానికి ఎంతో మేలు చేసే A2 బీటా-కేసిన్ ప్రోటీన్ మాత్రమే ఉంటుంది."}', 1);

    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (prod_id, 'Are your products truly organic?', 'Yes, all our products are produced without synthetic fertilizers or pesticides, adhering to natural and sustainable farming practices.',
           '{"en": "Are your products truly organic?", "hi": "क्या आपके उत्पाद वास्तव में जैविक हैं?", "ta": "உங்கள் தயாரிப்புகள் உண்மையிலேயே ஆர்கானிக் தானா?", "te": "మీ ఉత్పత్తులు నిజంగా సేంద్రీయమా?"}',
           '{"en": "Yes, all our products are produced without synthetic fertilizers or pesticides, adhering to natural and sustainable farming practices.", "hi": "हाँ, हमारे सभी उत्पाद सिंथेटिक उर्वरकों या कीटनाशकों के बिना तैयार किए जाते हैं, जो प्राकृतिक और टिकाऊ कृषि पद्धतियों का पालन करते हैं।", "ta": "ஆம், எங்கள் தயாரிப்புகள் அனைத்தும் செயற்கை உரங்கள் அல்லது பூச்சிக்கொல்லிகள் இன்றி, இயற்கை மற்றும் நிலையான விவசாய முறைகளைப் பின்பற்றி தயாரிக்கப்படுகின்றன.", "te": "అవును, మా ఉత్పత్తులన్నీ కృత్రిమ ఎరువులు లేదా పురుగుమందులు లేకుండా, సహజమైన మరియు స్థిరమైన వ్యవసాయ పద్ధతులను అనుసరించి ఉత్పత్తి చేయబడతాయి."}', 2);

    -- --- DONATIONS ---
    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (don_id, 'How can I donate?', 'You can donate via UPI, Credit/Debit cards, or Net Banking on our website. Direct bank transfers are also accepted.',
           '{"en": "How can I donate?", "hi": "मैं दान कैसे कर सकता हूँ?", "ta": "நான் எப்படி நன்கொடை அளிப்பது?", "te": "నేను విరాళం ఎలా ఇవ్వగలను?"}',
           '{"en": "You can donate via UPI, Credit/Debit cards, or Net Banking on our website. Direct bank transfers are also accepted.", "hi": "आप हमारी वेबसाइट पर यूपीआई, क्रेडिट/डेबिट कार्ड या नेट बैंकिंग के माध्यम से दान कर सकते हैं। सीधा बैंक ट्रांसफर भी स्वीकार किया जाता है।", "ta": "எங்கள் இணையதளத்தில் UPI, கிரெடிட்/டெபிட் கார்டுகள் அல்லது நெட் பேங்கிங் மூலம் நீங்கள் நன்கொடை அளிக்கலாம். நேரடி வங்கிப் பரிமாற்றங்களும் ஏற்றுக் கொள்ளப்படுகின்றன.", "te": "మీరు మా వెబ్‌సైట్‌లో UPI, క్రెడిట్/డెబిట్ కార్డ్‌లు లేదా నెట్ బ్యాంకింగ్ ద్వారా విరాళం ఇవ్వవచ్చు. నేరుగా బ్యాంక్ బదిలీలు కూడా ఆమోదించబడతాయి."}', 1);

    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (don_id, 'Is my donation tax-exempt?', 'Yes, donations are eligible for tax exemption under Section 80G of the Income Tax Act. A receipt will be sent to your email.',
           '{"en": "Is my donation tax-exempt?", "hi": "क्या मेरा दान कर-मुक्त है?", "ta": "எனது நன்கொடைக்கு வரி விலக்கு உண்டா?", "te": "నా విరాళానికి పన్ను మినహాయింపు ఉందా?"}',
           '{"en": "Yes, donations are eligible for tax exemption under Section 80G of the Income Tax Act. A receipt will be sent to your email.", "hi": "हाँ, आयकर अधिनियम की धारा 80जी के तहत दान कर छूट के लिए पात्र हैं। आपकी ईमेल पर एक रसीद भेजी जाएगी।", "ta": "ஆம், வருமான வரிச் சட்டத்தின் 80G பிரிவின் கீழ் நன்கொடைகளுக்கு வரி விலக்கு அளிக்கப்படுகிறது. ரசீது உங்கள் மின்னஞ்சலுக்கு அனுப்பப்படும்.", "te": "అవును, ఆదాయపు పన్ను చట్టంలోని సెక్షన్ 80G ప్రకారం విరాళాలకు పన్ను మినహాయింపు ఉంటుంది. మీ ఇమెయిల్‌కు రసీదు పంపబడుతుంది."}', 2);

    -- --- SHIPPING ---
    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (ship_id, 'Do you ship pan-India?', 'Yes, we ship to almost all pincodes across India via reliable courier partners.',
           '{"en": "Do you ship pan-India?", "hi": "क्या आप पूरे भारत में शिप करते हैं?", "ta": "இந்தியா முழுவதும் ஷிப்பிங் செய்கிறீர்களா?", "te": "మీరు భారతదేశం అంతటా షిప్పింగ్ చేస్తారా?"}',
           '{"en": "Yes, we ship to almost all pincodes across India via reliable courier partners.", "hi": "हाँ, हम विश्वसनीय कूरियर भागीदारों के माध्यम से भारत भर के लगभग सभी पिनकोड पर शिप करते हैं।", "ta": "ஆம், நம்பகமான கூரியர் பங்காளிகள் மூலம் இந்தியாவின் அனைத்து பின்கோடுகளுக்கும் ஷிப்பிங் செய்கிறோம்.", "te": "అవును, మేము నమ్మకమైన కొరియర్ భాగస్వాముల ద్వారా భారతదేశం అంతటా దాదాపు అన్ని పిన్‌కోడ్‌లకు షిప్పింగ్ చేస్తాము."}', 1);

    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (ship_id, 'What are the shipping charges?', 'Shipping is free for orders above ₹999. For smaller orders, charges depend on your delivery location.',
           '{"en": "What are the shipping charges?", "hi": "शिपिंग शुल्क क्या हैं?", "ta": "ஷிப்பிங் கட்டணங்கள் என்ன?", "te": "షిప్పింగ్ ఛార్జీలు ఏమిటి?"}',
           '{"en": "Shipping is free for orders above ₹999. For smaller orders, charges depend on your delivery location.", "hi": "₹999 से अधिक के ऑर्डर के लिए शिपिंग मुफ्त है। छोटे ऑर्डर के लिए शुल्क आपके वितरण स्थान पर निर्भर करते हैं।", "ta": "₹999-க்கு மேலான ஆர்டர்களுக்கு ஷிப்பிங் இலவசம். சிறிய ஆர்டர்களுக்கு, உங்கள் இருப்பிடத்தைப் பொறுத்து கட்டணம் மாறுபடும்.", "te": "₹999 కంటే ఎక్కువ ఆర్డర్‌లకు షిప్పింగ్ ఉచితం. చిన్న ఆర్డర్‌ల కోసం, ఛార్జీలు మీ డెలివరీ లొకేషన్‌పై ఆధారపడి ఉంటాయి."}', 2);

    -- --- RETURNS ---
    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (ret_id, 'What is your return policy?', 'Due to their perishable nature, dairy products can only be returned if damaged upon arrival. Please notify us within 24 hours.',
           '{"en": "What is your return policy?", "hi": "आपकी रिटर्न पॉलिसी क्या है?", "ta": "உங்களது ரிட்டர்ன் பாலிசி என்ன?", "te": "మీ రిటర్న్ పాలసీ ఏమిటి?"}',
           '{"en": "Due to their perishable nature, dairy products can only be returned if damaged upon arrival. Please notify us within 24 hours.", "hi": "खराब होने की प्रकृति के कारण, डेयरी उत्पादों को केवल आगमन पर क्षतिग्रस्त होने पर ही वापस किया जा सकता है। कृपया 24 घंटे के भीतर हमें सूचित करें।", "ta": "பால் தயாரிப்புகள் எளிதில் கெடக்கூடியவை என்பதால், அவை சேதமடைந்த நிலையில் வந்தால் மட்டுமே திருப்பித் தர முடியும். 24 மணி நேரத்திற்குள் எங்களைத் தொடர்பு கொள்ளவும்.", "te": "డైరీ ఉత్పత్తులు త్వరగా పాడయ్యే స్వభావం కలిగి ఉన్నందున, డెలివరీ సమయంలో దెబ్బతింటే మాత్రమే వాటిని తిరిగి తీసుకోవడం జరుగుతుంది. దయచేసి 24 గంటల్లోగా మాకు తెలియజేయండి."}', 1);

    INSERT INTO faqs (category_id, question, answer, question_i18n, answer_i18n, display_order)
    VALUES (ret_id, 'When will I get my refund?', 'Refunds are typically processed within 5-7 business days after approval, back to the original payment method.',
           '{"en": "When will I get my refund?", "hi": "मुझे मेरा रिफंड कब मिलेगा?", "ta": "எனது ரீஃபண்ட் எப்போது கிடைக்கும்?", "te": "నాకు రీఫండ్ ఎప్పుడు వస్తుంది?"}',
           '{"en": "Refunds are typically processed within 5-7 business days after approval, back to the original payment method.", "hi": "अनुमोदन के बाद रिफंड आमतौर पर 5-7 व्यावसायिक दिनों के भीतर मूल भुगतान पद्धति पर संसाधित किए जाते हैं।", "ta": "அங்கீகரிக்கப்பட்ட பிறகு ரீஃபண்ட் பொதுவாக 5-7 வணிக நாட்களில் அசல் கட்டண முறைக்கே அனுப்பி வைக்கப்படும்.", "te": "ఆమోదం పొందిన తర్వాత రీఫండ్‌లు సాధారణంగా 5-7 పనిదినాలలో అసలు చెల్లింపు పద్ధతికి ప్రాసెస్ చేయబడతాయి."}', 2);

END $$;

COMMIT;
