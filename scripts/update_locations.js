const fs = require('fs');
const path = require('path');

const localesdDir = path.join(__dirname, '../frontend/src/i18n/locales');

const translations = {
    'hi': {
        'locations.india': 'भारत',
        'locations.delhi': 'दिल्ली',
        'locations.haryana': 'हरियाणा',
        'locations.uttarPradesh': 'उत्तर प्रदेश',
        'locations.maharashtra': 'महाराष्ट्र'
    },
    'te': {
        'locations.india': 'భారతదేశం',
        'locations.delhi': 'ఢిల్లీ',
        'locations.haryana': 'హర్యానా',
        'locations.uttarPradesh': 'ఉత్తర ప్రదేశ్',
        'locations.maharashtra': 'మహారాష్ట్ర'
    },
    'ta': {
        'locations.india': 'இந்தியா',
        'locations.delhi': 'டெல்லி',
        'locations.haryana': 'ஹரியானா',
        'locations.uttarPradesh': 'உத்தர பிரதேசம்',
        'locations.maharashtra': 'மகாராஷ்டிரா'
    },
    'en': {
        'locations.india': 'India',
        'locations.delhi': 'Delhi',
        'locations.haryana': 'Haryana',
        'locations.uttarPradesh': 'Uttar Pradesh',
        'locations.maharashtra': 'Maharashtra'
    }
};

function updateFile(lang, updates) {
    const p = path.join(localesdDir, `${lang}.json`);
    try {
        const content = JSON.parse(fs.readFileSync(p, 'utf8'));

        // Helper to set nested path
        const setPath = (obj, pathStr, value) => {
            const keys = pathStr.split('.');
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        };

        for (const [key, value] of Object.entries(updates)) {
            setPath(content, key, value);
        }

        fs.writeFileSync(p, JSON.stringify(content, null, 2));
        console.log(`Updated ${lang}.json`);
    } catch (e) {
        console.error(`Error updating ${lang}.json:`, e.message);
    }
}

Object.keys(translations).forEach(lang => {
    updateFile(lang, translations[lang]);
});
