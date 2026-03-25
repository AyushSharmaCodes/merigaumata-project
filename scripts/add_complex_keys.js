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
    { key: 'errors.jobs.retryInvalidStatus', en: 'Cannot retry job with status {{status}}. Only FAILED or BLOCKED jobs can be retried.', hi: 'स्थिति {{status}} वाले कार्य का पुनः प्रयास नहीं किया जा सकता। केवल FAILED या BLOCKED कार्यों का पुनः प्रयास किया जा सकता है।', ta: '{{status}} நிலையிலுள்ள பணியை மீண்டும் முயற்சிக்க முடியாது. FAILED அல்லது BLOCKED பணிகளை மட்டுமே மீண்டும் முயற்சிக்க முடியும்.', te: '{{status}} స్థితిలో ఉన్న జాబ్‌ని మళ్లీ ప్రయత్నించలేము. FAILED లేదా BLOCKED జాబ్‌లను మాత్రమే మళ్లీ ప్రయత్నించవచ్చు.' },
    { key: 'errors.jobs.retryInvalidStatusEvent', en: 'Cannot retry job with status {{status}}. Only FAILED or PARTIAL_FAILURE jobs can be retried.', hi: 'स्थिति {{status}} वाले कार्य का पुनः प्रयास नहीं किया जा सकता।', ta: '{{status}} நிலையிலுள்ள பணியை மீண்டும் முயற்சிக்க முடியாது.', te: '{{status}} స్థితిలో ఉన్న జాబ్‌ని మళ్లీ ప్రయత్నించలేము.' },
    { key: 'success.jobs.eventRetryTriggered', en: 'Event cancellation job retry triggered. Processing {{count}} registrations.', hi: 'इवेंट रद्दीकरण कार्य पुनः प्रयास शुरू किया गया। {{count}} पंजीकरण संसाधित किए जा रहे हैं।', ta: 'நிகழ்வு ரத்து பணி மீண்டும் முயற்சி தூண்டப்பட்டது. {{count}} பதிவுகளைச் செயலாக்குகிறது.', te: 'ఈవెంట్ రద్దు జాబ్ రీట్రై ట్రిగ్గర్ చేయబడింది. {{count}} నమోదులను ప్రాసెస్ చేస్తోంది.' },
    { key: 'errors.jobs.processInvalidStatus', en: 'Cannot process job with status {{status}}. Only PENDING jobs can be processed.', hi: 'स्थिति {{status}} वाले कार्य को संसाधित नहीं किया जा सकता। केवल PENDING कार्यों को संसाधित किया जा सकता है।', ta: '{{status}} நிலையிலுள்ள பணியை செயலாக்க முடியாது. PENDING பணிகளை மட்டுமே செயலாக்க முடியும்.', te: '{{status}} స్థితిలో ఉన్న జాబ్‌ని ప్రాసెస్ చేయలేము. PENDING జాబ్‌లను మాత్రమే ప్రాసెస్ చేయవచ్చు.' },

    { key: 'errors.checkout.couponExpired', en: 'Coupon "{{code}}" is no longer valid', hi: 'कूपन "{{code}}" अब मान्य नहीं है', ta: 'கூப்பன் "{{code}}" இப்போது செல்லுபடியாகாது', te: 'కూపన్ "{{code}}" ఇకపై చెల్లుబాటు కాదు' },

    { key: 'errors.checkout.outOfStock', en: 'Sorry, {{itemDesc}} is out of stock. Please adjust your quantity.', hi: 'क्षमा करें, {{itemDesc}} स्टॉक में नहीं है। कृपया अपनी मात्रा समायोजित करें।', ta: 'மன்னிக்கவும், {{itemDesc}} கையிருப்பில் இல்லை. தயவுசெய்து உங்கள் அளவை சரிசெய்யவும்.', te: 'క్షమించండి, {{itemDesc}} స్టాక్‌లో లేదు. దయచేసి మీ పరిమాణాన్ని సర్దుబాటు చేయండి.' },
    { key: 'errors.checkout.lowStock', en: 'Sorry, {{itemDesc}} is low on stock (only {{count}} available). Please adjust your quantity.', hi: 'क्षमा करें, {{itemDesc}} का स्टॉक कम है (केवल {{count}} उपलब्ध)।', ta: 'மன்னிக்கவும், {{itemDesc}} கையிருப்பு குறைவாக உள்ளது ({{count}} மட்டுமே உள்ளது).', te: 'క్షమించండి, {{itemDesc}} స్టాక్ తక్కువగా ఉంది ({{count}} మాత్రమే అందుబాటులో ఉంది).' }
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

console.log(`Added ${keysAdded} complex keys.`);
