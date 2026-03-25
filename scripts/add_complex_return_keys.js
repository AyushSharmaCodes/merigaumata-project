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
    { key: 'success.return.statusUpdated', en: 'Return status updated to {{status}}', hi: 'वापसी की स्थिति {{status}} पर अपडेट की गई', ta: 'திரும்பும் நிலை {{status}} க்கு புதுப்பிக்கப்பட்டது', te: 'రిటర్న్ స్థితి {{status}}కి అప్‌డేట్ చేయబడింది' },
    { key: 'success.return.itemStatusUpdated', en: 'Return item status updated to {{status}}', hi: 'वापसी आइटम की स्थिति {{status}} पर अपडेट की गई', ta: 'திரும்பும் உருப்படியின் நிலை {{status}} க்கு புதுப்பிக்கப்பட்டது', te: 'రిటర్న్ ఐటెమ్ స్థితి {{status}}కి అప్‌డేట్ చేయబడింది' },
    { key: 'errors.deletion.jobStatusInvalid', en: 'Job status is {{status}}, not PENDING. Update status first.', hi: 'कार्य की स्थिति {{status}} है, PENDING नहीं। पहले स्थिति अपडेट करें।', ta: 'பணியின் நிலை {{status}}, PENDING அல்ல. முதலில் நிலையைப் புதுப்பிக்கவும்.', te: 'జాబ్ స్థితి {{status}}, PENDING కాదు. ముందుగా స్థితిని అప్‌డేట్ చేయండి.' }
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

console.log(`Added ${keysAdded} complex return/deletion keys.`);
