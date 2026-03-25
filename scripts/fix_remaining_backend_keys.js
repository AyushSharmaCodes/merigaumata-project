const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');
const BACKEND_DIR = path.join(__dirname, '../backend/locales');
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
    // Set if missing or empty
    if (current[parts[parts.length - 1]] === undefined || current[parts[parts.length - 1]] === "") {
        current[parts[parts.length - 1]] = value;
        return true;
    }
    return false;
}

const frontendKeys = {
    'cart.summary.taxDisclaimerInclusive': {
        en: '* Prices inclusive of all taxes',
        hi: '* सभी करों सहित कीमतें',
        ta: '* அனைத்து வரிகளும் அடங்கிய விலை',
        te: '* అన్ని పన్నులు కలుపుకుని ధరలు'
    }
};

const backendKeys = {
    'common.order.statusUpdated': { en: 'Order status updated', hi: 'ऑर्डर स्थिति अपडेट की गई', ta: 'ஆர்டர் நிலை புதுப்பிக்கப்பட்டது', te: 'ఆర్డర్ స్థితి నవీకరించబడింది' },
    'success.jobs.refundProcessingTriggered': { en: 'Refund processing has been triggered', hi: 'वापसी प्रक्रिया शुरू कर दी गई है', ta: 'திரும்பப் பெறுதல் செயல்முறை தூண்டப்பட்டுள்ளது', te: 'రీఫండ్ ప్రాసెసింగ్ ప్రారంభించబడింది' },
    'success.jobs.refundRetryTriggered': { en: 'Refund retry has been triggered', hi: 'वापसी पुनः प्रयास शुरू कर दिया गया है', ta: 'திரும்பப் பெறுதல் மறுமுயற்சி தூண்டப்பட்டுள்ளது', te: 'రీఫండ్ మళ్లీ ప్రయత్నం ప్రారంభించబడింది' },
    'success.order.placed': { en: 'Order placed successfully', hi: 'ऑर्डर सफलतापूर्वक दिया गया', ta: 'ஆர்டர் வெற்றிகரமாக வைக்கப்பட்டது', te: 'ఆర్డర్ విజయవంతంగా ఉంచబడింది' },
    'admin.orders.status.refundInProgress': { en: 'Refund in progress', hi: 'वापसी प्रगति पर है', ta: 'திரும்பப் பெறுதல் செயல்பாட்டில் உள்ளது', te: 'రీఫండ్ పురోగతిలో ఉంది' }
};

async function processLocales(dir, keysMap, label) {
    console.log(`\nProcessing ${label} locales in ${dir}...`);
    let count = 0;

    for (const lang of locales) {
        const filePath = path.join(dir, `${lang}.json`);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            continue;
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            let modified = false;

            Object.keys(keysMap).forEach(keyPath => {
                const val = keysMap[keyPath][lang] || keysMap[keyPath]['en'];
                if (setNestedKey(data, keyPath, val)) {
                    console.log(`  [${lang}] Added: ${keyPath}`);
                    modified = true;
                    count++;
                }
            });

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error(`Error processing ${lang}:`, e);
        }
    }
    return count;
}

async function main() {
    const feCount = await processLocales(FRONTEND_DIR, frontendKeys, 'Frontend');
    const beCount = await processLocales(BACKEND_DIR, backendKeys, 'Backend');

    console.log(`\nDone! Added ${feCount} frontend keys and ${beCount} backend keys.`);
}

main();
