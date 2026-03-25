const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');
const locales = ['en', 'hi', 'ta', 'te'];

const updates = {
    'STATUS.REFUNDED': {
        en: 'Refunded',
        hi: 'वापस किया गया',
        ta: 'திரும்பப் பெறப்பட்டது',
        te: 'రీఫండ్ చేయబడింది'
    },
    'cancelled': {
        en: 'Cancelled',
        hi: 'रद्द किया गया',
        ta: 'ரத்து செய்யப்பட்டது',
        te: 'రద్దు చేయబడింది'
    }
};

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

// Helper to find and update a key recursively if it exists with a specific value or just key
function findAndUpdateKey(obj, targetKey, newValue) {
    let found = false;
    for (const key in obj) {
        if (key === targetKey) {
            // Found it! Update it.
            // Only update if it contains [MISSING_TRANSLATION] or we want to force update
            // But user specifically asked to fix [MISSING_TRANSLATION] Cancelled.
            // However, since we want to sync all, we can enforce the value.
            obj[key] = newValue;
            found = true;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (findAndUpdateKey(obj[key], targetKey, newValue)) {
                found = true;
            }
        }
    }
    return found;
}

async function main() {
    console.log('Starting update...');

    for (const lang of locales) {
        const filePath = path.join(FRONTEND_DIR, `${lang}.json`);
        if (!fs.existsSync(filePath)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            let modified = false;

            // 1. Add STATUS.REFUNDED (Nested)
            const refundedVal = updates['STATUS.REFUNDED'][lang];
            setNestedKey(data, 'STATUS.REFUNDED', refundedVal);
            console.log(`[${lang}] Added/Updated STATUS.REFUNDED`);
            modified = true;

            // 2. Fix 'cancelled'
            // We search for the key 'cancelled' and update it. 
            // NOTE: There might be multiple 'cancelled' keys (nested). 
            // The one with [MISSING_TRANSLATION] is likely the target.
            // But to be safe and thorough, let's update specific known locations if possible, 
            // or just update top-level/common ones. 
            // Based on grep, "cancelled": "[MISSING_TRANSLATION] Cancelled" appeared.
            // Let's traverse and update any 'cancelled' whose value contains '[MISSING_TRANSLATION]'

            function deepUpdate(obj) {
                for (const k in obj) {
                    if (k === 'cancelled') {
                        if (obj[k] === '[MISSING_TRANSLATION] Cancelled' || obj[k] === 'Cancelled') {
                            obj[k] = updates['cancelled'][lang];
                            console.log(`[${lang}] Updated 'cancelled' key`);
                            modified = true;
                        }
                    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                        deepUpdate(obj[k]);
                    }
                }
            }
            deepUpdate(data);

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            }

        } catch (e) {
            console.error(`Error processing ${lang}:`, e);
        }
    }
    console.log('Done.');
}

main();
