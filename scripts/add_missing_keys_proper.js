const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../frontend/src/i18n/locales');
const files = ['hi.json', 'ta.json', 'te.json'];

const translations = {
    hi: {
        "admin.backgroundJobs.orphanSweep.button": "अनाथ भुगतान साफ़ करें",
        "admin.backgroundJobs.orphanSweep.description": "अनाथ भुगतानों के लिए मैन्युअल रूप से स्वीप ट्रिगर करें जिन्हें वापस करने की आवश्यकता है।",
        "admin.backgroundJobs.orphanSweep.flagged": "चिह्नित",
        "admin.backgroundJobs.orphanSweep.refunded": "वापस कर दिया",
        "admin.backgroundJobs.orphanSweep.title": "अनाथ भुगतान स्वीप",
        "admin.backgroundJobs.stats.orphanPayments": "अनाथ भुगतान",
        "admin.backgroundJobs.stats.pendingSweep": "लंबित स्वीप",
        "admin.backgroundJobs.toasts.invoiceTriggerFailed": "चालान जनरेशन ट्रिगर करने में विफल",
        "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "चालान जनरेशन सफलतापूर्वक ट्रिगर हुआ",
        "admin.backgroundJobs.toasts.sweepFailed": "स्वीप विफल रहा",
        "admin.backgroundJobs.toasts.sweepSuccess": "स्वीप सफलतापूर्वक पूरा हुआ"
    },
    ta: {
        "admin.backgroundJobs.orphanSweep.button": "அனாதை கொடுப்பனவுகளை அழிக்கவும்",
        "admin.backgroundJobs.orphanSweep.description": "திரும்பப் பெற வேண்டிய அனாதை கொடுப்பனவுகளுக்கான துடைப்பை கைமுறையாகத் தூண்டவும்.",
        "admin.backgroundJobs.orphanSweep.flagged": "கொடியிடப்பட்டது",
        "admin.backgroundJobs.orphanSweep.refunded": "திரும்பப் பெறப்பட்டது",
        "admin.backgroundJobs.orphanSweep.title": "அனாதை கொடுப்பனவுகள் துடைப்பு",
        "admin.backgroundJobs.stats.orphanPayments": "அனாதை கொடுப்பனவுகள்",
        "admin.backgroundJobs.stats.pendingSweep": "நிலுவையில் உள்ள துடைப்பு",
        "admin.backgroundJobs.toasts.invoiceTriggerFailed": "விலைப்பட்டியல் உருவாக்கத்தைத் தூண்டுவதில் தோல்வி",
        "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "விலைப்பட்டியல் உருவாக்கம் வெற்றிகரமாக தூண்டப்பட்டது",
        "admin.backgroundJobs.toasts.sweepFailed": "துடைப்பு விಫಲವாயிற்று",
        "admin.backgroundJobs.toasts.sweepSuccess": "துடைப்பு வெற்றிகரமாக முடிந்தது"
    },
    te: {
        "admin.backgroundJobs.orphanSweep.button": "అనాధ చెల్లింపులను తొలగించండి",
        "admin.backgroundJobs.orphanSweep.description": "తిరిగి చెల్లించాల్సిన అనాథ చెల్లింపుల కోసం మాన్యువల్‌గా స్వీప్‌ను ప్రారంభించండి.",
        "admin.backgroundJobs.orphanSweep.flagged": "ఫ్లాగ్ చేయబడింది",
        "admin.backgroundJobs.orphanSweep.refunded": "వాపసు చేయబడింది",
        "admin.backgroundJobs.orphanSweep.title": "అనాధ చెల్లింపుల స్వీప్",
        "admin.backgroundJobs.stats.orphanPayments": "అనాధ చెల్లింపులు",
        "admin.backgroundJobs.stats.pendingSweep": "పెండింగ్ స్వీప్",
        "admin.backgroundJobs.toasts.invoiceTriggerFailed": "ఇన్‌వాయిస్ జనరేషన్‌ను ట్రిగ్గర్ చేయడంలో విఫలమైంది",
        "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "ఇన్‌వాయిస్ జనరేషన్ విజయవంతంగా ట్రిగ్గర్ చేయబడింది",
        "admin.backgroundJobs.toasts.sweepFailed": "స్వీప్ విఫలమైంది",
        "admin.backgroundJobs.toasts.sweepSuccess": "స్వీప్ విజయవంతంగా పూర్తయింది"
    }
};

function setDeep(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

files.forEach(file => {
    const lang = file.split('.')[0];
    const filePath = path.join(localesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Add keys
        Object.entries(translations[lang]).forEach(([k, v]) => {
            setDeep(data, k, v);
        });

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        console.log(`Updated ${file}`);
    } catch (err) {
        console.error(`Error processing ${file}:`, err);
    }
});
