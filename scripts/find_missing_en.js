const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../frontend/src/i18n/locales/en.json');
const hiPath = path.join(__dirname, '../frontend/src/i18n/locales/hi.json');

function flatten(obj, prefix = '', res = {}) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            flatten(obj[key], prefix + key + '.', res);
        } else {
            res[prefix + key] = obj[key];
        }
    }
    return res;
}

try {
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));

    const flatEn = flatten(en);
    const flatHi = flatten(hi);

    const missing = {};

    Object.keys(flatEn).forEach(key => {
        const val = flatEn[key];
        // Check for placeholders or Hindi chars
        if (
            val === '' ||
            val.includes('[MISSING_EN]') ||
            val.includes('[FIX_ME') ||
            /[\u0900-\u097F]/.test(val) // Hindi chars
        ) {
            missing[key] = {
                en: val,
                hi: flatHi[key] || 'NOT FOUND IN HI'
            };
        }
    });

    console.log(JSON.stringify(missing, null, 2));

} catch (e) {
    console.error(e);
}
