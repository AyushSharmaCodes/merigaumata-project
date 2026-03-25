#!/usr/bin/env node
/**
 * Fix ALL remaining backend hardcoded strings found in verification (Pass 5).
 * This covers address, social-media, admin-event, newsletter, etc.
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
    // social-media.routes.js
    { file: 'routes/social-media.routes.js', old: "'Social media link not found'", new: "req.t('errors.social.linkNotFound')", key: 'errors.social.linkNotFound', en: 'Social media link not found', hi: 'सोशल मीडिया लिंक नहीं मिला', ta: 'சமூக ஊடக இணைப்பு காணப்படவில்லை', te: 'సోషల్ మీడియా లింక్ కనుగొనబడలేదు' },
    { file: 'routes/social-media.routes.js', old: "'Links array is required'", new: "req.t('errors.social.linksRequired')", key: 'errors.social.linksRequired', en: 'Links array is required', hi: 'लिंक सरणी आवश्यक है', ta: 'இணைப்புகள் வரிசை தேவை', te: 'లింక్‌ల శ్రేణి అవసరం' },

    // admin-notification.routes.js
    { file: 'routes/admin-notification.routes.js', old: "'Authentication required'", new: "req.t('errors.auth.authenticationRequired')", key: 'errors.auth.authenticationRequired', en: 'Authentication required', hi: 'प्रमाणीकरण आवश्यक', ta: 'அங்கீகாரம் தேவை', te: 'ధృవీకరణ అవసరం' },

    // admin-event.routes.js
    { file: 'routes/admin-event.routes.js', old: "'Cancellation reason is required'", new: "req.t('errors.event.cancellationReasonRequired')", key: 'errors.event.cancellationReasonRequired', en: 'Cancellation reason is required', hi: 'रद्दीकरण का कारण आवश्यक है', ta: 'ரத்து செய்வதற்கான காரணம் தேவை', te: 'రద్దు కారణం అవసరం' },
    { file: 'routes/admin-event.routes.js', old: "'New start date and reason (for notification) are required'", new: "req.t('errors.event.rescheduleParamsRequired')", key: 'errors.event.rescheduleParamsRequired', en: 'New start date and reason (for notification) are required', hi: 'नई प्रारंभ तिथि और कारण (अधिसूचना के लिए) आवश्यक हैं', ta: 'புதிய தொடக்க தேதி மற்றும் காரணம் தேவை', te: 'కొత్త ప్రారంభ తేదీ మరియు కారణం అవసరం' },
    { file: 'routes/admin-event.routes.js', old: "'No cancellation job found for this event'", new: "req.t('errors.event.noCancellationJob')", key: 'errors.event.noCancellationJob', en: 'No cancellation job found for this event', hi: 'इस ईवेंट के लिए कोई रद्दीकरण कार्य नहीं मिला', ta: 'இந்த நிகழ்வுக்கான ரத்து வேலை எதுவும் காணப்படவில்லை', te: 'ఈ ఈవెంట్ కోసం రద్దు జాబ్ కనుగొనబడలేదు' },
    // Complex template literals in admin-event.routes.js will be handled by multi_replace logic after script.

    // cron.routes.js
    { file: 'routes/cron.routes.js', old: "'Cron secret not configured'", new: "req.t('errors.system.cronSecretMissing')", key: 'errors.system.cronSecretMissing', en: 'Cron secret not configured', hi: 'क्रोन गुप्त कॉन्फ़िगर नहीं किया गया', ta: 'க்ரான் ரகசியம் கட்டமைக்கப்படவில்லை', te: 'క్రాన్ సీక్రెట్ కాన్ఫిగర్ చేయబడలేదు' },
    { file: 'routes/cron.routes.js', old: "'Unauthorized'", new: "req.t('errors.auth.unauthorized')", key: 'errors.auth.unauthorized', en: 'Unauthorized', hi: 'अनधिकृत', ta: 'அங்கீகரிக்கப்படாதது', te: 'అనధికృత' },

    // newsletter.routes.js
    { file: 'routes/newsletter.routes.js', old: "'Email is required'", new: "req.t('errors.validation.emailRequired')", key: 'errors.validation.emailRequired', en: 'Email is required', hi: 'ईमेल आवश्यक है', ta: 'மின்னஞ்சல் தேவை', te: 'ఇమెయిల్ అవసరం' },
    { file: 'routes/newsletter.routes.js', old: "'Email already subscribed'", new: "req.t('errors.newsletter.alreadySubscribed')", key: 'errors.newsletter.alreadySubscribed', en: 'Email already subscribed', hi: 'ईमेल पहले से ही साझा है', ta: 'மின்னஞ்சல் ஏற்கனவே சந்தா செலுத்தப்பட்டுள்ளது', te: 'ఇమెయిల్ ఇప్పటికే సబ్‌స్క్రయిబ్ చేయబడింది' },
    { file: 'routes/newsletter.routes.js', old: "'Email already exists'", new: "req.t('errors.newsletter.emailExists')", key: 'errors.newsletter.emailExists', en: 'Email already exists', hi: 'ईमेल पहले से मौजूद है', ta: 'மின்னஞ்சல் ஏற்கனவே உள்ளது', te: 'ఇమెయిల్ ఇప్పటికే ఉంది' },
    { file: 'routes/newsletter.routes.js', old: "'Subscriber not found'", new: "req.t('errors.newsletter.subscriberNotFound')", key: 'errors.newsletter.subscriberNotFound', en: 'Subscriber not found', hi: 'ग्राहक नहीं मिला', ta: 'சந்தாதாரர் காணப்படவில்லை', te: 'సబ్‌స్క్రయిబర్ కనుగొనబడలేదు' },

    // analytics.routes.js
    { file: 'routes/analytics.routes.js', old: "'Failed to fetch dashboard analytics'", new: "req.t('errors.analytics.fetchFailed')", key: 'errors.analytics.fetchFailed', en: 'Failed to fetch dashboard analytics', hi: 'डैशबोर्ड एनालिटिक्स प्राप्त करने में विफल', ta: 'டாஷ்போர்டு பகுப்பாய்வுகளைப் பெறுவதில் தோல்வி', te: 'డాష్‌బోర్డ్ అనలిటిక్స్ పొందడంలో విఫలమైంది' },

    // event-registration.routes.js
    { file: 'routes/event-registration.routes.js', old: "'System configuration error. Please contact support.'", new: "req.t('errors.system.configError')", key: 'errors.system.configError', en: 'System configuration error. Please contact support.', hi: 'सिस्टम कॉन्फ़िगरेशन त्रुटि। कृपया सहायता से संपर्क करें।', ta: 'கணினி உள்ளமைவு பிழை. தயவுசெய்து ஆதரவைத் தொடர்பு கொள்ளவும்.', te: 'సిస్టమ్ కాన్ఫిగరేషన్ లోపం. దయచేసి మద్దతును సంప్రదించండి.' },
    { file: 'routes/event-registration.routes.js', old: "'System configuration error during payment verification. Please contact support immediately.'", new: "req.t('errors.payment.verificationConfigError')", key: 'errors.payment.verificationConfigError', en: 'System configuration error during payment verification. Please contact support immediately.', hi: 'भुगतान सत्यापन के दौरान सिस्टम कॉन्फ़िगरेशन त्रुटि। कृपया तुरंत सहायता से संपर्क करें।', ta: 'கட்டண சரிபார்ப்பின் போது கணினி உள்ளமைவு பிழை. தயவுசெய்து உடனடியாக ஆதரவைத் தொடர்பு கொள்ளவும்.', te: 'చెల్లింపు ధృవీకరణ సమయంలో సిస్టమ్ కాన్ఫిగరేషన్ లోపం. దయచేసి వెంటనే మద్దతును సంప్రదించండి.' },
    { file: 'routes/event-registration.routes.js', old: "'Failed to verify payment. Please contact support if amount was deducted.'", new: "req.t('errors.payment.verificationFailedDeducted')", key: 'errors.payment.verificationFailedDeducted', en: 'Failed to verify payment. Please contact support if amount was deducted.', hi: 'भुगतान सत्यापित करने में विफल। यदि राशि काट ली गई है तो कृपया सहायता से संपर्क करें।', ta: 'கட்டணத்தைச் சரிபார்க்க முடியவில்லை. தொகை கழிக்கப்பட்டால் ஆதரவைத் தொடர்பு கொள்ளவும்.', te: 'చెల్లింపును ధృవీకరించడంలో విఫలమైంది. మొత్తం తీసివేయబడితే దయచేసి మద్దతును సంప్రదించండి.' },
    { file: 'routes/event-registration.routes.js', old: "'Failed to fetch registrations'", new: "req.t('errors.event.fetchRegistrationsFailed')", key: 'errors.event.fetchRegistrationsFailed', en: 'Failed to fetch registrations', hi: 'पंजीकरण प्राप्त करने में विफल', ta: 'பதிவுகளைப் பெறுவதில் தோல்வி', te: 'నమోదులను పొందడంలో విఫలమైంది' },

    // address.routes.js
    { file: 'routes/address.routes.js', old: "'Failed to fetch addresses'", new: "req.t('errors.address.fetchFailed')", key: 'errors.address.fetchFailed', en: 'Failed to fetch addresses', hi: 'पते प्राप्त करने में विफल', ta: 'முகவரிகளைப் பெறுவதில் தோல்வி', te: 'చిరునామాలను పొందడంలో విఫలమైంది' },
    { file: 'routes/address.routes.js', old: "'Invalid address type. Must be home, work, or other'", new: "req.t('errors.address.invalidType')", key: 'errors.address.invalidType', en: 'Invalid address type. Must be home, work, or other', hi: 'अमान्य पता प्रकार। घर, काम, या अन्य होना चाहिए', ta: 'செல்லாத முகவரி வகை. வீடு, வேலை அல்லது பிற இருக்க வேண்டும்', te: 'చెల్లని చిరునామా రకం. హోమ్, వర్క్ లేదా ఇతర అయి ఉండాలి' },
    { file: 'routes/address.routes.js', old: "'Street address, city, state, postal code, and phone are required'", new: "req.t('errors.address.missingFields')", key: 'errors.address.missingFields', en: 'Street address, city, state, postal code, and phone are required', hi: 'सड़क का पता, शहर, राज्य, पिन कोड और फोन आवश्यक हैं', ta: 'தெரு முகவரி, நகரம், மாநிலம், அஞ்சல் குறியீடு மற்றும் தொலைபேசி தேவை', te: 'వీధి చిరునామా, నగరం, రాష్ట్రం, పోస్టల్ కోడ్ మరియు ఫోన్ అవసరం' },
    { file: 'routes/address.routes.js', old: "'Failed to create address'", new: "req.t('errors.address.createFailed')", key: 'errors.address.createFailed', en: 'Failed to create address', hi: 'पता बनाने में विफल', ta: 'முகவரியை உருவாக்குவதில் தோல்வி', te: 'చిరునామాను సృష్టించడంలో విఫలమైంది' },
    { file: 'routes/address.routes.js', old: "'Address not found'", new: "req.t('errors.address.notFound')", key: 'errors.address.notFound', en: 'Address not found', hi: 'पता नहीं मिला', ta: 'முகவரி காணப்படவில்லை', te: 'చిరునామా కనుగొనబడలేదు' },
    { file: 'routes/address.routes.js', old: "'Invalid address type'", new: "req.t('errors.address.invalidTypeSimple')", key: 'errors.address.invalidTypeSimple', en: 'Invalid address type', hi: 'अमान्य पता प्रकार', ta: 'செல்லாத முகவரி வகை', te: 'చెల్లని చిరునామా రకం' },
    { file: 'routes/address.routes.js', old: "'Failed to update address'", new: "req.t('errors.address.updateFailed')", key: 'errors.address.updateFailed', en: 'Failed to update address', hi: 'पता अपडेट करने में विफल', ta: 'முகவரியைப் புதுப்பிப்பதில் தோல்வி', te: 'చిరునామాను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/address.routes.js', old: "'Failed to delete address'", new: "req.t('errors.address.deleteFailed')", key: 'errors.address.deleteFailed', en: 'Failed to delete address', hi: 'पता हटाने में विफल', ta: 'முகவரியை நீக்குவதில் தோல்வி', te: 'చిరునామాను తొలగించడంలో విఫలమైంది' },
    { file: 'routes/address.routes.js', old: "'Failed to set primary address'", new: "req.t('errors.address.setPrimaryFailed')", key: 'errors.address.setPrimaryFailed', en: 'Failed to set primary address', hi: 'प्राथमिक पता सेट करने में विफल', ta: 'முதன்மை முகவரியை அமைப்பதில் தோல்வி', te: 'ప్రాథమిక చిరునామాను సెట్ చేయడంలో విఫలమైంది' },
    // Complex logic in address.routes.js will be handled by multi_replace logic.

    // product-variant.routes.js (remaining)
    { file: 'routes/product-variant.routes.js', old: "'A variant with this size already exists for this product'", new: "req.t('errors.product.variantExists')", key: 'errors.product.variantExists', en: 'A variant with this size already exists for this product', hi: 'इस उत्पाद के लिए इस आकार का एक वेरिएट पहले से मौजूद है', ta: 'இந்த தயாரிப்புக்கு இந்த அளவுடன் ஒரு மாறுபாடு ஏற்கனவே உள்ளது', te: 'ఈ ఉత్పత్తికి ఈ పరిమాణంతో వేరియంట్ ఇప్పటికే ఉంది' },

    // invoice.routes.js (remaining)
    { file: 'routes/invoice.routes.js', old: "'Unauthorized'", new: "req.t('errors.auth.unauthorized')", key: 'errors.auth.unauthorized', en: 'Unauthorized', hi: 'अनधिकृत', ta: 'அங்கீகரிக்கப்படாதது', te: 'అనధికృత' },
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
