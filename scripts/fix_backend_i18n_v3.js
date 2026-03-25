#!/usr/bin/env node
/**
 * Fix ALL remaining backend hardcoded strings found in deep audit.
 * version 3 - The definitive fix.
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
    // category.routes.js
    { file: 'routes/category.routes.js', old: "'Invalid category type. Must be: product, event, faq, or gallery'", new: "req.t('errors.category.invalidType')", key: 'errors.category.invalidType', en: 'Invalid category type. Must be: product, event, faq, or gallery', hi: 'अमान्य श्रेणी प्रकार। उत्पाद, कार्यक्रम, सामान्य प्रश्न, या गैलरी होना चाहिए।', ta: 'செல்லாத வகை வகை. தயாரிப்பு, நிகழ்வு, கேள்விகள் அல்லது கேலரியாக இருக்க வேண்டும்.', te: 'చెల్లని వర్గం రకం. ఉత్పత్తి, ఈవెంట్, తరచుగా అడిగే ప్రశ్నలు లేదా గ్యాలరీ అయి ఉండాలి.' },

    // jobs.routes.js
    { file: 'routes/jobs.routes.js', old: "'Admin access required'", new: "req.t('errors.auth.adminRequired')", key: 'errors.auth.adminRequired', en: 'Admin access required', hi: 'व्यवस्थापक पहुँच आवश्यक है', ta: 'நிர்வாக அணுகல் தேவை', te: 'అడ్మిన్ యాక్సెస్ అవసరం' },
    { file: 'routes/jobs.routes.js', old: "'Failed to fetch jobs'", new: "req.t('errors.jobs.fetchFailed')", key: 'errors.jobs.fetchFailed', en: 'Failed to fetch jobs', hi: 'कार्य प्राप्त کرنے में विफल', ta: 'வேலைகளைப் பெறுவதில் தோல்வி', te: 'జాబ్స్ పొందడంలో విఫలమైంది' },
    { file: 'routes/jobs.routes.js', old: "'Job not found'", new: "req.t('errors.jobs.notFound')", key: 'errors.jobs.notFound', en: 'Job not found', hi: 'कार्य नहीं मिला', ta: 'வேலை காணப்படவில்லை', te: 'జాబ్ కనుగొనబడలేదు' },
    { file: 'routes/jobs.routes.js', old: "'Failed to fetch job details'", new: "req.t('errors.jobs.fetchDetailsFailed')", key: 'errors.jobs.fetchDetailsFailed', en: 'Failed to fetch job details', hi: 'कार्य विवरण प्राप्त करने में विफल', ta: 'வேலை விவரங்களைப் பெறுவதில் தோல்வி', te: 'జాబ్ వివరాలు పొందడంలో విఫలమైంది' },
    { file: 'routes/jobs.routes.js', old: "`Manual retry by admin`", new: "req.t('jobs.manualRetry')", key: 'jobs.manualRetry', en: 'Manual retry by admin', hi: 'व्यवस्थापक द्वारा मैन्युअल पुनः प्रयास', ta: 'நிர்வாகியால் கைமுறை மறுமுயற்சி', te: 'అడ్మిన్ ద్వారా మాన్యువల్ రీట్రై' },
    { file: 'routes/jobs.routes.js', old: "'Failed to retry job'", new: "req.t('errors.jobs.retryFailed')", key: 'errors.jobs.retryFailed', en: 'Failed to retry job', hi: 'कार्य पुनः प्रयास विफल', ta: 'வேலையை மீண்டும் முயல்வதில் தோல்வி', te: 'జాబ్ రీట్రై విఫలమైంది' },
    { file: 'routes/jobs.routes.js', old: "'Failed to process job'", new: "req.t('errors.jobs.processFailed')", key: 'errors.jobs.processFailed', en: 'Failed to process job', hi: 'कार्य संसाधित करने में विफल', ta: 'வேலையைச் செயலாக்குவதில் தோல்வி', te: 'జాబ్ ప్రాసెస్ చేయడంలో విఫలమైంది' },

    // jobs.routes.js - Template Literals (using regex logic in script below or manual replace content for complex ones, but here simple ones)
    // Complex ones will be handled by replace_file_content tool after this script.

    // custom-invoice.routes.js
    { file: 'routes/custom-invoice.routes.js', old: "'Invalid invoice type'", new: "req.t('errors.invoice.invalidType')", key: 'errors.invoice.invalidType', en: 'Invalid invoice type', hi: 'अमान्य चालान प्रकार', ta: 'செல்லாத விலைப்பட்டியல் வகை', te: 'చెల్లని ఇన్వాయిస్ రకం' },
    { file: 'routes/custom-invoice.routes.js', old: "'Order not found'", new: "req.t('errors.order.notFound')", key: 'errors.order.notFound', en: 'Order not found', hi: 'आर्डर नहीं मिला', ta: 'ஆர்டர் காணப்படவில்லை', te: 'ఆర్డర్ కనుగొనబడలేదు' },
    { file: 'routes/custom-invoice.routes.js', old: "'Unauthorized'", new: "req.t('errors.auth.unauthorized')", key: 'errors.auth.unauthorized', en: 'Unauthorized', hi: 'अनधिकृत', ta: 'அங்கீகரிக்கப்படாதது', te: 'అనధికృత' },
    { file: 'routes/custom-invoice.routes.js', old: "'Invoices can only be generated for delivered orders'", new: "req.t('errors.invoice.deliveredOrdersOnly')", key: 'errors.invoice.deliveredOrdersOnly', en: 'Invoices can only be generated for delivered orders', hi: 'चालान केवल वितरित आदेशों के लिए उत्पन्न किए जा सकते हैं', ta: 'வழங்கப்பட்ட ஆர்டர்களுக்கு மட்டுமே விலைப்பட்டியல்கள் உருவாக்க முடியும்', te: 'డెలివరీ అయిన ఆర్డర్‌లకు మాత్రమే ఇన్వాయిస్‌లు జనరేట్ చేయబడతాయి' },
    { file: 'routes/custom-invoice.routes.js', old: "'Internal server error'", new: "req.t('errors.system.internalError')", key: 'errors.system.internalError', en: 'Internal server error', hi: 'आंतरिक सर्वर त्रुटि', ta: 'உள்ளக சேவையக பிழை', te: 'అంతర్గత సర్వర్ లోపం' },

    // invoice.routes.js
    { file: 'routes/invoice.routes.js', old: "'Invoice not found'", new: "req.t('errors.invoice.notFound')", key: 'errors.invoice.notFound', en: 'Invoice not found', hi: 'चालान नहीं मिला', ta: 'விலைப்பட்டியல் காணப்படவில்லை', te: 'ఇన్వాయిస్ కనుగొనబడలేదు' },
    { file: 'routes/invoice.routes.js', old: "'Unauthorized to access this invoice'", new: "req.t('errors.invoice.unauthorizedAccess')", key: 'errors.invoice.unauthorizedAccess', en: 'Unauthorized to access this invoice', hi: 'इस चालान तक पहुँचने के लिए अनधिकृत', ta: 'இந்த விலைப்பட்டியலை அணுக அதிகாரம் இல்லை', te: 'ఈ ఇన్వాయిస్‌ను యాక్సెస్ చేయడానికి అనుమతి లేదు' },
    { file: 'routes/invoice.routes.js', old: "'Razorpay invoice URL not found'", new: "req.t('errors.invoice.razorpayUrlNotFound')", key: 'errors.invoice.razorpayUrlNotFound', en: 'Razorpay invoice URL not found', hi: 'रेज़रपे चालान URL नहीं मिला', ta: 'Razorpay விலைப்பட்டியல் URL காணப்படவில்லை', te: 'Razorpay ఇన్వాయిస్ URL కనుగొనబడలేదు' },
    { file: 'routes/invoice.routes.js', old: "'Failed to access invoice storage'", new: "req.t('errors.invoice.storageAccessFailed')", key: 'errors.invoice.storageAccessFailed', en: 'Failed to access invoice storage', hi: 'चालान भंडारण तक पहुँचने में विफल', ta: 'விலைப்பட்டியல் சேமிப்பகத்தை அணுகுவதில் தோல்வி', te: 'ఇన్వాయిస్ స్టోరేజ్‌ని యాక్సెస్ చేయడంలో విఫలమైంది' },
    { file: 'routes/invoice.routes.js', old: "'Invoice file not found'", new: "req.t('errors.invoice.fileNotFound')", key: 'errors.invoice.fileNotFound', en: 'Invoice file not found', hi: 'चालान फ़ाइल नहीं मिली', ta: 'விலைப்பட்டியல் கோப்பு காணப்படவில்லை', te: 'ఇన్వాయిస్ ఫైల్ కనుగొనబడలేదు' },
    { file: 'routes/invoice.routes.js', old: "'Failed to regenerate invoice'", new: "req.t('errors.invoice.regenerationFailed')", key: 'errors.invoice.regenerationFailed', en: 'Failed to regenerate invoice', hi: 'चालान पुन: उत्पन्न करने में विफल', ta: 'விலைப்பட்டியலை மீண்டும் உருவாக்குவதில் தோல்வி', te: 'ఇన్వాయిస్‌ను రీజనరేట్ చేయడంలో విఫలమైంది' },

    // email.routes.js
    { file: 'routes/email.routes.js', old: "'Failed to get email status'", new: "req.t('errors.email.statusFetchFailed')", key: 'errors.email.statusFetchFailed', en: 'Failed to get email status', hi: 'ईमेल स्थिति प्राप्त करने में विफल', ta: 'மின்னஞ்சல் நிலையைப் பெறுவதில் தோல்வி', te: 'ఇమెయిల్ స్థితిని పొందడంలో విఫలమైంది' },
    { file: 'routes/email.routes.js', old: "'Recipient email is required'", new: "req.t('errors.email.recipientRequired')", key: 'errors.email.recipientRequired', en: 'Recipient email is required', hi: 'प्राप्तकर्ता ईमेल आवश्यक है', ta: 'பெறுநர் மின்னஞ்சல் தேவை', te: 'స్వీకర్త ఇమెయిల్ అవసరం' },

    // checkout.routes.js
    { file: 'routes/checkout.routes.js', old: "'Please select a valid quantity (1-100).'", new: "req.t('errors.checkout.invalidQuantityRange')", key: 'errors.checkout.invalidQuantityRange', en: 'Please select a valid quantity (1-100).', hi: 'कृपया एक मान्य मात्रा (1-100) चुनें।', ta: 'தயவுசெய்து சரியான அளவைத் தேர்ந்தெடுக்கவும் (1-100).', te: 'దయచేసి సరైన పరిమాణాన్ని ఎంచుకోండి (1-100).' },

    // profile.routes.js
    { file: 'routes/profile.routes.js', old: "'Password must be at least 6 characters long'", new: "req.t('errors.validation.passwordLength')", key: 'errors.validation.passwordLength', en: 'Password must be at least 6 characters long', hi: 'पासवर्ड कम से कम 6 अक्षर लंबा होना चाहिए', ta: 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்', te: 'పాస్‌వర్డ్ కనీసం 6 అక్షరాలు ఉండాలి' },

    // donation.routes.js
    { file: 'routes/donation.routes.js', old: "'Webhook processing failed'", new: "req.t('errors.donation.webhookFailed')", key: 'errors.donation.webhookFailed', en: 'Webhook processing failed', hi: 'वेबहुक प्रसंस्करण विफल', ta: 'வெப்ஹூக் செயலாக்கம் தோல்வியடைந்தது', te: 'వెబ్‌హుక్ ప్రాసెసింగ్ విఫలమైంది' },

    // admin-alert.routes.js
    { file: 'routes/admin-alert.routes.js', old: "'Failed to fetch alerts'", new: "req.t('errors.admin.alertsFetchFailed')", key: 'errors.admin.alertsFetchFailed', en: 'Failed to fetch alerts', hi: 'सचेतक प्राप्त करने में विफल', ta: 'எச்சரிக்கைகளைப் பெறுவதில் தோல்வி', te: 'అలర్ట్‌లను పొందడంలో విఫలమైంది' },
    { file: 'routes/admin-alert.routes.js', old: "'Failed to update alert'", new: "req.t('errors.admin.alertUpdateFailed')", key: 'errors.admin.alertUpdateFailed', en: 'Failed to update alert', hi: 'सचेतक अपडेट करने में विफल', ta: 'எச்சரிக்கையைப் புதுப்பிப்பதில் தோல்வி', te: 'అలర్ట్‌ను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/admin-alert.routes.js', old: "'Failed to update alerts'", new: "req.t('errors.admin.alertsUpdateFailed')", key: 'errors.admin.alertsUpdateFailed', en: 'Failed to update alerts', hi: 'सचेतक अपडेट करने में विफल', ta: 'எச்சரிக்கைகளைப் புதுப்பிப்பதில் தோல்வி', te: 'అలర్ట్‌లను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/admin-alert.routes.js', old: "'Internal Server Error'", new: "req.t('errors.system.internalError')", key: 'errors.system.internalError', en: 'Internal Server Error', hi: 'आंतरिक सर्वर त्रुटि', ta: 'உள்ளக சேவையக பிழை', te: 'అంతర్గత సర్వర్ లోపం' },

    // webhook.routes.js
    { file: 'routes/webhook.routes.js', old: "'Invalid JSON body'", new: "req.t('errors.webhook.invalidJson')", key: 'errors.webhook.invalidJson', en: 'Invalid JSON body', hi: 'अमान्य जेएसओएन बॉडी', ta: 'செல்லாத JSON உள்ளடக்கம்', te: 'చెల్లని JSON బాడీ' },
    { file: 'routes/webhook.routes.js', old: "'Failed to fetch webhook logs'", new: "req.t('errors.webhook.logsFetchFailed')", key: 'errors.webhook.logsFetchFailed', en: 'Failed to fetch webhook logs', hi: 'वेबहुक लॉग प्राप्त करने में विफल', ta: 'வெப்ஹூக் பதிவுகளைப் பெறுவதில் தோல்வி', te: 'వెబ్‌హుక్ లాగ్‌లను పొందడంలో విఫలమైంది' },
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
