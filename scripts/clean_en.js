const fs = require('fs');
const path = require('path');

const inputFile = '/Users/ayush/Developer/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/src/i18n/locales/en_recovered.json';
const outputFile = '/Users/ayush/Developer/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/src/i18n/locales/en.json';

// Flatten/Unflatten per usual to traverse easily, or just recursive walk
function walk(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            walk(obj[key]);
        } else if (typeof obj[key] === 'string') {
            if (/[\u0900-\u097F]/.test(obj[key])) {
                obj[key] = `[MISSING_EN] Hindi was: ${obj[key].substring(0, 20)}...`;
            }
        }
    }
}

try {
    const content = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    walk(content);
    fs.writeFileSync(outputFile, JSON.stringify(content, null, 2));
    console.log('Cleaned en.json written.');
} catch (e) {
    console.error('Error:', e.message);
}
