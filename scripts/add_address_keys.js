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
    { key: 'errors.address.typeExists', en: "You already have a {{type}} address. Please update the existing one or add as 'other' type.", hi: 'आपके पास पहले से ही एक {{type}} पता है। कृपया मौजूदा अपडेट करें या \'अन्य\' प्रकार के रूप में जोड़ें।', ta: 'உங்களிடம் ஏற்கனவே ஒரு {{type}} முகவரி உள்ளது. ஏற்கனவே உள்ளதைப் புதுப்பிக்கவும் அல்லது \'பிற\' வகையாகச் சேர்க்கவும்.', te: 'మీకు ఇప్పటికే {{type}} చిరునామా ఉంది. దయచేసి ఉన్నదాన్ని అప్‌డేట్ చేయండి లేదా \'ఇతర\' రకంగా జోడించండి.' },
    { key: 'errors.address.typeExistsUpdate', en: 'You already have a {{type}} address. Cannot change type.', hi: 'आपके पास पहले से ही एक {{type}} पता है। प्रकार नहीं बदला जा सकता।', ta: 'உங்களிடம் ஏற்கனவே ஒரு {{type}} முகவரி உள்ளது. வகையை மாற்ற முடியாது.', te: 'మీకు ఇప్పటికే {{type}} చిరునామా ఉంది. రకాన్ని మార్చలేరు.' }
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

console.log(`Added ${keysAdded} address callback keys.`);
