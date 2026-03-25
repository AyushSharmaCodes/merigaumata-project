const fs = require('fs');
const path = require('path');

const filePath = '/Users/ayush/Developer/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/src/i18n/locales/en_recovered.json';

// Flatten helper
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
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const flat = flatten(content);
    const keys = Object.keys(flat);
    let hindiCount = 0;

    keys.forEach(k => {
        if (/[\u0900-\u097F]/.test(flat[k])) {
            hindiCount++;
        }
    });

    console.log(`Total Keys: ${keys.length}`);
    console.log(`Hindi Keys in EN: ${hindiCount}`);

} catch (e) {
    console.error('Error parsing JSON:', e.message);
}
