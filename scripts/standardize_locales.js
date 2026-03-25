const fs = require('fs');
const path = require('path');

const localesdDir = path.join(__dirname, '../frontend/src/i18n/locales');
const languages = ['en', 'hi', 'te', 'ta'];

// Helper to flatten object
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

// Helper to unflatten object
function unflatten(data) {
    const result = {};
    for (const i in data) {
        const keys = i.split('.');
        keys.reduce((r, e, j) => {
            return r[e] || (r[e] = (keys.length - 1 === j ? data[i] : {}));
        }, result);
    }
    return result;
}

// Devanagari range: \u0900-\u097F
// Tamil range: \u0B80-\u0BFF
// Telugu range: \u0C00-\u0C7F
function detectLanguageIssue(lang, text) {
    if (typeof text !== 'string') return false;

    if (lang === 'en') {
        // Check for Devanagari, Tamil, Telugu in English file
        if (/[\u0900-\u097F]/.test(text)) return 'Hindi found in EN';
        if (/[\u0B80-\u0BFF]/.test(text)) return 'Tamil found in EN';
        if (/[\u0C00-\u0C7F]/.test(text)) return 'Telugu found in EN';
    }
    return false;
}

const allKeys = new Set();
const fileData = {};

// 1. Load all files and collect keys
console.log('Loading locale files...');
languages.forEach(lang => {
    const p = path.join(localesdDir, `${lang}.json`);
    if (fs.existsSync(p)) {
        try {
            const content = JSON.parse(fs.readFileSync(p, 'utf8'));
            const flat = flatten(content);
            fileData[lang] = flat;
            Object.keys(flat).forEach(k => allKeys.add(k));
            console.log(`Loaded ${lang}: ${Object.keys(flat).length} keys`);
        } catch (e) {
            console.error(`Error reading ${lang}.json:`, e.message);
            fileData[lang] = {};
        }
    } else {
        console.warn(`${lang}.json not found`);
        fileData[lang] = {};
    }
});

const sortedKeys = Array.from(allKeys).sort();
console.log(`Total unique keys across all files: ${sortedKeys.length}`);

// 2. Analyze and Standardize
const newFiles = {};
const report = [];

languages.forEach(lang => {
    newFiles[lang] = {};
    let missingCount = 0;
    let issueCount = 0;

    sortedKeys.forEach(key => {
        let value = fileData[lang][key];

        // Check if missing
        if (value === undefined) {
            missingCount++;
            // Strategy: 
            // 1. Try to use English value if we are in HI/TE/TA (better than empty)
            // 2. If EN is missing, try to find a key from other files that looks like English (ASCII)
            // 3. Fallback to placeholder

            if (lang !== 'en' && fileData['en'][key]) {
                value = `[MISSING_TRANSLATION] ${fileData['en'][key]}`;
            } else {
                value = `[MISSING_${lang.toUpperCase()}]`;
            }
        }

        // Check for language issues
        const issue = detectLanguageIssue(lang, value);
        if (issue) {
            issueCount++;
            value = `[FIX_ME_LANG_MIX] ${value}`; // Mark it so user sees it
        }

        newFiles[lang][key] = value;
    });

    console.log(`\nAnalysis for ${lang}:`);
    console.log(`- Missing keys added: ${missingCount}`);
    console.log(`- Language issues found: ${issueCount}`);
});

// 3. Write back
console.log('\nWriting standardized files...');
languages.forEach(lang => {
    const unflattened = unflatten(newFiles[lang]);
    // Sort keys just in case unflatten doesn't preserve strict order (it usually doesn't for object keys)
    // Actually JSON.stringify doesn't guarantee order, but modern JS engines mostly do. 
    // Usually standardizing keys requires a recursive sort. 

    const p = path.join(localesdDir, `${lang}.json`);
    // We strictly want readable JSON
    fs.writeFileSync(p, JSON.stringify(unflattened, null, 2));
});

console.log('Done.');
