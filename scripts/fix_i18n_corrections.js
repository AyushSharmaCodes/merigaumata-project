#!/usr/bin/env node
/**
 * Fix incorrect cross-locale fallback values
 * Phase 1 sync incorrectly used Tamil values for English/Hindi keys
 * This script corrects those with proper translations
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');

function loadJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function setNestedKey(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}

const locales = {};
['en', 'hi', 'ta', 'te'].forEach(l => {
    locales[l] = loadJSON(path.join(FRONTEND_DIR, `${l}.json`));
});

// Fix keys that were incorrectly set with Tamil text
const corrections = {
    "donate.history.noDonations": {
        en: "No donations yet",
        hi: "अभी तक कोई दान नहीं",
        ta: "நன்கொடைகள் எதுவும் இல்லை",
        te: "ఇంకా విరాళాలు లేవు"
    },
    "donate.history.title": {
        en: "My Donation History",
        hi: "मेरा दान इतिहास",
        ta: "எனது நன்கொடை வரலாறு",
        te: "నా విరాళ చరిత్ర"
    },
    "donate.summary.total": {
        en: "Total Donation",
        hi: "कुल दान",
        ta: "மொத்த நன்கொடை",
        te: "మొత్తం విరాళం"
    },
    "errors.cart.outOfStock": {
        en: "Out of Stock",
        hi: "स्टॉक में नहीं है",
        ta: "இருப்பு இல்லை",
        te: "స్టాక్ లేదు"
    },
    "products.bulk.deleteConfirm": {
        en: "Delete {{count}} selected products?",
        hi: "चयनित {{count}} उत्पादों को हटाएं?",
        ta: "தேர்ந்தெடுக்கப்பட்ட {{count}} தயாரிப்புகளை நீக்கவா?",
        te: "ఎంచుకున్న {{count}} ఉత్పత్తులను తొలగించాలా?"
    },
    "admin.analytics.customers.total": {
        en: "Total Customers",
        hi: "कुल ग्राहक",
        ta: "மொத்த வாடிக்கையாளர்கள்",
        te: "మొత్తం కస్టమర్లు"
    },
    "admin.analytics.orders.total": {
        en: "Total Orders",
        hi: "कुल ऑर्डर",
        ta: "மொத்த ஆர்டர்கள்",
        te: "మొత్తం ఆర్డర్లు"
    },
    "admin.analytics.revenue.total": {
        en: "Total Revenue",
        hi: "कुल राजस्व",
        ta: "மொத்த வருவாய்",
        te: "మొత్తం ఆదాయం"
    },
    "admin.newsletter.filters.all": {
        en: "All",
        hi: "सभी",
        ta: "அனைத்தும்",
        te: "అన్నీ"
    },
    "admin.orders.detail.header.orderNumber": {
        en: "Order #{{id}}",
        hi: "ऑर्डर #{{id}}",
        ta: "ஆர்டர் #{{id}}",
        te: "ఆర్డర్ #{{id}}"
    },
    "admin.products.dialog.return.daysCountOne": {
        en: "{{count}} day",
        hi: "{{count}} दिन",
        ta: "{{count}} நாள்",
        te: "{{count}} రోజు"
    },
    "admin.products.dialog.return.isReturnable": {
        en: "This product is returnable",
        hi: "यह उत्पाद वापसी योग्य है",
        ta: "இந்த தயாரிப்பு திரும்பப் பெறக்கூடியது",
        te: "ఈ ఉత్పత్తి రిటర్న్ చేయదగినది"
    },
    "admin.products.stats.variantsCount": {
        en: "{{count}} Variants",
        hi: "{{count}} वैरिएंट",
        ta: "{{count}} மாறுபாடுகள்",
        te: "{{count}} వేరియంట్లు"
    },
    // Fix ta/te keys that got English fallbacks instead of proper translations  
    "common.copyLink": {
        ta: "இணைப்பை நகலெடு",
        te: "లింక్ కాపీ చేయండి"
    },
    "common.failedToCopy": {
        ta: "நகலெடுக்க இயலவில்லை",
        te: "కాపీ చేయడం విఫలమైంది"
    },
    "common.failedToCopyDesc": {
        ta: "கிளிப்போர்டுக்கு இணைப்பை நகலெடுக்க இயலவில்லை.",
        te: "క్లిప్‌బోర్డ్‌కు లింక్ కాపీ చేయడం సాధ్యం కాలేదు."
    },
    "common.linkCopied": {
        ta: "இணைப்பு நகலெடுக்கப்பட்டது",
        te: "లింక్ కాపీ చేయబడింది"
    },
    "common.linkCopiedDesc": {
        ta: "இணைப்பு உங்கள் கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது.",
        te: "లింక్ మీ క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది."
    },
    "common.mobileNumber": {
        ta: "கைபேசி எண்",
        te: "మొబైల్ నంబర్"
    },
    "common.openingDialog": {
        ta: "உரையாடல் திறக்கிறது...",
        te: "డైలాగ్ తెరుస్తోంది..."
    },
    "common.phoneCode": {
        ta: "குறியீடு",
        te: "కోడ్"
    },
    "errors.system.generic_error": {
        ta: "எதிர்பாராத பிழை ஏற்பட்டது",
        te: "ఊహించని లోపం సంభవించింది"
    },
    // Fix admin.contact.hours keys for ta and te
    "admin.contact.hours.appliedOne": {
        ta: "{{count}} நாளுக்கு பயன்படுத்தப்பட்டது",
        te: "{{count}} రోజుకు వర్తించబడింది"
    },
    "admin.contact.hours.appliedOther": {
        ta: "{{count}} நாட்களுக்கு பயன்படுத்தப்பட்டது",
        te: "{{count}} రోజులకు వర్తించబడింది"
    },
    "admin.contact.hours.applyToSelectedOne": {
        ta: "{{count}} தேர்ந்தெடுக்கப்பட்ட நாளுக்கு பயன்படுத்து",
        te: "{{count}} ఎంచుకున్న రోజుకు వర్తింపజేయండి"
    },
    "admin.contact.hours.applyToSelectedOther": {
        ta: "{{count}} தேர்ந்தெடுக்கப்பட்ட நாட்களுக்கு பயன்படுத்து",
        te: "{{count}} ఎంచుకున్న రోజులకు వర్తింపజేయండి"
    },
    "admin.contact.hours.days.mon": { ta: "திங்", te: "సోమ" },
    "admin.contact.hours.days.tue": { ta: "செவ்", te: "మంగళ" },
    "admin.contact.hours.days.wed": { ta: "புத", te: "బుధ" },
    "admin.contact.hours.days.thu": { ta: "வியா", te: "గురు" },
    "admin.contact.hours.days.fri": { ta: "வெள்", te: "శుక్ర" },
    "admin.contact.hours.days.sat": { ta: "சனி", te: "శని" },
    "admin.contact.hours.days.sun": { ta: "ஞாயி", te: "ఆది" },
};

let fixCount = 0;
for (const [key, translations] of Object.entries(corrections)) {
    for (const [lang, value] of Object.entries(translations)) {
        setNestedKey(locales[lang], key, value);
        fixCount++;
    }
}

// Also remove the spurious "there" key that was added to en.json (it's a false positive from the audit)
if (locales.en.there !== undefined) {
    delete locales.en.there;
    console.log('  Removed spurious "there" key from en.json');
}
if (locales.ta && locales.ta.there !== undefined) {
    delete locales.ta.there;
    console.log('  Removed spurious "there" key from ta.json');
}

// Save
for (const lang of ['en', 'hi', 'ta', 'te']) {
    const filePath = path.join(FRONTEND_DIR, `${lang}.json`);
    saveJSON(filePath, locales[lang]);
    console.log(`  ✅ Fixed ${filePath}`);
}

console.log(`\n✅ Fixed ${fixCount} cross-locale fallback values.`);
