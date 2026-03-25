#!/usr/bin/env node
/**
 * Fix remaining backend hardcoded strings that were missed.
 * Uses replaceAll to handle duplicate occurrences.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '../backend');
const LOCALES_DIR = path.join(BACKEND_DIR, 'locales');

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

// All remaining replacements - using context-aware patterns
const replacements = [
    // comments.routes.js - the res.json() calls still hardcoded
    { file: 'routes/comments.routes.js', old: "message: 'Comment deleted successfully'", new: "message: req.t('success.comments.deleted')" },
    { file: 'routes/comments.routes.js', old: "message: 'Comment flagged successfully'", new: "message: req.t('success.comments.flagged')" },

    // email.routes.js - res.json() message fields still hardcoded
    { file: 'routes/email.routes.js', old: "message: 'Templated email sent successfully'", new: "message: req.t('success.email.templatedSent')" },
    { file: 'routes/email.routes.js', old: "message: 'Test email sent successfully'", new: "message: req.t('success.email.testSent')" },

    // account-deletion.routes.js
    { file: 'routes/account-deletion.routes.js', old: "message: 'Scheduled jobs processing triggered'", new: "message: req.t('success.jobs.scheduledTriggered')", key: 'success.jobs.scheduledTriggered', en: 'Scheduled jobs processing triggered', hi: 'अनुसूचित कार्य संसाधन शुरू किया गया', ta: 'திட்டமிட்ட பணிகள் செயலாக்கம் தூண்டப்பட்டது', te: 'షెడ్యూల్ చేసిన జాబ్‌ల ప్రాసెసింగ్ ట్రిగ్గర్ చేయబడింది' },
    { file: 'routes/account-deletion.routes.js', old: "message: 'Job processing triggered. Check job status for completion.'", new: "message: req.t('success.jobs.processingTriggered')", key: 'success.jobs.processingTriggered', en: 'Job processing triggered. Check job status for completion.', hi: 'कार्य संसाधन शुरू किया गया। पूर्णता के लिए कार्य स्थिति जांचें।', ta: 'பணி செயலாக்கம் தூண்டப்பட்டது. முடிவதற்கு பணி நிலையை சரிபார்க்கவும்.', te: 'జాబ్ ప్రాసెసింగ్ ట్రిగ్గర్ చేయబడింది. పూర్తి కోసం జాబ్ స్థితిని తనిఖీ చేయండి.' },

    // admin-event.routes.js
    { file: 'routes/admin-event.routes.js', old: "message: 'All registrations already cancelled. Job marked as completed.'", new: "message: req.t('success.events.allCancelledCompleted')", key: 'success.events.allCancelledCompleted', en: 'All registrations already cancelled. Job marked as completed.', hi: 'सभी पंजीकरण पहले ही रद्द कर दिए गए हैं। कार्य पूर्ण के रूप में चिह्नित।', ta: 'அனைத்து பதிவுகளும் ஏற்கனவே ரத்து செய்யப்பட்டன. பணி முடிந்ததாக குறிக்கப்பட்டது.', te: 'అన్ని నమోదులు ఇప్పటికే రద్దు చేయబడ్డాయి. జాబ్ పూర్తయినట్లు గుర్తించబడింది.' },

    // jobs.routes.js
    { file: 'routes/jobs.routes.js', old: "message: 'Account deletion job retry triggered successfully.'", new: "message: req.t('success.jobs.deletionRetryTriggered')", key: 'success.jobs.deletionRetryTriggered', en: 'Account deletion job retry triggered successfully.', hi: 'खाता विलोपन कार्य पुनः प्रयास सफलतापूर्वक शुरू किया गया।', ta: 'கணக்கு நீக்குதல் பணி மீண்டும் முயற்சி வெற்றிகரமாக தூண்டப்பட்டது.', te: 'ఖాతా తొలగింపు జాబ్ రీట్రై విజయవంతంగా ట్రిగ్గర్ చేయబడింది.' },
    { file: 'routes/jobs.routes.js', old: "message: 'All registrations already cancelled. Job marked as completed.'", new: "message: req.t('success.events.allCancelledCompleted')" },
    { file: 'routes/jobs.routes.js', old: "message: 'Account deletion job processing triggered.'", new: "message: req.t('success.jobs.deletionProcessingTriggered')", key: 'success.jobs.deletionProcessingTriggered', en: 'Account deletion job processing triggered.', hi: 'खाता विलोपन कार्य संसाधन शुरू किया गया।', ta: 'கணக்கு நீக்குதல் பணி செயலாக்கம் தூண்டப்பட்டது.', te: 'ఖాతా తొలగింపు జాబ్ ప్రాసెసింగ్ ట్రిగ్గర్ చేయబడింది.' },
    { file: 'routes/jobs.routes.js', old: "message: 'Event cancellation job processing triggered.'", new: "message: req.t('success.jobs.eventCancellationTriggered')", key: 'success.jobs.eventCancellationTriggered', en: 'Event cancellation job processing triggered.', hi: 'इवेंट रद्दीकरण कार्य संसाधन शुरू किया गया।', ta: 'நிகழ்வு ரத்து பணி செயலாக்கம் தூண்டப்பட்டது.', te: 'ఈవెంట్ రద్దు జాబ్ ప్రాసెసింగ్ ట్రిగ్గర్ చేయబడింది.' },

    // webhook.routes.js
    { file: 'routes/webhook.routes.js', old: "message: 'Internal processing error'", new: "message: req.t('errors.system.internalProcessing')", key: 'errors.system.internalProcessing', en: 'Internal processing error', hi: 'आंतरिक संसाधन त्रुटि', ta: 'உள்ளக செயலாக்க பிழை', te: 'అంతర్గత ప్రాసెసింగ్ లోపం' },

    // NOTE: idempotency.middleware.js getCacheStats() and requestLock.middleware.js getLockStatus()
    // are standalone exported functions with no req access — skipped.

    // Frontend - remaining hardcoded alt text in FAQ.tsx
];

// Frontend replacements
const frontendReplacements = [
    { file: 'src/pages/FAQ.tsx', old: 'alt="FAQ Hero"', new: 'alt={t("faq.heroAlt")}', key: 'faq.heroAlt', en: 'FAQ Hero', hi: 'FAQ हीरो', ta: 'FAQ ஹீரோ', te: 'FAQ హీరో' },
    { file: 'src/pages/FAQ.tsx', old: 'alt="Contact"', new: 'alt={t("faq.contactAlt")}', key: 'faq.contactAlt', en: 'Contact', hi: 'संपर्क', ta: 'தொடர்பு', te: 'సంప్రదించండి' },
];

// Load backend locale files
const locales = ['en', 'hi', 'ta', 'te'];
const backendLocaleData = {};
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    backendLocaleData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Load frontend locale files
const FRONTEND_LOCALES_DIR = path.join(__dirname, '../frontend/src/i18n/locales');
const frontendLocaleData = {};
for (const locale of locales) {
    const filePath = path.join(FRONTEND_LOCALES_DIR, `${locale}.json`);
    frontendLocaleData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Add backend keys
let keysAdded = 0;
for (const r of replacements) {
    if (r.key) {
        for (const locale of locales) {
            if (r[locale] && setNestedKey(backendLocaleData[locale], r.key, r[locale])) {
                keysAdded++;
            }
        }
    }
}

// Add frontend keys
for (const r of frontendReplacements) {
    if (r.key) {
        for (const locale of locales) {
            if (r[locale] && setNestedKey(frontendLocaleData[locale], r.key, r[locale])) {
                keysAdded++;
            }
        }
    }
}

// Save backend locale files
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backendLocaleData[locale], null, 2) + '\n', 'utf8');
}

// Save frontend locale files
for (const locale of locales) {
    const filePath = path.join(FRONTEND_LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(frontendLocaleData[locale], null, 2) + '\n', 'utf8');
}

console.log(`Added ${keysAdded} keys to locale files.`);

// Replace in backend files
const fileCache = {};
let replacedCount = 0;

for (const r of replacements) {
    const filePath = path.join(BACKEND_DIR, r.file);
    if (!fileCache[filePath]) {
        fileCache[filePath] = fs.readFileSync(filePath, 'utf8');
    }

    const oldContent = fileCache[filePath];
    // Use replaceAll to handle all occurrences
    const newContent = oldContent.replaceAll(r.old, r.new);

    if (newContent !== oldContent) {
        fileCache[filePath] = newContent;
        replacedCount++;
        console.log(`  ✅ ${r.file}: replaced "${r.old.substring(0, 50)}..."`);
    } else {
        console.log(`  ⚠️  ${r.file}: NOT FOUND: "${r.old.substring(0, 50)}..."`);
    }
}

// Replace in frontend files
for (const r of frontendReplacements) {
    const filePath = path.join(__dirname, '..', 'frontend', r.file);
    if (!fileCache[filePath]) {
        fileCache[filePath] = fs.readFileSync(filePath, 'utf8');
    }

    const oldContent = fileCache[filePath];
    const newContent = oldContent.replaceAll(r.old, r.new);

    if (newContent !== oldContent) {
        fileCache[filePath] = newContent;
        replacedCount++;
        console.log(`  ✅ frontend/${r.file}: replaced "${r.old}"`);
    } else {
        console.log(`  ⚠️  frontend/${r.file}: NOT FOUND: "${r.old}"`);
    }
}

// Write all updated files
for (const [filePath, content] of Object.entries(fileCache)) {
    fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`\nDone! ${replacedCount} replacements made.`);
