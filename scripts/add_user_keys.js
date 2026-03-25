#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../backend/locales');
const locales = ['en', 'hi', 'ta', 'te'];

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

const newKeys = [
    { key: 'success.user.blocked', en: 'User blocked successfully', hi: 'उपयोगकर्ता को सफलतापूर्वक ब्लॉक कर दिया गया', ta: 'பயனர் வெற்றிகரமாக முடக்கப்பட்டுள்ளார்', te: 'వినియోగదారు విజయవంతంగా బ్లాక్ చేయబడ్డారు' },
    { key: 'success.user.unblocked', en: 'User unblocked successfully', hi: 'उपयोगकर्ता को सफलतापूर्वक अनब्लॉक कर दिया गया', ta: 'பயனர் வெற்றிகரமாக முடக்கப்படவில்லை', te: 'వినియోగదారు విజయవంతంగా అన్‌బ్లాక్ చేయబడ్డారు' }
];

const backendLocaleData = {};
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    backendLocaleData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

let keysAdded = 0;
for (const r of newKeys) {
    for (const locale of locales) {
        if (r[locale] && setNestedKey(backendLocaleData[locale], r.key, r[locale])) {
            keysAdded++;
        }
    }
}

for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backendLocaleData[locale], null, 2) + '\n', 'utf8');
}

console.log(`Added ${keysAdded} user keys.`);
