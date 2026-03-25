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
    { key: 'errors.event.retryInvalidStatus', en: 'Cannot retry job with status "{{status}}". Only FAILED or PARTIAL_FAILURE jobs can be retried.', hi: 'स्थिति "{{status}}" वाले कार्य का पुनः प्रयास नहीं किया जा सकता। केवल FAILED या PARTIAL_FAILURE कार्यों का पुनः प्रयास किया जा सकता है।', ta: '"{{status}}" நிலையிலுள்ள பணியை மீண்டும் முயற்சிக்க முடியாது. FAILED அல்லது PARTIAL_FAILURE பணிகளை மட்டுமே மீண்டும் முயற்சிக்க முடியும்.', te: '"{{status}}" స్థితిలో ఉన్న జాబ్‌ని మళ్లీ ప్రయత్నించలేము. FAILED లేదా PARTIAL_FAILURE జాబ్‌లను మాత్రమే మళ్లీ ప్రయత్నించవచ్చు.' },
    { key: 'success.event.retryInitiated', en: 'Retry initiated. Processing {{count}} remaining registrations.', hi: 'पुनः प्रयास शुरू किया गया। {{count}} शेष पंजीकरण संसाधित किए जा रहे हैं।', ta: 'மறுமுயற்சி தொடங்கப்பட்டது. {{count}} மீதமுள்ள பதிவுகளைச் செயலாக்குகிறது.', te: 'రీట్రై ప్రారంభించబడింది. {{count}} మిగిలిన నమోదులను ప్రాసెస్ చేస్తోంది.' }
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

console.log(`Added ${keysAdded} event keys.`);
