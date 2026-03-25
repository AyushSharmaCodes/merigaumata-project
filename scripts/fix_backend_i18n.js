#!/usr/bin/env node
/**
 * Phase 4: Replace hardcoded strings in backend route/service files
 * with req.t() / i18next.t() calls
 * Also adds corresponding keys to all 4 backend locale files
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

// Replacement definitions: each maps a file, the old string, and the new i18n key
// We'll handle these by reading + replacing in each file
const replacements = [
    // address.routes.js
    { file: 'routes/address.routes.js', old: "'Address created successfully'", new: "req.t('success.address.created')", key: 'success.address.created', en: 'Address created successfully', hi: 'पता सफलतापूर्वक बनाया गया', ta: 'முகவரி வெற்றிகரமாக உருவாக்கப்பட்டது', te: 'చిరునామా విజయవంతంగా సృష్టించబడింది' },
    { file: 'routes/address.routes.js', old: "'Address updated successfully'", new: "req.t('success.address.updated')", key: 'success.address.updated', en: 'Address updated successfully', hi: 'पता सफलतापूर्वक अपडेट किया गया', ta: 'முகவரி வெற்றிகரமாக புதுப்பிக்கப்பட்டது', te: 'చిరునామా విజయవంతంగా నవీకరించబడింది' },
    { file: 'routes/address.routes.js', old: "'Address deleted successfully'", new: "req.t('success.address.deleted')", key: 'success.address.deleted', en: 'Address deleted successfully', hi: 'पता सफलतापूर्वक हटाया गया', ta: 'முகவரி வெற்றிகரமாக நீக்கப்பட்டது', te: 'చిరునామా విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/address.routes.js', old: "'Primary address updated successfully'", new: "req.t('success.address.primaryUpdated')", key: 'success.address.primaryUpdated', en: 'Primary address updated successfully', hi: 'प्राथमिक पता सफलतापूर्वक अपडेट किया गया', ta: 'முதன்மை முகவரி வெற்றிகரமாக புதுப்பிக்கப்பட்டது', te: 'ప్రాథమిక చిరునామా విజయవంతంగా నవీకరించబడింది' },

    // bank-details.routes.js
    { file: 'routes/bank-details.routes.js', old: "'Bank detail deleted successfully'", new: "req.t('success.bankDetails.deleted')", key: 'success.bankDetails.deleted', en: 'Bank detail deleted successfully', hi: 'बैंक विवरण सफलतापूर्वक हटाया गया', ta: 'வங்கி விவரம் வெற்றிகரமாக நீக்கப்பட்டது', te: 'బ్యాంక్ వివరాలు విజయవంతంగా తొలగించబడ్డాయి' },

    // comments.routes.js
    { file: 'routes/comments.routes.js', old: "'Comment deleted successfully'", new: "req.t('success.comments.deleted')", key: 'success.comments.deleted', en: 'Comment deleted successfully', hi: 'टिप्पणी सफलतापूर्वक हटाई गई', ta: 'கருத்து வெற்றிகரமாக நீக்கப்பட்டது', te: 'వ్యాఖ్య విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/comments.routes.js', old: "'Comment flagged successfully'", new: "req.t('success.comments.flagged')", key: 'success.comments.flagged', en: 'Comment flagged successfully', hi: 'टिप्पणी सफलतापूर्वक चिह्नित की गई', ta: 'கருத்து வெற்றிகரமாக கொடியிடப்பட்டது', te: 'వ్యాఖ్య విజయవంతంగా ఫ్లాగ్ చేయబడింది' },
    { file: 'routes/comments.routes.js', old: "'Comment approved'", new: "req.t('success.comments.approved')", key: 'success.comments.approved', en: 'Comment approved', hi: 'टिप्पणी स्वीकृत', ta: 'கருத்து அங்கீகரிக்கப்பட்டது', te: 'వ్యాఖ్య ఆమోదించబడింది' },
    { file: 'routes/comments.routes.js', old: "'Comment hidden'", new: "req.t('success.comments.hidden')", key: 'success.comments.hidden', en: 'Comment hidden', hi: 'टिप्पणी छिपाई गई', ta: 'கருத்து மறைக்கப்பட்டது', te: 'వ్యాఖ్య దాచబడింది' },
    { file: 'routes/comments.routes.js', old: "'Comment restored'", new: "req.t('success.comments.restored')", key: 'success.comments.restored', en: 'Comment restored', hi: 'टिप्पणी पुनर्स्थापित की गई', ta: 'கருத்து மீட்டெடுக்கப்பட்டது', te: 'వ్యాఖ్య పునరుద్ధరించబడింది' },
    { file: 'routes/comments.routes.js', old: "'Comment permanently deleted'", new: "req.t('success.comments.permanentlyDeleted')", key: 'success.comments.permanentlyDeleted', en: 'Comment permanently deleted', hi: 'टिप्पणी स्थायी रूप से हटाई गई', ta: 'கருத்து நிரந்தரமாக நீக்கப்பட்டது', te: 'వ్యాఖ్య శాశ్వతంగా తొలగించబడింది' },

    // contact-info.routes.js
    { file: 'routes/contact-info.routes.js', old: "'Phone deleted successfully'", new: "req.t('success.contactInfo.phoneDeleted')", key: 'success.contactInfo.phoneDeleted', en: 'Phone deleted successfully', hi: 'फ़ोन सफलतापूर्वक हटाया गया', ta: 'தொலைபேசி வெற்றிகரமாக நீக்கப்பட்டது', te: 'ఫోన్ విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/contact-info.routes.js', old: "'Email deleted successfully'", new: "req.t('success.contactInfo.emailDeleted')", key: 'success.contactInfo.emailDeleted', en: 'Email deleted successfully', hi: 'ईमेल सफलतापूर्वक हटाया गया', ta: 'மின்னஞ்சல் வெற்றிகரமாக நீக்கப்பட்டது', te: 'ఇమెయిల్ విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/contact-info.routes.js', old: "'Office hours deleted successfully'", new: "req.t('success.contactInfo.officeHoursDeleted')", key: 'success.contactInfo.officeHoursDeleted', en: 'Office hours deleted successfully', hi: 'कार्यालय समय सफलतापूर्वक हटाया गया', ta: 'அலுவலக நேரம் வெற்றிகரமாக நீக்கப்பட்டது', te: 'కార్యాలయ సమయాలు విజయవంతంగా తొలగించబడ్డాయి' },

    // NOTE: contact.routes.js rate limiter message skipped — it's in a static
    // config object where req.t() is not available at definition time.

    // coupon.routes.js
    { file: 'routes/coupon.routes.js', old: "'Coupon deactivated successfully'", new: "req.t('success.coupon.deactivated')", key: 'success.coupon.deactivated', en: 'Coupon deactivated successfully', hi: 'कूपन सफलतापूर्वक निष्क्रिय किया गया', ta: 'கூப்பன் வெற்றிகரமாக செயலிழக்கப்பட்டது', te: 'కూపన్ విజయవంతంగా నిష్క్రియం చేయబడింది' },

    // donation.routes.js
    { file: 'routes/donation.routes.js', old: "'Donation verified successfully'", new: "req.t('success.donation.verified')", key: 'success.donation.verified', en: 'Donation verified successfully', hi: 'दान सफलतापूर्वक सत्यापित', ta: 'நன்கொடை வெற்றிகரமாக சரிபார்க்கப்பட்டது', te: 'విరాళం విజయవంతంగా ధృవీకరించబడింది' },
    { file: 'routes/donation.routes.js', old: "'Subscription cancelled successfully'", new: "req.t('success.donation.subscriptionCancelled')", key: 'success.donation.subscriptionCancelled', en: 'Subscription cancelled successfully', hi: 'सदस्यता सफलतापूर्वक रद्द की गई', ta: 'சந்தா வெற்றிகரமாக ரத்து செய்யப்பட்டது', te: 'చందా విజయవంతంగా రద్దు చేయబడింది' },
    { file: 'routes/donation.routes.js', old: "'Subscription paused successfully'", new: "req.t('success.donation.subscriptionPaused')", key: 'success.donation.subscriptionPaused', en: 'Subscription paused successfully', hi: 'सदस्यता सफलतापूर्वक रोकी गई', ta: 'சந்தா வெற்றிகரமாக இடைநிறுத்தப்பட்டது', te: 'చందా విజయవంతంగా పాజ్ చేయబడింది' },
    { file: 'routes/donation.routes.js', old: "'Subscription resumed successfully'", new: "req.t('success.donation.subscriptionResumed')", key: 'success.donation.subscriptionResumed', en: 'Subscription resumed successfully', hi: 'सदस्यता सफलतापूर्वक पुनः शुरू की गई', ta: 'சந்தா வெற்றிகரமாக மீண்டும் தொடங்கப்பட்டது', te: 'చందా విజయవంతంగా పునరుద్ధరించబడింది' },

    // email.routes.js
    { file: 'routes/email.routes.js', old: "'Email sent successfully'", new: "req.t('success.email.sent')", key: 'success.email.sent', en: 'Email sent successfully', hi: 'ईमेल सफलतापूर्वक भेजा गया', ta: 'மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது', te: 'ఇమెయిల్ విజయవంతంగా పంపబడింది' },
    { file: 'routes/email.routes.js', old: "'Templated email sent successfully'", new: "req.t('success.email.templatedSent')", key: 'success.email.templatedSent', en: 'Templated email sent successfully', hi: 'टेम्पलेट ईमेल सफलतापूर्वक भेजा गया', ta: 'வார்ப்புரு மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது', te: 'టెంప్లేట్ ఇమెయిల్ విజయవంతంగా పంపబడింది' },
    { file: 'routes/email.routes.js', old: "'Test email sent successfully'", new: "req.t('success.email.testSent')", key: 'success.email.testSent', en: 'Test email sent successfully', hi: 'टेस्ट ईमेल सफलतापूर्वक भेजा गया', ta: 'சோதனை மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது', te: 'టెస్ట్ ఇమెయిల్ విజయవంతంగా పంపబడింది' },

    // faq.routes.js
    { file: 'routes/faq.routes.js', old: "'FAQ deleted successfully'", new: "req.t('success.faq.deleted')", key: 'success.faq.deleted', en: 'FAQ deleted successfully', hi: 'FAQ सफलतापूर्वक हटाया गया', ta: 'FAQ வெற்றிகரமாக நீக்கப்பட்டது', te: 'FAQ విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/faq.routes.js', old: "'FAQs reordered successfully'", new: "req.t('success.faq.reordered')", key: 'success.faq.reordered', en: 'FAQs reordered successfully', hi: 'FAQ सफलतापूर्वक पुन: क्रमबद्ध किए गए', ta: 'FAQ வெற்றிகரமாக மறுவரிசைப்படுத்தப்பட்டது', te: 'FAQలు విజయవంతంగా పునర్వ్యవస్థీకరించబడ్డాయి' },

    // invoice.routes.js
    { file: 'routes/invoice.routes.js', old: "'Invoice regenerated successfully'", new: "req.t('success.invoice.regenerated')", key: 'success.invoice.regenerated', en: 'Invoice regenerated successfully', hi: 'चालान सफलतापूर्वक पुन: उत्पन्न किया गया', ta: 'விலைப்பட்டியல் வெற்றிகரமாக மீண்டும் உருவாக்கப்பட்டது', te: 'ఇన్వాయిస్ విజయవంతంగా పునర్ నిర్మించబడింది' },

    // razorpay.routes.js
    { file: 'routes/razorpay.routes.js', old: "'Invalid signature'", new: "req.t('errors.payment.invalidSignature')", key: 'errors.payment.invalidSignature', en: 'Invalid signature', hi: 'अमान्य हस्ताक्षर', ta: 'தவறான கையொப்பம்', te: 'చెల్లని సంతకం' },

    // return.routes.js
    { file: 'routes/return.routes.js', old: "'Return request cancelled successfully'", new: "req.t('success.return.cancelled')", key: 'success.return.cancelled', en: 'Return request cancelled successfully', hi: 'वापसी अनुरोध सफलतापूर्वक रद्द किया गया', ta: 'திரும்ப கோரிக்கை வெற்றிகரமாக ரத்து செய்யப்பட்டது', te: 'రిటర్న్ అభ్యర్థన విజయవంతంగా రద్దు చేయబడింది' },
    { file: 'routes/return.routes.js', old: "'Return request submitted successfully'", new: "req.t('success.return.submitted')", key: 'success.return.submitted', en: 'Return request submitted successfully', hi: 'वापसी अनुरोध सफलतापूर्वक प्रस्तुत किया गया', ta: 'திரும்ப கோரிக்கை வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது', te: 'రిటర్న్ అభ్యర్థన విజయవంతంగా సమర్పించబడింది' },
    { file: 'routes/return.routes.js', old: "'Return approved'", new: "req.t('success.return.approved')", key: 'success.return.approved', en: 'Return approved', hi: 'वापसी स्वीकृत', ta: 'திரும்ப ஒப்புதல்', te: 'రిటర్న్ ఆమోదించబడింది' },
    { file: 'routes/return.routes.js', old: "'Return rejected'", new: "req.t('success.return.rejected')", key: 'success.return.rejected', en: 'Return rejected', hi: 'वापसी अस्वीकृत', ta: 'திரும்ப நிராகரிக்கப்பட்டது', te: 'రిటర్న్ తిరస్కరించబడింది' },

    // review.routes.js
    { file: 'routes/review.routes.js', old: "'Review submitted successfully'", new: "req.t('success.review.submitted')", key: 'success.review.submitted', en: 'Review submitted successfully', hi: 'समीक्षा सफलतापूर्वक प्रस्तुत की गई', ta: 'மதிப்பாய்வு வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது', te: 'సమీక్ష విజయవంతంగా సమర్పించబడింది' },
    { file: 'routes/review.routes.js', old: "'Review deleted successfully'", new: "req.t('success.review.deleted')", key: 'success.review.deleted', en: 'Review deleted successfully', hi: 'समीक्षा सफलतापूर्वक हटाई गई', ta: 'மதிப்பாய்வு வெற்றிகரமாக நீக்கப்பட்டது', te: 'సమీక్ష విజయవంతంగా తొలగించబడింది' },

    // social-media.routes.js
    { file: 'routes/social-media.routes.js', old: "'Social media link deleted successfully'", new: "req.t('success.socialMedia.deleted')", key: 'success.socialMedia.deleted', en: 'Social media link deleted successfully', hi: 'सोशल मीडिया लिंक सफलतापूर्वक हटाया गया', ta: 'சமூக ஊடக இணைப்பு வெற்றிகரமாக நீக்கப்பட்டது', te: 'సోషల్ మీడియా లింక్ విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/social-media.routes.js', old: "'Social media links reordered successfully'", new: "req.t('success.socialMedia.reordered')", key: 'success.socialMedia.reordered', en: 'Social media links reordered successfully', hi: 'सोशल मीडिया लिंक सफलतापूर्वक पुन: क्रमबद्ध किए गए', ta: 'சமூக ஊடக இணைப்புகள் வெற்றிகரமாக மறுவரிசைப்படுத்தப்பட்டன', te: 'సోషల్ మీడియా లింక్‌లు విజయవంతంగా పునర్వ్యవస్థీకరించబడ్డాయి' },

    // upload.routes.js
    { file: 'routes/upload.routes.js', old: "'File uploaded successfully'", new: "req.t('success.upload.fileUploaded')", key: 'success.upload.fileUploaded', en: 'File uploaded successfully', hi: 'फ़ाइल सफलतापूर्वक अपलोड की गई', ta: 'கோப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது', te: 'ఫైల్ విజయవంతంగా అప్‌లోడ్ చేయబడింది' },

    // NOTE: otp.service.js and event-cancellation.service.js are skipped
    // because they don't have req access. Their messages are returned as
    // plain objects and should be translated at the route handler level.
];

// Load locale files
const locales = ['en', 'hi', 'ta', 'te'];
const localeData = {};
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    localeData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// 1. Add keys to locale files
let keysAdded = 0;
for (const r of replacements) {
    for (const locale of locales) {
        const value = r[locale];
        if (value && setNestedKey(localeData[locale], r.key, value)) {
            keysAdded++;
        }
    }
}

// Save locale files
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(localeData[locale], null, 2) + '\n', 'utf8');
}
console.log(`Added ${keysAdded} keys to backend locale files.`);

// 2. Replace hardcoded strings in source files
const fileCache = {};
let replacedCount = 0;

for (const r of replacements) {
    const filePath = path.join(BACKEND_DIR, r.file);
    if (!fileCache[filePath]) {
        fileCache[filePath] = fs.readFileSync(filePath, 'utf8');
    }

    const oldContent = fileCache[filePath];
    const newContent = oldContent.replace(r.old, r.new);

    if (newContent !== oldContent) {
        fileCache[filePath] = newContent;
        replacedCount++;
        console.log(`  ✅ ${r.file}: replaced ${r.old.substring(0, 40)}...`);
    } else {
        console.log(`  ⚠️  ${r.file}: NOT FOUND: ${r.old.substring(0, 40)}...`);
    }
}

// Write updated files
for (const [filePath, content] of Object.entries(fileCache)) {
    fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`\nDone! ${replacedCount} replacements made in backend files.`);
