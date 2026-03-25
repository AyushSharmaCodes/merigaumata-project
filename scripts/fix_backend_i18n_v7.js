#!/usr/bin/env node
/**
 * Fix ALL remaining backend hardcoded strings found in verification (Pass 7 - Final Final).
 * This covers faq.routes.js and remaining account-deletion.routes.js strings.
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
    // faq.routes.js
    { file: 'routes/faq.routes.js', old: "'FAQ not found'", new: "req.t('errors.faq.notFound')", key: 'errors.faq.notFound', en: 'FAQ not found', hi: 'FAQ नहीं मिला', ta: 'FAQ காணப்படவில்லை', te: 'FAQ కనుగొనబడలేదు' },
    { file: 'routes/faq.routes.js', old: "'Question, answer, and category are required'", new: "req.t('errors.faq.missingFields')", key: 'errors.faq.missingFields', en: 'Question, answer, and category are required', hi: 'प्रश्न, उत्तर और श्रेणी आवश्यक हैं', ta: 'கேள்வி, பதில் மற்றும் வகை தேவை', te: 'ప్రశ్న, సమాధానం మరియు వర్గం అవసరం' },
    { file: 'routes/faq.routes.js', old: "'FAQs array is required'", new: "req.t('errors.faq.arrayRequired')", key: 'errors.faq.arrayRequired', en: 'FAQs array is required', hi: 'FAQ सरणी आवश्यक है', ta: 'FAQ வரிசை தேவை', te: 'FAQ శ్రేణి అవసరం' },

    // account-deletion.routes.js (remaining)
    { file: 'routes/account-deletion.routes.js', old: "'Failed to check eligibility'", new: "req.t('errors.deletion.checkEligibilityFailed')", key: 'errors.deletion.checkEligibilityFailed', en: 'Failed to check eligibility', hi: 'पात्रता की जांच करने में विफल', ta: 'தகுதியைச் சரிபார்ப்பதில் தோல்வி', te: 'అర్హతను తనిఖీ చేయడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'Failed to get deletion status'", new: "req.t('errors.deletion.getStatusFailed')", key: 'errors.deletion.getStatusFailed', en: 'Failed to get deletion status', hi: 'हटाने की स्थिति प्राप्त करने में विफल', ta: 'நீக்குதல் நிலையைப் பெறுவதில் தோல்வி', te: 'తొలగింపు స్థితిని పొందడంలో విఫలమైంది' },
    { file: 'routes/account-deletion.routes.js', old: "'Email is required for verification'", new: "req.t('errors.deletion.emailRequired')", key: 'errors.deletion.emailRequired', en: 'Email is required for verification', hi: 'सत्यापन के लिए ईमेल आवश्यक है', ta: 'சரிபார்ப்பதற்கு மின்னஞ்சல் தேவை', te: 'ధృవీకరణ కోసం ఇమెయిల్ అవసరం' },
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
