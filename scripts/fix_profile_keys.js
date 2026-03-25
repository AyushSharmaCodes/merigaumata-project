#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../frontend/src/i18n/locales');
const keys = {
    'profile.personalInfo.title': { en: 'Personal Information', hi: 'व्यक्तिगत जानकारी', ta: 'தனிப்பட்ட தகவல்', te: 'వ్యక్తిగత సమాచారం' },
    'profile.emailAddress': { en: 'Email Address', hi: 'ईमेल पता', ta: 'மின்னஞ்சல் முகவரி', te: 'ఇமెయిల్ చిరునామా' },
    'profile.mobileNumber': { en: 'Mobile Number', hi: 'मोबाइल नंबर', ta: 'மொபைல் எண்', te: 'మొబైల్ నంబర్' },
};
for (const locale of ['en', 'hi', 'ta', 'te']) {
    const fp = path.join(dir, locale + '.json');
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const [kp, vals] of Object.entries(keys)) {
        const parts = kp.split('.');
        let cur = data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        if (cur[parts[parts.length - 1]] === undefined) {
            cur[parts[parts.length - 1]] = vals[locale];
            console.log('Added ' + locale + ': ' + kp);
        }
    }
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
console.log('Done');
