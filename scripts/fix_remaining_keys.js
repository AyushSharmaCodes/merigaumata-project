#!/usr/bin/env node
/**
 * Fix remaining 6 missing frontend t() keys found by audit
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');

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

const newKeys = {
    'admin.users.dialog.addDescription': {
        en: 'Fill in the details below to add a new user.',
        hi: 'नया उपयोगकर्ता जोड़ने के लिए नीचे विवरण भरें।',
        ta: 'புதிய பயனரை சேர்க்க கீழே விவரங்களை நிரப்பவும்.',
        te: 'కొత్త వినియోగదారుని జోడించడానికి క్రింద వివరాలను నింపండి.'
    },
    'admin.users.dialog.basicInfo': {
        en: 'Basic Information',
        hi: 'मूलभूत जानकारी',
        ta: 'அடிப்படை தகவல்',
        te: 'ప్రాథమిక సమాచారం'
    },
    'admin.users.ordersDialog.description': {
        en: 'Order history and details',
        hi: 'ऑर्डर इतिहास और विवरण',
        ta: 'ஆர்டர் வரலாறு மற்றும் விவரங்கள்',
        te: 'ఆర్డర్ చరిత్ర మరియు వివరాలు'
    },
    'admin.users.ordersDialog.noOrders': {
        en: 'No orders found for this user.',
        hi: 'इस उपयोगकर्ता के लिए कोई ऑर्डर नहीं मिले।',
        ta: 'இந்த பயனருக்கு ஆர்டர்கள் எதுவும் இல்லை.',
        te: 'ఈ వినియోగదారునికి ఆర్డర్లు కనుగొనబడలేదు.'
    },
    'common.date': {
        en: 'Date',
        hi: 'तारीख',
        ta: 'தேதி',
        te: 'తేదీ'
    },
    'profile.personalInfo': {
        en: 'Personal Information',
        hi: 'व्यक्तिगत जानकारी',
        ta: 'தனிப்பட்ட தகவல்',
        te: 'వ్యక్తిగత సమాచారం'
    },
};

const locales = ['en', 'hi', 'ta', 'te'];
const localeData = {};

for (const locale of locales) {
    const filePath = path.join(FRONTEND_DIR, `${locale}.json`);
    localeData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

let addedCount = 0;
for (const [keyPath, translations] of Object.entries(newKeys)) {
    for (const locale of locales) {
        const value = translations[locale];
        if (value && setNestedKey(localeData[locale], keyPath, value)) {
            addedCount++;
            console.log(`  Added ${locale}: ${keyPath}`);
        }
    }
}

for (const locale of locales) {
    const filePath = path.join(FRONTEND_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(localeData[locale], null, 2) + '\n', 'utf8');
}

console.log(`\nDone! Added ${addedCount} keys.`);
