const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');
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
    // Only set if it doesn't exist or is empty
    if (current[parts[parts.length - 1]] === undefined || current[parts[parts.length - 1]] === "") {
        current[parts[parts.length - 1]] = value;
        return true;
    }
    return false;
}

const newKeys = {
    // Order Statuses
    'orderStatus.CANCELLED': { en: 'Cancelled', hi: 'रद्द किया गया', ta: ' ரத்து செய்யப்பட்டது', te: 'రద్దు చేయబడింది' },
    'orderStatus.DELIVERED': { en: 'Delivered', hi: 'वितरित', ta: 'வழங்கப்பட்டது', te: 'డెలివరీ చేయబడింది' },
    'orderStatus.OUT_FOR_DELIVERY': { en: 'Out for Delivery', hi: 'डिलीवरी के लिए बाहर', ta: 'விநியோகத்திற்கு வெளியே', te: 'డెలివరీ కోసం బయలుదేరింది' },
    'orderStatus.PACKED': { en: 'Packed', hi: 'पैक किया गया', ta: 'பேக் செய்யப்பட்டது', te: 'ప్యాక్ చేయబడింది' },
    'orderStatus.PENDING': { en: 'Pending', hi: 'लंबित', ta: 'நிலுவையில் உள்ளது', te: 'పెండింగ్‌లో ఉంది' },
    'orderStatus.PROCESSING': { en: 'Processing', hi: 'प्रक्रिया जारी है', ta: 'செயலாக்கத்தில்', te: 'ప్రాసెసింగ్‌లో ఉంది' },
    'orderStatus.REFUND_INITIATED': { en: 'Refund Initiated', hi: 'वापसी शुरू की गई', ta: 'திரும்பப் பெறுதல் தொடங்கப்பட்டது', te: 'రీఫండ్ ప్రారంభించబడింది' },
    'orderStatus.REJECTED': { en: 'Rejected', hi: 'अस्वीकृत', ta: 'நிராகரிக்கப்பட்டது', te: 'తిరస్కరించబడింది' },
    'orderStatus.RETURNED': { en: 'Returned', hi: 'वापस किया गया', ta: 'திரும்பப் பெறப்பட்டது', te: 'తిరిగి ఇవ్వబడింది' },
    'orderStatus.SHIPPED': { en: 'Shipped', hi: 'भेजा गया', ta: ' அனுப்பப்பட்டது', te: 'రవాణా చేయబడింది' },

    // Order Detail Payment Status
    'orderDetail.paymentStatus.refund_initiated': { en: 'Refund Initiated', hi: 'वापसी शुरू की गई', ta: 'திரும்பப் பெறுதல் தொடங்கப்பட்டது', te: 'రీఫండ్ ప్రారంభించబడింది' },

    // Common Order
    'common.order.statusUpdated': { en: 'Order status updated', hi: 'ऑर्डर स्थिति अपडेट की गई', ta: 'ஆர்டர் நிலை புதுப்பிக்கப்பட்டது', te: 'ఆర్డర్ స్థితి నవీకరించబడింది' },

    // Success Messages
    'success.order.placed': { en: 'Order placed successfully', hi: 'ऑर्डर सफलतापूर्वक दिया गया', ta: 'ஆர்டர் வெற்றிகரமாக வைக்கப்பட்டது', te: 'ఆర్డర్ విజయవంతంగా ఉంచబడింది' },
    'success.jobs.refundProcessingTriggered': { en: 'Refund processing has been triggered', hi: 'वापसी प्रक्रिया शुरू कर दी गई है', ta: 'திரும்பப் பெறுதல் செயல்முறை தூண்டப்பட்டுள்ளது', te: 'రీఫండ్ ప్రాసెసింగ్ ప్రారంభించబడింది' },
    'success.jobs.refundRetryTriggered': { en: 'Refund retry has been triggered', hi: 'वापसी पुनः प्रयास शुरू कर दिया गया है', ta: 'திரும்பப் பெறுதல் மறுமுயற்சி தூண்டப்பட்டுள்ளது', te: 'రీఫండ్ మళ్లీ ప్రయత్నం ప్రారంభించబడింది' },

    // Admin Events
    'admin.events.dialogs.pickTime': { en: 'Pick a time', hi: 'एक समय चुनें', ta: 'ஒரு நேரத்தைத் தேர்ந்தெடுக்கவும்', te: 'ఒక సమయాన్ని ఎంచుకోండి' },

    // Errors
    'errors.address.invalidPhone': { en: 'Invalid phone number', hi: 'अमान्य फ़ोन नंबर', ta: 'செல்லுபடியாகாத தொலைபேசி எண்', te: 'చెల్లని ఫోన్ నంబర్' },
    'errors.auth.invalidPhone': { en: 'Invalid phone number', hi: 'अमान्य फ़ोन नंबर', ta: 'செல்லுபடியாகாத தொலைபேசி எண்', te: 'చెల్లని ఫోన్ నంబర్' },

    // Admin Policies
    'admin.policies.preview.languageTab.en': { en: 'English', hi: 'अंग्रेज़ी', ta: 'ஆங்கிலம்', te: 'ఆంగ్లం' },
    'admin.policies.preview.languageTab.hi': { en: 'Hindi', hi: 'हिन्दी', ta: 'ஹிந்தி', te: 'హిందీ' },
    'admin.policies.preview.languageTab.ta': { en: 'Tamil', hi: 'तमिल', ta: 'தமிழ்', te: 'తమిళం' },
    'admin.policies.preview.languageTab.te': { en: 'Telugu', hi: 'तेलुगु', ta: 'தெலுங்கு', te: 'తెలుగు' },
    'admin.policies.preview.notAvailable': { en: 'Preview not available', hi: 'पूर्वावलोकन उपलब्ध नहीं है', ta: 'முன்னோட்டம் கிடைக்கவில்லை', te: 'ప్రివ్యూ అందుబాటులో లేదు' },
    'admin.policies.upload.formatHelp.title': { en: 'Format Help', hi: 'प्रारूप सहायता', ta: 'வடிவமைப்பு உதவி', te: 'ఫార్మాట్ సహాయం' },
    'admin.policies.upload.formatHelp.description': { en: 'Supported formats: PDF, DOCX', hi: 'समर्थित प्रारूप: PDF, DOCX', ta: 'ஆதரிக்கப்படும் வடிவங்கள்: PDF, DOCX', te: 'మద్దతు ఉన్న ఫార్మాట్లు: PDF, DOCX' },

    // Admin Reviews
    'admin.reviews.title': { en: 'Review Management', hi: 'समीक्षा प्रबंधन', ta: 'விமர்சன மேலாண்மை', te: 'సమీక్ష నిర్వహణ' },
    'admin.reviews.search': { en: 'Search reviews...', hi: 'समीक्षाएँ खोजें...', ta: 'விமர்சனங்களைத் தேடுங்கள்...', te: 'సమీక్షలను శోధించండి...' },
    'admin.reviews.empty': { en: 'No reviews found', hi: 'कोई समीक्षा नहीं मिली', ta: 'விமர்சனங்கள் எதுவும் இல்லை', te: 'సమీక్షలు కనుగొనబడలేదు' },
    'admin.reviews.loading': { en: 'Loading reviews...', hi: 'समीक्षाएँ लोड हो रही हैं...', ta: 'விமர்சனங்கள் ஏற்றப்படுகின்றன...', te: 'సమీక్షలు లోడ్ అవుతున్నాయి...' },
    'admin.reviews.delete.title': { en: 'Delete Review', hi: 'समीक्षा हटाएं', ta: 'விமர்சனத்தை நீக்கு', te: 'సమీక్షను తొలగించు' },
    'admin.reviews.delete.description': { en: 'Are you sure you want to delete this review?', hi: 'क्या आप वाकई इस समीक्षा को हटाना चाहते हैं?', ta: 'இந்த விமர்சனத்தை நிச்சயமாக நீக்க விரும்புகிறீர்களா?', te: 'మీరు ఖచ్చితంగా ఈ సమీక్షను తొలగించాలనుకుంటున్నారా?' },
    'admin.reviews.delete.confirm': { en: 'Delete', hi: 'हटाएं', ta: 'நீக்கு', te: 'తొలగించు' },
    'admin.reviews.delete.cancel': { en: 'Cancel', hi: 'रद्द करें', ta: 'ரத்துசெய்', te: 'రద్దు చేయి' },
    'admin.reviews.delete.success': { en: 'Review deleted successfully', hi: 'समीक्षा सफलतापूर्वक हटा दी गई', ta: 'விமர்சனம் வெற்றிகரமாக நீக்கப்பட்டது', te: 'సమీక్ష విజయవంతంగా తొలగించబడింది' },
    'admin.reviews.delete.error': { en: 'Failed to delete review', hi: 'समीक्षा हटाने में विफल', ta: 'விமர்சனத்தை நீக்க முடியவில்லை', te: 'సమీక్షను తొలగించడంలో విఫలమైంది' },
    'admin.reviews.table.product': { en: 'Product', hi: 'उत्पाद', ta: 'தயாரிப்பு', te: 'ఉత్పత్తి' },
    'admin.reviews.table.user': { en: 'User', hi: 'उपयोगकर्ता', ta: 'பயனர்', te: 'వినియోగదారు' },
    'admin.reviews.table.rating': { en: 'Rating', hi: 'रेटिंग', ta: 'மதிப்பீடு', te: 'రేటింగ్' },
    'admin.reviews.table.review': { en: 'Review', hi: 'समीक्षा', ta: 'விமர்சனம்', te: 'సమీక్ష' },
    'admin.reviews.table.date': { en: 'Date', hi: 'तारीख', ta: 'தேதி', te: 'తేదీ' },
    'admin.reviews.table.actions': { en: 'Actions', hi: 'कार्रवाई', ta: 'செயல்கள்', te: 'చర్యలు' },
    'admin.reviews.table.verified': { en: 'Verified Purchase', hi: 'सत्यापित खरीद', ta: 'சரிபார்க்கப்பட்ட கொள்முதல்', te: 'ధృవీకరించబడిన కొనుగోలు' },
    'admin.reviews.table.unknownProduct': { en: 'Unknown Product', hi: 'अज्ञात उत्पाद', ta: 'தெரியாத தயாரிப்பு', te: 'తెలియని ఉత్పత్తి' },
    'admin.reviews.pagination.previous': { en: 'Previous', hi: 'पिछला', ta: 'முந்தைய', te: 'మునుపటి' },
    'admin.reviews.pagination.next': { en: 'Next', hi: 'अगला', ta: 'அடுத்தது', te: 'తరువాత' },
    'admin.reviews.pagination.pageInfo': { en: 'Page {{current}} of {{total}}', hi: 'पृष्ठ {{total}} में से {{current}}', ta: 'பக்கம் {{total}}-இல் {{current}}', te: 'పేజీ {{total}} లో {{current}}' },

    // Admin Settings
    'admin.settings.title': { en: 'Settings', hi: 'सेटिंग्स', ta: 'அமைப்புகள்', te: 'సెట్టింగ్‌లు' },
    'admin.settings.subtitle': { en: 'Manage your application settings', hi: 'अपनी एप्लिकेशन सेटिंग्स प्रबंधित करें', ta: 'உங்கள் பயன்பாட்டு அமைப்புகளை நிர்வகிக்கவும்', te: 'మీ అప్లికేషన్ సెట్టింగ్‌లను నిర్వహించండి' },
    'admin.settings.actions.saveChanges': { en: 'Save Changes', hi: 'परिवर्तन सहेजें', ta: 'மாற்றங்களைச் சேமி', te: 'మార్పులను భద్రపరచు' },
    'admin.settings.actions.saving': { en: 'Saving...', hi: 'सहेजा जा रहा है...', ta: 'சேமிக்கிறது...', te: 'భద్రపరుస్తోంది...' },
    'admin.settings.deliveryLoading': { en: 'Loading delivery settings...', hi: 'डिलीवरी सेटिंग्स लोड हो रही हैं...', ta: 'விநியோக அமைப்புகள் ஏற்றப்படுகின்றன...', te: 'డెలివరీ సెట్టింగ్‌లు లోడ్ అవుతున్నాయి...' },
    'admin.settings.delivery.label': { en: 'Delivery Settings', hi: 'डिलीवरी सेटिंग्स', ta: 'விநியோக அமைப்புகள்', te: 'డెలివరీ సెట్టింగ్‌లు' },
    'admin.settings.delivery.cardTitle': { en: 'Delivery Configuration', hi: 'डिलीवरी कॉन्फ़िगरेशन', ta: 'விநியோக கட்டமைப்பு', te: 'డెలివరీ కాన్ఫిగరేషన్' },
    'admin.settings.delivery.cardDesc': { en: 'Configure delivery charges and thresholds', hi: 'डिलीवरी शुल्क और सीमाएं कॉन्फ़िगर करें', ta: 'விநியோக கட்டணங்கள் மற்றும் வரம்புகளை கட்டமைக்கவும்', te: 'డెలివరీ ఛార్జీలు మరియు పరిమితులను కాన్ఫిగర్ చేయండి' },
    'admin.settings.delivery.chargeLabel': { en: 'Delivery Charge', hi: 'डिलीवरी शुल्क', ta: 'விநியோக கட்டணம்', te: 'డెలివరీ ఛార్జ్' },
    'admin.settings.delivery.chargeDesc': { en: 'Amount to charge for delivery', hi: 'डिलीवरी के लिए ली जाने वाली राशि', ta: 'விநியோகத்திற்கு வசூலிக்க வேண்டிய தொகை', te: 'డెలివరీ కోసం ఛార్జ్ చేయవలసిన మొత్తం' },
    'admin.settings.delivery.thresholdLabel': { en: 'Free Delivery Threshold', hi: 'मुफ्त डिलीवरी सीमा', ta: 'இலவச விநியோக வரம்பு', te: 'ఉచిత డెలివరీ పరిమితి' },
    'admin.settings.delivery.thresholdDesc': { en: 'Minimum amount for free delivery', hi: 'मुफ्त डिलीवरी के लिए न्यूनतम राशि', ta: 'இலவச விநியோகத்திற்கான குறைந்தபட்ச தொகை', te: 'ఉచిత డెలివరీ కోసం కనీస మొత్తం' },
    'admin.settings.delivery.gstLabel': { en: 'GST (%)', hi: 'जीएसटी (%)', ta: 'ஜிஎஸ்டி (%)', te: 'జిఎస్‌టి (%)' },
    'admin.settings.delivery.gstDesc': { en: 'Tax rate for delivery charges', hi: 'डिलीवरी शुल्क के लिए कर दर', ta: 'விநியோக கட்டணங்களுக்கான வரி விகிதம்', te: 'డెలివరీ ఛార్జీలకు పన్ను రేటు' },
    'admin.settings.gst.placeholder': { en: 'e.g., 18', hi: 'जैसे, 18', ta: 'எ.கா., 18', te: 'ఉదా., 18' },
    'admin.settings.coupons.label': { en: 'Coupons', hi: 'कूपन', ta: 'கூப்பன்கள்', te: 'కూపన్లు' },

    // Admin Users Dialog
    'admin.users.dialog.errorNameRequired': { en: 'Name is required', hi: 'नाम आवश्यक है', ta: 'பெயர் தேவை', te: 'పేరు అవసరం' },
    'admin.users.dialog.errorEmailRequired': { en: 'Email is required', hi: 'ईमेल आवश्यक है', ta: 'மின்னஞ்சல் தேவை', te: 'ఇమెయిల్ అవసరం' },
    'admin.users.dialog.errorPhoneRequired': { en: 'Phone number is required', hi: 'फ़ोन नंबर आवश्यक है', ta: 'தொலைபேசி எண் தேவை', te: 'ఫోన్ నంబర్ అవసరం' },

    // Status (Dashboard)
    'status.active': { en: 'Active', hi: 'सक्रिय', ta: 'செயலில்', te: 'చురుకుగా' },
    'status.inactive': { en: 'Inactive', hi: 'निष्क्रिय', ta: 'செயலற்ற', te: 'నిష్క్రియ' },
    'status.pending': { en: 'Pending', hi: 'लंबित', ta: 'நிலுவையில்', te: 'పెండింగ్' }
};

let totalAdded = 0;

locales.forEach(lang => {
    const filePath = path.join(FRONTEND_DIR, `${lang}.json`);
    let data = {};

    try {
        if (fs.existsSync(filePath)) {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        console.log(`Processing ${lang}...`);

        Object.keys(newKeys).forEach(keyPath => {
            const val = newKeys[keyPath][lang] || newKeys[keyPath]['en']; // Fallback to EN if specific lang missing in our map
            if (setNestedKey(data, keyPath, val)) {
                console.log(`  [${lang}] Added: ${keyPath}`);
                totalAdded++;
            }
        });

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    } catch (e) {
        console.error(`Error processing ${lang}:`, e);
    }
});

console.log(`\nDone! Added ${totalAdded} keys across all locales.`);
