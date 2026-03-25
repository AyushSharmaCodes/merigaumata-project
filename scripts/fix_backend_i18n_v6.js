#!/usr/bin/env node
/**
 * Fix ALL remaining backend hardcoded strings found in verification (Pass 6 - Final).
 * This covers account-deletion, geo, contact-info, coupon, order, manager, return, social-media.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '../backend');
const LOCALES_DIR = path.join(BACKEND_DIR, 'locales');

function setNestedKey(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    if (current[parts[parts.length - 1]] === undefined) {
        current[parts[parts.length - 1]] = value;
        return true;
    }
    return false;
}

const replacements = [
    // social-media.routes.js (one missed)
    { file: 'routes/social-media.routes.js', old: "'Platform and URL are required'", new: "req.t('errors.social.platformUrlRequired')", key: 'errors.social.platformUrlRequired', en: 'Platform and URL are required', hi: 'प्लेटफ़ॉर्म और URL आवश्यक हैं', ta: 'மேடை மற்றும் URL தேவை', te: 'ప్లేట్‌ఫారమ్ మరియు URL అవసరం' },

    // geo.routes.js
    { file: 'routes/geo.routes.js', old: "'Failed to fetch countries'", new: "req.t('errors.geo.fetchCountriesFailed')", key: 'errors.geo.fetchCountriesFailed', en: 'Failed to fetch countries', hi: 'देशों को प्राप्त करने में विफल', ta: 'நாடுகளைப் பெறுவதில் தோல்வி', te: 'దేశాలను పొందడంలో విఫలమైంది' },
    { file: 'routes/geo.routes.js', old: "'Failed to fetch states'", new: "req.t('errors.geo.fetchStatesFailed')", key: 'errors.geo.fetchStatesFailed', en: 'Failed to fetch states', hi: 'राज्यों को प्राप्त करने में विफल', ta: 'மாநிலங்களைப் பெறுவதில் தோல்வி', te: 'రాష్ట్రాలను పొందడంలో విఫలమైంది' },
    { file: 'routes/geo.routes.js', old: "'Failed to validate postal code'", new: "req.t('errors.geo.validatePostalFailed')", key: 'errors.geo.validatePostalFailed', en: 'Failed to validate postal code', hi: 'पिन कोड सत्यापित करने में विफल', ta: 'அஞ்சல் குறியீட்டைச் சரிபார்ப்பதில் தோல்வி', te: 'పోస్టల్ కోడ్‌ని ధృవీకరించడంలో విఫలమైంది' },

    // contact-info.routes.js
    { file: 'routes/contact-info.routes.js', old: "'Failed to fetch contact info'", new: "req.t('errors.contactInfo.fetchFailed')", key: 'errors.contactInfo.fetchFailed', en: 'Failed to fetch contact info', hi: 'संपर्क जानकारी प्राप्त करने में विफल', ta: 'தொடர்புத் தகவலைப் பெறுவதில் தோல்வி', te: 'సంప్రదింపు సమాచారాన్ని పొందడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to update address'", new: "req.t('errors.contactInfo.updateAddressFailed')", key: 'errors.contactInfo.updateAddressFailed', en: 'Failed to update address', hi: 'पता अपडेट करने में विफल', ta: 'முகவரியைப் புதுப்பிப்பதில் தோல்வி', te: 'చిరునామాను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to add phone'", new: "req.t('errors.contactInfo.addPhoneFailed')", key: 'errors.contactInfo.addPhoneFailed', en: 'Failed to add phone', hi: 'फोन जोड़ने में विफल', ta: 'தொலைபேசியைச் சேர்ப்பதில் தோல்வி', te: 'ఫోన్‌ను జోడించడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to update phone'", new: "req.t('errors.contactInfo.updatePhoneFailed')", key: 'errors.contactInfo.updatePhoneFailed', en: 'Failed to update phone', hi: 'फोन अपडेट करने में विफल', ta: 'தொலைபேசியைப் புதுப்பிப்பதில் தோல்வி', te: 'ఫోన్‌ను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to delete phone'", new: "req.t('errors.contactInfo.deletePhoneFailed')", key: 'errors.contactInfo.deletePhoneFailed', en: 'Failed to delete phone', hi: 'फोन हटाने में विफल', ta: 'தொலைபேசியை நீக்குவதில் தோல்வி', te: 'ఫోన్‌ను తొలగించడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to add email'", new: "req.t('errors.contactInfo.addEmailFailed')", key: 'errors.contactInfo.addEmailFailed', en: 'Failed to add email', hi: 'ईमेल जोड़ने में विफल', ta: 'மின்னஞ்சலைச் சேர்ப்பதில் தோல்வி', te: 'ఇమెయిల్‌ను జోడించడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to update email'", new: "req.t('errors.contactInfo.updateEmailFailed')", key: 'errors.contactInfo.updateEmailFailed', en: 'Failed to update email', hi: 'ईमेल अपडेट करने में विफल', ta: 'மின்னஞ்சலைப் புதுப்பிப்பதில் தோல்வி', te: 'ఇమెయిల్‌ను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to delete email'", new: "req.t('errors.contactInfo.deleteEmailFailed')", key: 'errors.contactInfo.deleteEmailFailed', en: 'Failed to delete email', hi: 'ईमेल हटाने में विफल', ta: 'மின்னஞ்சலை நீக்குவதில் தோல்வி', te: 'ఇమెయిల్‌ను తొలగించడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to add office hours'", new: "req.t('errors.contactInfo.addOfficeHoursFailed')", key: 'errors.contactInfo.addOfficeHoursFailed', en: 'Failed to add office hours', hi: 'कार्यालय समय जोड़ने में विफल', ta: 'அலுவலக நேரத்தைச் சேர்ப்பதில் தோல்வி', te: 'కార్యాలయ గంటలను జోడించడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to update office hours'", new: "req.t('errors.contactInfo.updateOfficeHoursFailed')", key: 'errors.contactInfo.updateOfficeHoursFailed', en: 'Failed to update office hours', hi: 'कार्यालय समय अपडेट करने में विफल', ta: 'அலுவலக நேரத்தைப் புதுப்பிப்பதில் தோல்வி', te: 'కార్యాలయ గంటలను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/contact-info.routes.js', old: "'Failed to delete office hours'", new: "req.t('errors.contactInfo.deleteOfficeHoursFailed')", key: 'errors.contactInfo.deleteOfficeHoursFailed', en: 'Failed to delete office hours', hi: 'कार्यालय समय हटाने में विफल', ta: 'அலுவலக நேரத்தை நீக்குவதில் தோல்வி', te: 'కార్యాలయ గంటలను తొలగించడంలో విఫలమైంది' },

    // coupon.routes.js
    { file: 'routes/coupon.routes.js', old: "'Coupon not found'", new: "req.t('errors.coupon.notFound')", key: 'errors.coupon.notFound', en: 'Coupon not found', hi: 'कूपन नहीं मिला', ta: 'கூப்பன் காணப்படவில்லை', te: 'కూపన్ కనుగొనబడలేదు' },
    { file: 'routes/coupon.routes.js', old: "'Missing required fields: code, type, discount_percentage (except for free_delivery), valid_until'", new: "req.t('errors.coupon.missingFields')", key: 'errors.coupon.missingFields', en: 'Missing required fields: code, type, discount_percentage (except for free_delivery), valid_until', hi: 'आवश्यक फ़ील्ड गायब हैं: कोड, प्रकार, छूट प्रतिशत (फ्री_डिलीवरी को छोड़कर), वैधता तिथि', ta: 'தேவையான புலங்கள் விடுபட்டுள்ளன: குறியீடு, வகை, தள்ளுபடி சதவீதம், செல்லுபடியாகும் தேதி', te: 'అవసరమైన ఫీల్డ్‌లు లేవు: కోడ్, రకం, డిస్కౌంట్ శాతము, చెల్లుబాటు అయ్యే వరకు' },
    { file: 'routes/coupon.routes.js', old: "'Discount percentage must be between 1 and 100'", new: "req.t('errors.coupon.invalidDiscount')", key: 'errors.coupon.invalidDiscount', en: 'Discount percentage must be between 1 and 100', hi: 'छूट प्रतिशत 1 और 100 के बीच होना चाहिए', ta: 'தள்ளுபடி சதவீதம் 1 மற்றும் 100 க்கு இடையில் இருக்க வேண்டும்', te: 'డిస్కౌంట్ శాతము తప్పనిసరిగా 1 మరియు 100 మధ్య ఉండాలి' },
    { file: 'routes/coupon.routes.js', old: "'Type must be one of: product, category, cart, variant, free_delivery'", new: "req.t('errors.coupon.invalidType')", key: 'errors.coupon.invalidType', en: 'Type must be one of: product, category, cart, variant, free_delivery', hi: 'प्रकार इनमें से एक होना चाहिए: उत्पाद, श्रेणी, कार्ट, वेरिएंट, फ्री_डिलीवरी', ta: 'வகை பின்வருவனவற்றில் ஒன்றாக இருக்க வேண்டும்: தயாரிப்பு, வகை, வண்டி, மாறுபாடு, இலவச டெலிவரி', te: 'రకం వీటిలో ఒకటిగా ఉండాలి: ఉత్పత్తి, వర్గం, బండి, వేరియంట్, ఉచిత డెలివరీ' },
    { file: 'routes/coupon.routes.js', old: "'Coupon code already exists'", new: "req.t('errors.coupon.exists')", key: 'errors.coupon.exists', en: 'Coupon code already exists', hi: 'कूपन कोड पहले से मौजूद है', ta: 'கூப்பன் குறியீடு ஏற்கனவே உள்ளது', te: 'కూపన్ కోడ్ ఇప్పటికే ఉంది' },

    // order.routes.js
    { file: 'routes/order.routes.js', old: "'Status is required'", new: "req.t('errors.order.statusRequired')", key: 'errors.order.statusRequired', en: 'Status is required', hi: 'स्थिति आवश्यक है', ta: 'நிலை தேவை', te: 'స్థితి అవసరం' },

    // manager.routes.js
    { file: 'routes/manager.routes.js', old: "'Email and name are required'", new: "req.t('errors.manager.emailNameRequired')", key: 'errors.manager.emailNameRequired', en: 'Email and name are required', hi: 'ईमेल और नाम आवश्यक हैं', ta: 'மின்னஞ்சல் மற்றும் பெயர் தேவை', te: 'ఇమెయిల్ మరియు పేరు అవసరం' },
    { file: 'routes/manager.routes.js', old: "'A user with this email already exists'", new: "req.t('errors.manager.emailExists')", key: 'errors.manager.emailExists', en: 'A user with this email already exists', hi: 'इस ईमेल के साथ एक उपयोगकर्ता पहले से मौजूद है', ta: 'இந்த மின்னஞ்சலுடன் ஒரு பயனர் ஏற்கனவே உள்ளார்', te: 'ఈ ఇమెయిల్‌తో ఒక వినియోగదారు ఇప్పటికే ఉన్నారు' },

    // return.routes.js
    { file: 'routes/return.routes.js', old: "'Invalid request data'", new: "req.t('errors.return.invalidData')", key: 'errors.return.invalidData', en: 'Invalid request data', hi: 'अमान्य अनुरोध डेटा', ta: 'செல்லாத கோரிக்கை தரவு', te: 'చెల్లని అభ్యర్థన డేటా' },

    // account-deletion.routes.js
    { file: 'routes/account-deletion.routes.js', old: "'Failed to send verification code'", new: "req.t('errors.deletion.sendCodeFailed')", key: 'errors.deletion.sendCodeFailed', en: 'Failed to send verification code', hi: 'सत्यापन कोड भेजने में विफल', ta: 'சரிபார்ப்புக் குறியீட்டை அனுப்புவதில் தோல்வி', te: 'ధృవీకరణ కోడ్ పంపడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'OTP is required'", new: "req.t('errors.deletion.otpRequired')", key: 'errors.deletion.otpRequired', en: 'OTP is required', hi: 'OTP आवश्यक है', ta: 'OTP தேவை', te: 'OTP అవసరం' },
    { file: 'routes/account-deletion.routes.js', old: "'Failed to verify code'", new: "req.t('errors.deletion.verifyCodeFailed')", key: 'errors.deletion.verifyCodeFailed', en: 'Failed to verify code', hi: 'कोड सत्यापित करने में विफल', ta: 'குறியீட்டைச் சரிபார்ப்பதில் தோல்வி', te: 'కోడ్ ధృవీకరించడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'Authorization token is required'", new: "req.t('errors.deletion.tokenRequired')", key: 'errors.deletion.tokenRequired', en: 'Authorization token is required', hi: 'प्राधिकरण टोकन आवश्यक है', ta: 'அங்கீகார டோக்கன் தேவை', te: 'ఆలరైజేషన్ టోకెన్ అవసరం' },
    { file: 'routes/account-deletion.routes.js', old: "'Failed to initiate account deletion'", new: "req.t('errors.deletion.initiateFailed')", key: 'errors.deletion.initiateFailed', en: 'Failed to initiate account deletion', hi: 'खाता हटाना शुरू करने में विफल', ta: 'கணக்கை நீக்குவதைத் தொடங்குவதில் தோல்வி', te: 'ఖాతా తొలగింపును ప్రారంభించడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'Invalid grace period. Choose 7, 15, or 30 days.'", new: "req.t('errors.deletion.invalidGracePeriod')", key: 'errors.deletion.invalidGracePeriod', en: 'Invalid grace period. Choose 7, 15, or 30 days.', hi: 'अमान्य अनुग्रह अवधि। 7, 15, या 30 दिन चुनें।', ta: 'செல்லாத சலுகைக் காலம். 7, 15 அல்லது 30 நாட்களைத் தேர்ந்தெடுக்கவும்.', te: 'చెల్లని గ్రేస్ పీరియడ్. 7, 15, లేదా 30 రోజులను ఎంచుకోండి.' },
    { file: 'routes/account-deletion.routes.js', old: "'Failed to schedule account deletion'", new: "req.t('errors.deletion.scheduleFailed')", key: 'errors.deletion.scheduleFailed', en: 'Failed to schedule account deletion', hi: 'खाता हटाने का समय निर्धारित करने में विफल', ta: 'கணக்கை நீக்குவதைத் திட்டமிடுவதில் தோல்வி', te: 'ఖాతా తొలగింపును షెడ్యూల్ చేయడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'Failed to cancel scheduled deletion'", new: "req.t('errors.deletion.cancelFailed')", key: 'errors.deletion.cancelFailed', en: 'Failed to cancel scheduled deletion', hi: 'निर्धारित विलोपन रद्द करने में विफल', ta: 'திட்டமிடப்பட்ட நீக்கத்தை ரத்து செய்வதில் தோல்வி', te: 'షెడ్యూల్ చేయబడిన తొలగింపును రద్దు చేయడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'Admin access required'", new: "req.t('errors.auth.adminRequired')", key: 'errors.auth.adminRequired', en: 'Admin access required', hi: 'प्रशासक पहुंच आवश्यक', ta: 'நிர்வாகி அணுகல் தேவை', te: 'అడ్మిన్ యాక్సెస్ అవసరం' },
    { file: 'routes/account-deletion.routes.js', old: "'Job not found'", new: "req.t('errors.deletion.jobNotFound')", key: 'errors.deletion.jobNotFound', en: 'Job not found', hi: 'कार्य नहीं मिला', ta: 'பணி காணப்படவில்லை', te: 'జాబ్ కనుగొనబడలేదు' },
    // Complex logic in account-deletion.routes.js will be handled by multi_replace logic after script.
    { file: 'routes/account-deletion.routes.js', old: "'Failed to process job'", new: "req.t('errors.deletion.processFailed')", key: 'errors.deletion.processFailed', en: 'Failed to process job', hi: 'कार्य संसाधित करने में विफल', ta: 'பணியைச் செயல்படுத்துவதில் தோல்வி', te: 'జాబ్‌ను ప్రాసెస్ చేయడంలో విఫలమైంది' },
];

// Load backend locale files
const locales = ['en', 'hi', 'ta', 'te'];
const backendLocaleData = {};
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    backendLocaleData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Add backend keys
let keysAdded = 0;
for (const r of replacements) {
    if (r.key) {
        for (const locale of locales) {
            if (r[locale] && setNestedKey(backendLocaleData[locale], r.key, r[locale])) {
                keysAdded++;
            }
        }
    }
}

// Save backend locale files
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backendLocaleData[locale], null, 2) + '\n', 'utf8');
}

console.log(`Added ${keysAdded} keys to locale files.`);

// Replace in backend files
let replacedCount = 0;

for (const r of replacements) {
    const filePath = path.join(BACKEND_DIR, r.file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Use replaceAll to handle duplicate occurrences
    const newContent = content.replaceAll(r.old, r.new);

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        replacedCount++;
        console.log(`  ✅ ${r.file}: replaced "${r.old.substring(0, 30)}..."`);
    } else {
        console.log(`  ⚠️  ${r.file}: NOT FOUND: "${r.old.substring(0, 30)}..."`);
    }
}

console.log(`\nDone! ${replacedCount} replacements made.`);
