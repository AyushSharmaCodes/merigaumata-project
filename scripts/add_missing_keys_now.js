const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../frontend/src/i18n/locales');
const files = ['en.json', 'hi.json', 'ta.json', 'te.json'];

const keysToAdd = {
    "admin.backgroundJobs.orphanSweep.button": "Sweep Orphanded Payments",
    "admin.backgroundJobs.orphanSweep.description": "Manually trigger a sweep for orphaned payments which need to be refunded.",
    "admin.backgroundJobs.orphanSweep.flagged": "Flagged",
    "admin.backgroundJobs.orphanSweep.refunded": "Refunded",
    "admin.backgroundJobs.orphanSweep.title": "Orphaned Payments Sweep",
    "admin.backgroundJobs.stats.orphanPayments": "Orphan Payments",
    "admin.backgroundJobs.stats.pendingSweep": "Pending Sweep",
    "admin.backgroundJobs.toasts.invoiceTriggerFailed": "Failed to trigger invoice generation",
    "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "Invoice generation triggered successfully",
    "admin.backgroundJobs.toasts.sweepFailed": "Sweep failed",
    "admin.backgroundJobs.toasts.sweepSuccess": "Sweep completed successfully",

    // Profile Success
    "success.profile.verificationCodeSent": "Verification Code Sent",
    "success.profile.codeSentDesc": "A verification code has been sent to your registered email address.",
    "success.profile.verified": "Identity Verified",
    "success.profile.verifiedDesc": "Your identity has been successfully verified.",
    "success.profile.accountDeleted": "Account Deleted",
    "success.profile.accountDeletedDesc": "Your account has been deleted permanently.",
    "success.profile.deletionScheduled": "Deletion Scheduled",
    "success.profile.deletionScheduledDesc": "Your account deletion has been scheduled.",
    "success.profile.deletionCancelled": "Deletion Cancelled",
    "success.profile.deletionCancelledDesc": "Your account deletion has been cancelled.",

    // Profile Errors
    "errors.profile.sendCodeFailed": "Failed to send verification code",
    "errors.profile.verifyCodeFailed": "Failed to verify code",
    "errors.profile.deletionFailed": "Failed to delete account",
    "errors.profile.cancelDeletionFailed": "Failed to cancel deletion"
};

// Hindi Translations (approximate, context based or fallback to English if not known, but the user requested an audit and adding all missing keys to all 4 locales. I will provide basic Hindi/Ta/Te translations where possible or falback to EN so they are not missing)
const translations = {
    en: { ...keysToAdd },
    hi: {
        "admin.backgroundJobs.orphanSweep.button": "Sweep Orphanded Payments",
        "admin.backgroundJobs.orphanSweep.description": "Manually trigger a sweep for orphaned payments which need to be refunded.",
        "admin.backgroundJobs.orphanSweep.flagged": "Flagged",
        "admin.backgroundJobs.orphanSweep.refunded": "Refunded",
        "admin.backgroundJobs.orphanSweep.title": "Orphaned Payments Sweep",
        "admin.backgroundJobs.stats.orphanPayments": "Orphan Payments",
        "admin.backgroundJobs.stats.pendingSweep": "Pending Sweep",
        "admin.backgroundJobs.toasts.invoiceTriggerFailed": "Failed to trigger invoice generation",
        "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "Invoice generation triggered successfully",
        "admin.backgroundJobs.toasts.sweepFailed": "Sweep failed",
        "admin.backgroundJobs.toasts.sweepSuccess": "Sweep completed successfully",
        "success.profile.verificationCodeSent": "सत्यापन कोड भेजा गया",
        "success.profile.codeSentDesc": "आपके पंजीकृत ईमेल पते पर एक सत्यापन कोड भेजा गया है।",
        "success.profile.verified": "पहचान सत्यापित",
        "success.profile.verifiedDesc": "आपकी पहचान सफलतापूर्वक सत्यापित कर दी गई है।",
        "success.profile.accountDeleted": "खाता हटा दिया गया",
        "success.profile.accountDeletedDesc": "आपका खाता स्थायी रूप से हटा दिया गया है।",
        "success.profile.deletionScheduled": "हटाना निर्धारित किया गया",
        "success.profile.deletionScheduledDesc": "आपका खाता हटाना निर्धारित किया गया है।",
        "success.profile.deletionCancelled": "हटाना रद्द कर दिया गया",
        "success.profile.deletionCancelledDesc": "आपका खाता हटाना रद्द कर दिया गया है।",
        "errors.profile.sendCodeFailed": "सत्यापन कोड भेजने में विफल",
        "errors.profile.verifyCodeFailed": "कोड सत्यापित करने में विफल",
        "errors.profile.deletionFailed": "खाता हटाने में विफल",
        "errors.profile.cancelDeletionFailed": "हटाने को रद्द करने में विफल"
    },
    ta: {
        // Tamil fallbacks for missing admin keys
        "admin.backgroundJobs.orphanSweep.button": "Sweep Orphanded Payments",
        "admin.backgroundJobs.orphanSweep.description": "Manually trigger a sweep for orphaned payments which need to be refunded.",
        "admin.backgroundJobs.orphanSweep.flagged": "Flagged",
        "admin.backgroundJobs.orphanSweep.refunded": "Refunded",
        "admin.backgroundJobs.orphanSweep.title": "Orphaned Payments Sweep",
        "admin.backgroundJobs.stats.orphanPayments": "Orphan Payments",
        "admin.backgroundJobs.stats.pendingSweep": "Pending Sweep",
        "admin.backgroundJobs.toasts.invoiceTriggerFailed": "Failed to trigger invoice generation",
        "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "Invoice generation triggered successfully",
        "admin.backgroundJobs.toasts.sweepFailed": "Sweep failed",
        "admin.backgroundJobs.toasts.sweepSuccess": "Sweep completed successfully",
        "success.profile.verificationCodeSent": "சரிபார்ப்பு குறியீடு அனுப்பப்பட்டது",
        "success.profile.codeSentDesc": "உங்கள் பதிவுசெய்யப்பட்ட மின்னஞ்சல் முகவரிக்கு சரிபார்ப்பு குறியீடு அனுப்பப்பட்டுள்ளது.",
        "success.profile.verified": "அடையாளம் சரிபார்க்கப்பட்டது",
        "success.profile.verifiedDesc": "உங்கள் அடையாளம் வெற்றிகரமாக சரிபார்க்கப்பட்டது.",
        "success.profile.accountDeleted": "கணக்கு நீக்கப்பட்டது",
        "success.profile.accountDeletedDesc": "உங்கள் கணக்கு நிரந்தரமாக நீக்கப்பட்டது.",
        "success.profile.deletionScheduled": "நீக்குதல் திட்டமிடப்பட்டுள்ளது",
        "success.profile.deletionScheduledDesc": "உங்கள் கணக்கு நீக்குதல் திட்டமிடப்பட்டுள்ளது.",
        "success.profile.deletionCancelled": "நீக்குதல் ரத்து செய்யப்பட்டது",
        "success.profile.deletionCancelledDesc": "உங்கள் கணக்கு நீக்குதல் ரத்து செய்யப்பட்டுள்ளது.",
        "errors.profile.sendCodeFailed": "சரிபார்ப்புக் குறியீட்டை அனுப்புவதில் தோல்வி",
        "errors.profile.verifyCodeFailed": "குறியீட்டை சரிபார்ப்பதில் தோல்வி",
        "errors.profile.deletionFailed": "கணக்கை நீக்குவதில் தோல்வி",
        "errors.profile.cancelDeletionFailed": "நீக்கலை ரத்து செய்வதில் தோல்வி"
    },
    te: {
        "admin.backgroundJobs.orphanSweep.button": "Sweep Orphanded Payments",
        "admin.backgroundJobs.orphanSweep.description": "Manually trigger a sweep for orphaned payments which need to be refunded.",
        "admin.backgroundJobs.orphanSweep.flagged": "Flagged",
        "admin.backgroundJobs.orphanSweep.refunded": "Refunded",
        "admin.backgroundJobs.orphanSweep.title": "Orphaned Payments Sweep",
        "admin.backgroundJobs.stats.orphanPayments": "Orphan Payments",
        "admin.backgroundJobs.stats.pendingSweep": "Pending Sweep",
        "admin.backgroundJobs.toasts.invoiceTriggerFailed": "Failed to trigger invoice generation",
        "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "Invoice generation triggered successfully",
        "admin.backgroundJobs.toasts.sweepFailed": "Sweep failed",
        "admin.backgroundJobs.toasts.sweepSuccess": "Sweep completed successfully",
        "success.profile.verificationCodeSent": "ధృవీకరణ కోడ్ పంపబడింది",
        "success.profile.codeSentDesc": "మీ రిజిస్టర్డ్ ఇమెయిల్ చిరునామాకు ధృవీకరణ కోడ్ పంపబడింది.",
        "success.profile.verified": "గుర్తింపు ధృవీకరించబడింది",
        "success.profile.verifiedDesc": "మీ గుర్తింపు విజయవంతంగా ధృవీకరించబడింది.",
        "success.profile.accountDeleted": "ఖాతా తొలగించబడింది",
        "success.profile.accountDeletedDesc": "మీ ఖాతా శాశ్వతంగా తొలగించబడింది.",
        "success.profile.deletionScheduled": "తొలగింపు షెడ్యూల్ చేయబడింది",
        "success.profile.deletionScheduledDesc": "మీ ఖాతా తొలగింపు షెడ్యూల్ చేయబడింది.",
        "success.profile.deletionCancelled": "తొలగింపు రద్దు చేయబడింది",
        "success.profile.deletionCancelledDesc": "మీ ఖాతా తొలగింపు రద్దు చేయబడింది.",
        "errors.profile.sendCodeFailed": "తనిఖీ కోడ్ పంపడంలో విఫలమైంది",
        "errors.profile.verifyCodeFailed": "కోడ్ ధృవీకరించడంలో విఫలమైంది",
        "errors.profile.deletionFailed": "ఖాతా తొలగించడంలో విఫలమైంది",
        "errors.profile.cancelDeletionFailed": "తొలగింపును రద్దు చేయడంలో విఫలమైంది"
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
