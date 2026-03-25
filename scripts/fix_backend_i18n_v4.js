#!/usr/bin/env node
/**
 * Fix ALL remaining backend hardcoded strings found in verification (Pass 4).
 * This covers product-variant, delivery-configs, bank-details, user, invoice, etc.
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

const replacements = [
    // product-variant.routes.js
    { file: 'routes/product-variant.routes.js', old: "'Variant not found'", new: "req.t('errors.product.variantNotFound')", key: 'errors.product.variantNotFound', en: 'Variant not found', hi: 'वेरिएंट नहीं मिला', ta: 'மாறுபாடு காணப்படவில்லை', te: 'వేరియంట్ కనుగొనబడలేదు' },
    { file: 'routes/product-variant.routes.js', old: "'Variant does not belong to this product'", new: "req.t('errors.product.variantMismatch')", key: 'errors.product.variantMismatch', en: 'Variant does not belong to this product', hi: 'वेरिएंट इस उत्पाद से संबंधित नहीं है', ta: 'மாறுபாடு இந்த தயாரிப்புக்கு சொந்தமானது அல்ல', te: 'వేరియంట్ ఈ ఉత్పత్తికి చెందినది కాదు' },
    { file: 'routes/product-variant.routes.js', old: "'Selling price must be less than or equal to MRP'", new: "req.t('errors.product.sellingPriceInvalid')", key: 'errors.product.sellingPriceInvalid', en: 'Selling price must be less than or equal to MRP', hi: 'विक्रय मूल्य MRP से कम या उसके बराबर होना चाहिए', ta: 'விற்பனை விலை MRP ஐ விட குறைவாகவோ அல்லது சமமாகவோ இருக்க வேண்டும்', te: 'అమ్మకపు ధర MRP కంటే తక్కువ లేదా సమానంగా ఉండాలి' },
    { file: 'routes/product-variant.routes.js', old: "'Cannot delete the only variant. Products must have at least one variant.'", new: "req.t('errors.product.cannotDeleteLastVariant')", key: 'errors.product.cannotDeleteLastVariant', en: 'Cannot delete the only variant. Products must have at least one variant.', hi: 'एकमात्र वेरिएंट को हटाया नहीं जा सकता। उत्पादों में कम से कम एक वेरिएंट होना चाहिए।', ta: 'ஒரே மாறுபாட்டை நீக்க முடியாது. தயாரிப்புகளில் குறைந்தது ஒரு மாறுபாடு இருக்க வேண்டும்.', te: 'ఏకైక వేరియంట్‌ను తొలగించలేరు. ఉత్పత్తులకు కనీసం ఒక వేరియంట్ ఉండాలి.' },
    { file: 'routes/product-variant.routes.js', old: "'Validation failed'", new: "req.t('errors.validation.failed')", key: 'errors.validation.failed', en: 'Validation failed', hi: 'सत्यापन विफल', ta: 'சரிபார்ப்பு தோல்வியடைந்தது', te: 'ధృవీకరణ విఫలమైంది' },

    // upload.routes.js
    { file: 'routes/upload.routes.js', old: "'No file uploaded'", new: "req.t('errors.upload.noFile')", key: 'errors.upload.noFile', en: 'No file uploaded', hi: 'कोई फ़ाइल अपलोड नहीं की गई', ta: 'எந்த கோப்பும் பதிவேற்றப்படவில்லை', te: 'ఏ ఫైల్ అప్‌లోడ్ చేయబడలేదు' },
    { file: 'routes/upload.routes.js', old: "'URL is required'", new: "req.t('errors.upload.urlRequired')", key: 'errors.upload.urlRequired', en: 'URL is required', hi: 'URL आवश्यक है', ta: 'URL தேவை', te: 'URL అవసరం' },
    { file: 'routes/upload.routes.js', old: "'Invalid URL format'", new: "req.t('errors.upload.invalidUrl')", key: 'errors.upload.invalidUrl', en: 'Invalid URL format', hi: 'अमान्य URL प्रारूप', ta: 'செல்லாத URL வடிவம்', te: 'చెల్లని URL ఆకృతి' },

    // review.routes.js
    { file: 'routes/review.routes.js', old: "'You can only post reviews for your own account'", new: "req.t('errors.review.ownAccountOnly')", key: 'errors.review.ownAccountOnly', en: 'You can only post reviews for your own account', hi: 'आप केवल अपने खाते के लिए समीक्षा पोस्ट कर सकते हैं', ta: 'உங்கள் சொந்த கணக்கிற்கு மட்டுமே நீங்கள் மதிப்புரைகளை வெளியிட முடியும்', te: 'మీరు మీ స్వంత ఖాతా కోసం మాత్రమే సమీక్షలను పోస్ట్ చేయవచ్చు' },

    // razorpay.routes.js
    { file: 'routes/razorpay.routes.js', old: "'Webhook processing failed'", new: "req.t('errors.payment.webhookFailed')", key: 'errors.payment.webhookFailed', en: 'Webhook processing failed', hi: 'वेबहुक प्रसंस्करण विफल', ta: 'வெப்ஹூக் செயலாக்கம் தோல்வியடைந்தது', te: 'వెబ్‌హుక్ ప్రాసెసింగ్ విఫలమైంది' },

    // user.routes.js
    { file: 'routes/user.routes.js', old: "'isBlocked must be a boolean'", new: "req.t('errors.user.isBlockedBoolean')", key: 'errors.user.isBlockedBoolean', en: 'isBlocked must be a boolean', hi: 'isBlocked एक बूलियन होना चाहिए', ta: 'isBlocked ஒரு பூலியனாக இருக்க வேண்டும்', te: 'isBlocked తప్పనిసరిగా బూలియన్ అయి ఉండాలి' },
    // Complex template literal in user.routes.js will be handled by multi_replace logic after script.

    // gallery-video.routes.js
    { file: 'routes/gallery-video.routes.js', old: "'Invalid YouTube URL'", new: "req.t('errors.gallery.invalidYoutubeUrl')", key: 'errors.gallery.invalidYoutubeUrl', en: 'Invalid YouTube URL', hi: 'अमान्य YouTube URL', ta: 'செல்லாத YouTube URL', te: 'చెల్లని YouTube URL' },

    // bank-details.routes.js
    { file: 'routes/bank-details.routes.js', old: "'Failed to fetch bank details'", new: "req.t('errors.bank.fetchFailed')", key: 'errors.bank.fetchFailed', en: 'Failed to fetch bank details', hi: 'बैंक विवरण प्राप्त करने में विफल', ta: 'வங்கி விவரங்களைப் பெறுவதில் தோல்வி', te: 'బ్యాంక్ వివరాలను పొందడంలో విఫలమైంది' },
    { file: 'routes/bank-details.routes.js', old: "'Failed to fetch bank detail'", new: "req.t('errors.bank.fetchOneFailed')", key: 'errors.bank.fetchOneFailed', en: 'Failed to fetch bank detail', hi: 'बैंक विवरण प्राप्त करने में विफल', ta: 'வங்கி விவரத்தைப் பெறுவதில் தோல்வி', te: 'బ్యాంక్ వివరాలను పొందడంలో విఫలమైంది' },
    { file: 'routes/bank-details.routes.js', old: "'Missing required fields'", new: "req.t('errors.validation.missingFields')", key: 'errors.validation.missingFields', en: 'Missing required fields', hi: 'आवश्यक फ़ील्ड गायब हैं', ta: 'தேவையான புலங்கள் விடுபட்டுள்ளன', te: 'అవసరమైన ఫీల్డ్‌లు లేవు' },
    { file: 'routes/bank-details.routes.js', old: "'Failed to create bank detail'", new: "req.t('errors.bank.createFailed')", key: 'errors.bank.createFailed', en: 'Failed to create bank detail', hi: 'बैंक विवरण बनाने में विफल', ta: 'வங்கி விவரத்தை உருவாக்குவதில் தோல்வி', te: 'బ్యాంక్ వివరాలను సృష్టించడంలో విఫలమైంది' },
    { file: 'routes/bank-details.routes.js', old: "'Failed to update bank detail'", new: "req.t('errors.bank.updateFailed')", key: 'errors.bank.updateFailed', en: 'Failed to update bank detail', hi: 'बैंक विवरण अपडेट करने में विफल', ta: 'வங்கி விவரத்தைப் புதுப்பிப்பதில் தோல்வி', te: 'బ్యాంక్ వివరాలను అప్‌డేట్ చేయడంలో విఫలమైంది' },
    { file: 'routes/bank-details.routes.js', old: "'Failed to delete bank detail'", new: "req.t('errors.bank.deleteFailed')", key: 'errors.bank.deleteFailed', en: 'Failed to delete bank detail', hi: 'बैंक विवरण हटाने में विफल', ta: 'வங்கி விவரத்தை நீக்குவதில் தோல்வி', te: 'బ్యాంక్ వివరాలను తొలగించడంలో విఫలమైంది' },

    // delivery-configs.routes.js
    { file: 'routes/delivery-configs.routes.js', old: "'Failed to fetch delivery config'", new: "req.t('errors.delivery.fetchConfigFailed')", key: 'errors.delivery.fetchConfigFailed', en: 'Failed to fetch delivery config', hi: 'डिलीवरी कॉन्फ़िगरेशन प्राप्त करने में विफल', ta: 'டெலிவரி உள்ளமைவைப் பெறுவதில் தோல்வி', te: 'డెలివరీ కాన్ఫిగరేషన్‌ను పొందడంలో విఫలమైంది' },
    { file: 'routes/delivery-configs.routes.js', old: "'Invalid scope. Must be PRODUCT or VARIANT'", new: "req.t('errors.delivery.invalidScope')", key: 'errors.delivery.invalidScope', en: 'Invalid scope. Must be PRODUCT or VARIANT', hi: 'अमान्य स्कोप। PRODUCT या VARIANT होना चाहिए', ta: 'செல்லாத வரம்பு. தயாரிப்பு அல்லது மாறுபாடு இருக்க வேண்டும்', te: 'చెల్లని స్కోప్. తప్పనిసరిగా PRODUCT లేదా VARIANT అయి ఉండాలి' },
    { file: 'routes/delivery-configs.routes.js', old: "'product_id is required for PRODUCT scope'", new: "req.t('errors.delivery.productIdRequired')", key: 'errors.delivery.productIdRequired', en: 'product_id is required for PRODUCT scope', hi: 'PRODUCT स्कोप के लिए product_id आवश्यक है', ta: 'தயாரிப்பு வரம்பிற்கு product_id தேவை', te: 'PRODUCT స్కోప్ కోసం product_id అవసరం' },
    { file: 'routes/delivery-configs.routes.js', old: "'variant_id is required for VARIANT scope'", new: "req.t('errors.delivery.variantIdRequired')", key: 'errors.delivery.variantIdRequired', en: 'variant_id is required for VARIANT scope', hi: 'VARIANT स्कोप के लिए variant_id आवश्यक है', ta: 'மாறுபாடு வரம்பிற்கு variant_id தேவை', te: 'VARIANT స్కోప్ కోసం variant_id అవసరం' },
    { file: 'routes/delivery-configs.routes.js', old: "'Invalid calculation_type'", new: "req.t('errors.delivery.invalidCalculationType')", key: 'errors.delivery.invalidCalculationType', en: 'Invalid calculation_type', hi: 'अमान्य गणना प्रकार', ta: 'செல்லாத கணக்கீடு வகை', te: 'చెల్లని గణన రకం' },
    { file: 'routes/delivery-configs.routes.js', old: "'base_delivery_charge cannot be negative'", new: "req.t('errors.delivery.negativeBaseCharge')", key: 'errors.delivery.negativeBaseCharge', en: 'base_delivery_charge cannot be negative', hi: 'आधार डिलीवरी शुल्क नकारात्मक नहीं हो सकता', ta: 'அடிப்படை டெலிவரி கட்டணம் எதிர்மறையாக இருக்கக்கூடாது', te: 'base_delivery_charge రుణాత్మకంగా ఉండకూడదు' },
    { file: 'routes/delivery-configs.routes.js', old: "'max_items_per_package must be >= 1 for PER_PACKAGE calculation'", new: "req.t('errors.delivery.invalidMaxItems')", key: 'errors.delivery.invalidMaxItems', en: 'max_items_per_package must be >= 1 for PER_PACKAGE calculation', hi: 'PER_PACKAGE गणना के लिए max_items_per_package >= 1 होना चाहिए', ta: 'PER_PACKAGE கணக்கீட்டிற்கு max_items_per_package >= 1 ஆக இருக்க வேண்டும்', te: 'PER_PACKAGE గణన కోసం max_items_per_package తప్పనిసరిగా >= 1 ఉండాలి' },
    { file: 'routes/delivery-configs.routes.js', old: "'delivery_refund_policy must be REFUNDABLE or NON_REFUNDABLE'", new: "req.t('errors.delivery.invalidRefundPolicy')", key: 'errors.delivery.invalidRefundPolicy', en: 'delivery_refund_policy must be REFUNDABLE or NON_REFUNDABLE', hi: 'delivery_refund_policy रिफंडेबल या नॉन-रिफंडेबल होनी चाहिए', ta: 'டெலிவரி திரும்பப்பெறும் கொள்கை திரும்பப்பெறக்கூடியதாக அல்லது திரும்பப்பெற முடியாததாக இருக்க வேண்டும்', te: 'delivery_refund_policy తప్పనిసరిగా REFUNDABLE లేదా NON_REFUNDABLE అయి ఉండాలి' },
    { file: 'routes/delivery-configs.routes.js', old: "'Failed to save delivery config'", new: "req.t('errors.delivery.saveFailed')", key: 'errors.delivery.saveFailed', en: 'Failed to save delivery config', hi: 'डिलीवरी कॉन्फ़िगरेशन सहेजने में विफल', ta: 'டெலிவரி உள்ளமைவைச் சேமிப்பதில் தோல்வி', te: 'డెలివరీ కాన్ఫిగరేషన్‌ను సేవ్ చేయడంలో విఫలమైంది' },
    { file: 'routes/delivery-configs.routes.js', old: "'Delivery config deleted successfully'", new: "req.t('success.delivery.deleted')", key: 'success.delivery.deleted', en: 'Delivery config deleted successfully', hi: 'डिलीवरी कॉन्फ़िगरेशन सफलतापूर्वक हटा दिया गया', ta: 'டெலிவரி உள்ளமைவு வெற்றிகரமாக நீக்கப்பட்டது', te: 'డెలివరీ కాన్ఫిగరేషన్ విజయవంతంగా తొలగించబడింది' },
    { file: 'routes/delivery-configs.routes.js', old: "'Failed to delete delivery config'", new: "req.t('errors.delivery.deleteFailed')", key: 'errors.delivery.deleteFailed', en: 'Failed to delete delivery config', hi: 'डिलीवरी कॉन्फ़िगरेशन हटाने में विफल', ta: 'டெலிவரி உள்ளமைவை நீக்குவதில் தோல்வி', te: 'డెలివరీ కాన్ఫిగరేషన్‌ను తొలగించడంలో విఫలమైంది' },
    { file: 'routes/delivery-configs.routes.js', old: "'Failed to fetch delivery configs'", new: "req.t('errors.delivery.fetchAllFailed')", key: 'errors.delivery.fetchAllFailed', en: 'Failed to fetch delivery configs', hi: 'डिलीवरी कॉन्फ़िगरेशन प्राप्त करने में विफल', ta: 'டெலிவரி உள்ளமைவுகளைப் பெறுவதில் தோல்வி', te: 'డెలివరీ కాన్ఫిగరేషన్‌లను పొందడంలో విఫలమైంది' },

    // about.routes.js
    { file: 'routes/about.routes.js', old: "'Failed to fetch about content'", new: "req.t('errors.about.fetchFailed')", key: 'errors.about.fetchFailed', en: 'Failed to fetch about content', hi: 'हमारे बारे में सामग्री प्राप्त करने में विफल', ta: 'எங்களைப் பற்றிய உள்ளடக்கத்தைப் பெறுவதில் தோல்வி', te: 'మా గురించి కంటెంట్‌ను పొందడంలో విఫలమైంది' },

    // invoice.routes.js - Double check the quoting in file
    { file: 'routes/invoice.routes.js', old: "'Internal server error'", new: "req.t('errors.system.internalError')", key: 'errors.system.internalError', en: 'Internal server error', hi: 'आंतरिक सर्वर त्रुटि', ta: 'உள்ளக சேவையக பிழை', te: 'అంతర్గత సర్వర్ లోపం' },
];

// Load backend locale files
const locales = ['en', 'hi', 'ta', 'te'];
const backendLocaleData = {};
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    backendLocaleData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

// Save backend locale files
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backendLocaleData[locale], null, 2) + '\n', 'utf8');
}

console.log(`Added ${keysAdded} keys to locale files.`);

// Replace in backend files
let replacedCount = 0;

for (const r of replacements) {
    const filePath = path.join(BACKEND_DIR, r.file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Use replaceAll to handle duplicate occurrences
    const newContent = content.replaceAll(r.old, r.new);

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        replacedCount++;
        console.log(`  ✅ ${r.file}: replaced "${r.old.substring(0, 30)}..."`);
    } else {
        console.log(`  ⚠️  ${r.file}: NOT FOUND: "${r.old.substring(0, 30)}..."`);
    }
}

console.log(`\nDone! ${replacedCount} replacements made.`);
