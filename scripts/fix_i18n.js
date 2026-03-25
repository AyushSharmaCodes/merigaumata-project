#!/usr/bin/env node
/**
 * i18n Fix Script - Phase 1 & 2
 * 
 * Phase 1: Sync missing keys across all 4 frontend locale files
 * Phase 2: Add missing keys referenced by t() calls in source code
 * Also adds missing backend locale keys
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');
const BACKEND_DIR = path.join(__dirname, '../backend/locales');

function loadJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function flattenObject(obj, prefix = '') {
    const result = {};
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(result, flattenObject(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    }
    return result;
}

// Set a nested key in an object
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

// Get a nested key from an object
function getNestedKey(obj, keyPath) {
    const parts = keyPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (!current || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return current;
}

// ========== PHASE 1: Sync missing keys across frontend locales ==========
console.log('=== PHASE 1: Syncing missing keys across frontend locales ===\n');

const frontendLocales = {};
['en', 'hi', 'ta', 'te'].forEach(l => {
    frontendLocales[l] = loadJSON(path.join(FRONTEND_DIR, `${l}.json`));
});

const frontendFlat = {};
['en', 'hi', 'ta', 'te'].forEach(l => {
    frontendFlat[l] = flattenObject(frontendLocales[l]);
});

// Collect all keys
const allFrontendKeys = new Set();
Object.values(frontendFlat).forEach(f => Object.keys(f).forEach(k => allFrontendKeys.add(k)));

// For each missing key, find value from another locale or provide English default
let phase1Count = 0;
for (const key of [...allFrontendKeys].sort()) {
    for (const lang of ['en', 'hi', 'ta', 'te']) {
        if (!(key in frontendFlat[lang])) {
            // This key is missing from this locale. Find value from en if available, else from any other locale
            let value;
            if (lang !== 'en' && key in frontendFlat.en) {
                value = frontendFlat.en[key]; // Use English value as fallback
            } else {
                // Find from any locale that has it
                for (const other of ['en', 'hi', 'ta', 'te']) {
                    if (key in frontendFlat[other]) {
                        value = frontendFlat[other][key];
                        break;
                    }
                }
            }

            if (value !== undefined) {
                setNestedKey(frontendLocales[lang], key, value);
                console.log(`  [${lang}] Added: ${key} = ${JSON.stringify(value).substring(0, 60)}`);
                phase1Count++;
            }
        }
    }
}
console.log(`\n  Phase 1: Added ${phase1Count} missing keys.\n`);

// ========== PHASE 2: Add keys referenced by t() calls ==========
console.log('=== PHASE 2: Adding keys referenced by t() calls ===\n');

// Frontend missing keys (from audit)
const frontendMissingKeys = {
    "admin.products.deleteDialog.title": {
        en: "Delete Product",
        hi: "उत्पाद हटाएं",
        ta: "தயாரிப்பை நீக்கு",
        te: "ఉత్పత్తిని తొలగించు"
    },
    "admin.products.deleteDialog.desc": {
        en: "Are you sure you want to delete this product? This action cannot be undone.",
        hi: "क्या आप वाकई इस उत्पाद को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।",
        ta: "இந்த தயாரிப்பை நீக்க விரும்புகிறீர்களா? இந்த செயலை மாற்ற முடியாது.",
        te: "మీరు ఈ ఉత్పత్తిని తొలగించాలనుకుంటున్నారా? ఈ చర్యను రద్దు చేయలేరు."
    },
    "admin.products.toasts.exportError": {
        en: "Export failed. Please try again.",
        hi: "निर्यात विफल। कृपया पुनः प्रयास करें।",
        ta: "ஏற்றுமதி தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.",
        te: "ఎగుమతి విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి."
    },
    "admin.products.toasts.exportStartedTitle": {
        en: "Export Started",
        hi: "निर्यात शुरू हुआ",
        ta: "ஏற்றுமதி தொடங்கியது",
        te: "ఎగుమతి ప్రారంభమైంది"
    },
    "admin.products.toasts.exportStartedDesc": {
        en: "Your file will be downloaded shortly.",
        hi: "आपकी फ़ाइल शीघ्र ही डाउनलोड हो जाएगी।",
        ta: "உங்கள் கோப்பு விரைவில் பதிவிறக்கம் செய்யப்படும்.",
        te: "మీ ఫైల్ త్వరలో డౌన్‌లోడ్ అవుతుంది."
    },
    "admin.orders.detail.actions.markingItemReturned": {
        en: "Marking item as returned...",
        hi: "आइटम को लौटाया गया चिह्नित कर रहा है...",
        ta: "பொருளை திருப்பியளிக்கப்பட்டதாக குறிக்கிறது...",
        te: "వస్తువును తిరిగి ఇచ్చినట్లు గుర్తిస్తోంది..."
    },
    "admin.orders.detail.toasts.itemStatusUpdated": {
        en: "Item status updated successfully",
        hi: "आइटम की स्थिति सफलतापूर्वक अपडेट हुई",
        ta: "பொருள் நிலை வெற்றிகரமாக புதுப்பிக்கப்பட்டது",
        te: "వస్తువు స్థితి విజయవంతంగా నవీకరించబడింది"
    },
    "common.sharingOn": {
        en: "Sharing on",
        hi: "पर साझा करें",
        ta: "இல் பகிரவும்",
        te: "లో భాగస్వామ్యం చేయండి"
    },
    "profile.personalInfo": {
        en: "Personal Information",
        hi: "व्यक्तिगत जानकारी",
        ta: "தனிப்பட்ட தகவல்",
        te: "వ్యక్తిగత సమాచారం"
    }
};

let phase2FrontCount = 0;
for (const [key, translations] of Object.entries(frontendMissingKeys)) {
    for (const lang of ['en', 'hi', 'ta', 'te']) {
        if (!getNestedKey(frontendLocales[lang], key)) {
            setNestedKey(frontendLocales[lang], key, translations[lang]);
            console.log(`  [frontend/${lang}] Added: ${key}`);
            phase2FrontCount++;
        }
    }
}

// Backend missing keys
console.log('');
const backendLocales = {};
['en', 'hi', 'ta', 'te'].forEach(l => {
    backendLocales[l] = loadJSON(path.join(BACKEND_DIR, `${l}.json`));
});

const backendMissingKeys = {
    "emails.auth.otp.subjectPrefix": {
        en: "Your verification code",
        hi: "आपका सत्यापन कोड",
        ta: "உங்கள் சரிபார்ப்புக் குறியீடு",
        te: "మీ ధృవీకరణ కోడ్"
    },
    "emails.auth.passwordReset.title": {
        en: "Password Reset Request",
        hi: "पासवर्ड रीसेट अनुरोध",
        ta: "கடவுச்சொல் மீட்டமைப்பு கோரிக்கை",
        te: "పాస్‌వర్డ్ రీసెట్ అభ్యర్థన"
    },
    "emails.auth.passwordReset.body": {
        en: "We received a request to reset your password. Click the button below to create a new password.",
        hi: "हमें आपका पासवर्ड रीसेट करने का अनुरोध प्राप्त हुआ। नया पासवर्ड बनाने के लिए नीचे दिए गए बटन पर क्लिक करें।",
        ta: "உங்கள் கடவுச்சொல்லை மீட்டமைக்க கோரிக்கை பெறப்பட்டது. புதிய கடவுச்சொல்லை உருவாக்க கீழே உள்ள பொத்தானை கிளிக் செய்யவும்.",
        te: "మీ పాస్‌వర్డ్‌ను రీసెట్ చేయడానికి మేము అభ్యర్థన అందుకున్నాము. కొత్త పాస్‌వర్డ్ సృష్టించడానికి క్రింది బటన్‌ను క్లిక్ చేయండి."
    },
    "emails.auth.passwordReset.button": {
        en: "Reset Password",
        hi: "पासवर्ड रीसेट करें",
        ta: "கடவுச்சொல்லை மீட்டமையுங்கள்",
        te: "పాస్‌వర్డ్ రీసెట్ చేయండి"
    },
    "emails.auth.passwordReset.copy": {
        en: "If the button doesn't work, copy and paste this link into your browser:",
        hi: "यदि बटन काम न करे, तो इस लिंक को कॉपी करके अपने ब्राउज़र में पेस्ट करें:",
        ta: "பொத்தான் வேலை செய்யவில்லை என்றால், இந்த இணைப்பை நகலெடுத்து உங்கள் உலாவியில் ஒட்டவும்:",
        te: "బటన్ పనిచేయకపోతే, ఈ లింక్‌ను కాపీ చేసి మీ బ్రౌజర్‌లో అతికించండి:"
    },
    "emails.auth.passwordReset.note": {
        en: "If you did not request a password reset, please ignore this email.",
        hi: "यदि आपने पासवर्ड रीसेट का अनुरोध नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें।",
        ta: "நீங்கள் கடவுச்சொல் மீட்டமைப்பு கோரவில்லை என்றால், இந்த மின்னஞ்சலை புறக்கணிக்கவும்.",
        te: "మీరు పాస్‌వర్డ్ రీసెట్ అభ్యర్థించకపోతే, దయచేసి ఈ ఇమెయిల్‌ను విస్మరించండి."
    },
    "titles.passwordReset": {
        en: "Password Reset",
        hi: "पासवर्ड रीसेट",
        ta: "கடவுச்சொல் மீட்டமைப்பு",
        te: "పాస్‌వర్డ్ రీసెట్"
    },
    "titles.securityVerification": {
        en: "Security Verification",
        hi: "सुरक्षा सत्यापन",
        ta: "பாதுகாப்பு சரிபார்ப்பு",
        te: "భద్రతా ధృవీకరణ"
    }
};

let phase2BackCount = 0;
for (const [key, translations] of Object.entries(backendMissingKeys)) {
    for (const lang of ['en', 'hi', 'ta', 'te']) {
        if (!getNestedKey(backendLocales[lang], key)) {
            setNestedKey(backendLocales[lang], key, translations[lang]);
            console.log(`  [backend/${lang}] Added: ${key}`);
            phase2BackCount++;
        }
    }
}

console.log(`\n  Phase 2: Added ${phase2FrontCount} frontend keys and ${phase2BackCount} backend keys.\n`);

// ========== PHASE 3 (partial): Add keys for hardcoded frontend strings ==========
console.log('=== PHASE 3: Adding i18n keys for frontend hardcoded strings ===\n');

const frontendNewKeys = {
    // RichTextEditor
    "admin.richTextEditor.bold": { en: "Bold", hi: "बोल्ड", ta: "தடிமன்", te: "బోల్డ్" },
    "admin.richTextEditor.italic": { en: "Italic", hi: "इटैलिक", ta: "சாய்வு", te: "ఇటాలిక్" },
    "admin.richTextEditor.heading1": { en: "Heading 1", hi: "शीर्षक 1", ta: "தலைப்பு 1", te: "శీర్షిక 1" },
    "admin.richTextEditor.heading2": { en: "Heading 2", hi: "शीर्षक 2", ta: "தலைப்பு 2", te: "శీర్షిక 2" },
    "admin.richTextEditor.bulletList": { en: "Bullet List", hi: "बुलेट सूची", ta: "புல்லட் பட்டியல்", te: "బుల్లెట్ జాబితా" },
    "admin.richTextEditor.numberedList": { en: "Numbered List", hi: "क्रमांकित सूची", ta: "எண் பட்டியல்", te: "నంబర్ జాబితా" },
    "admin.richTextEditor.codeBlock": { en: "Code Block", hi: "कोड ब्लॉक", ta: "குறியீடு திகுதி", te: "కోడ్ బ్లాక్" },
    "admin.richTextEditor.insertLink": { en: "Insert Link", hi: "लिंक डालें", ta: "இணைப்பை செருகு", te: "లింక్ చేర్చండి" },
    "admin.richTextEditor.insertImage": { en: "Insert Image", hi: "छवि डालें", ta: "படத்தை செருகு", te: "చిత్రాన్ని చేర్చండి" },
    "admin.richTextEditor.imageUrl": { en: "Image URL", hi: "छवि URL", ta: "பட URL", te: "చిత్రం URL" },
    "admin.richTextEditor.linkUrl": { en: "Link URL", hi: "लिंक URL", ta: "இணைப்பு URL", te: "లింక్ URL" },
    "admin.richTextEditor.linkText": { en: "Link Text", hi: "लिंक टेक्स्ट", ta: "இணைப்பு உரை", te: "లింక్ టెక్స్ట్" },

    // UserDialog
    "admin.users.dialog.addTitle": { en: "Add New Admin User", hi: "नया व्यवस्थापक जोड़ें", ta: "புதிய நிர்வாகியை சேர்க்கவும்", te: "కొత్త నిర్వాహకుడిని జోడించండి" },
    "admin.users.dialog.fullName": { en: "Full Name", hi: "पूरा नाम", ta: "முழு பெயர்", te: "పూర్తి పేరు" },
    "admin.users.dialog.enterFullName": { en: "Enter full name", hi: "पूरा नाम दर्ज करें", ta: "முழு பெயரை உள்ளிடவும்", te: "పూర్తి పేరు నమోదు చేయండి" },
    "admin.users.dialog.enterEmail": { en: "Enter email address", hi: "ईमेल पता दर्ज करें", ta: "மின்னஞ்சல் முகவரியை உள்ளிடவும்", te: "ఇమెయిల్ చిరునామా నమోదు చేయండి" },
    "admin.users.dialog.enterPhone": { en: "Enter phone number", hi: "फ़ोन नंबर दर्ज करें", ta: "தொலைபேசி எண்ணை உள்ளிடவும்", te: "ఫోన్ నంబర్ నమోదు చేయండి" },
    "admin.users.dialog.addressInfo": { en: "Address Information", hi: "पता जानकारी", ta: "முகவரி தகவல்", te: "చిరునామా సమాచారం" },
    "admin.users.dialog.streetAddress": { en: "Street Address", hi: "सड़क का पता", ta: "தெரு முகவரி", te: "వీధి చిరునామా" },
    "admin.users.dialog.enterStreet": { en: "Enter street address", hi: "सड़क का पता दर्ज करें", ta: "தெரு முகவரியை உள்ளிடவும்", te: "వీధి చిరునామా నమోదు చేయండి" },
    "admin.users.dialog.city": { en: "City", hi: "शहर", ta: "நகரம்", te: "నగరం" },
    "admin.users.dialog.enterCity": { en: "Enter city", hi: "शहर दर्ज करें", ta: "நகரத்தை உள்ளிடவும்", te: "నగరం నమోదు చేయండి" },
    "admin.users.dialog.state": { en: "State", hi: "राज्य", ta: "மாநிலம்", te: "రాష్ట్రం" },
    "admin.users.dialog.enterState": { en: "Enter state", hi: "राज्य दर्ज करें", ta: "மாநிலத்தை உள்ளிடவும்", te: "రాష్ట్రాన్ని నమోదు చేయండి" },
    "admin.users.dialog.country": { en: "Country", hi: "देश", ta: "நாடு", te: "దేశం" },
    "admin.users.dialog.enterCountry": { en: "Enter country", hi: "देश दर्ज करें", ta: "நாட்டை உள்ளிடவும்", te: "దేశాన్ని నమోదు చేయండి" },
    "admin.users.dialog.pinCode": { en: "PIN Code", hi: "पिन कोड", ta: "அஞ்சல் குறியீடு", te: "పిన్ కోడ్" },
    "admin.users.dialog.enterPinCode": { en: "Enter PIN code", hi: "पिन कोड दर्ज करें", ta: "அஞ்சல் குறியீட்டை உள்ளிடவும்", te: "పిన్ కోడ్ నమోదు చేయండి" },

    // UserOrdersDialog
    "admin.users.ordersDialog.title": { en: "User Orders", hi: "उपयोगकर्ता के आदेश", ta: "பயனர் ஆர்டர்கள்", te: "వినియోగదారు ఆర్డర్లు" },
    "admin.users.ordersDialog.orderId": { en: "Order ID", hi: "ऑर्डर आईडी", ta: "ஆர்டர் ஐடி", te: "ఆర్డర్ ఐడి" },
    "admin.users.ordersDialog.items": { en: "Items", hi: "आइटम", ta: "பொருட்கள்", te: "వస్తువులు" },
    "admin.users.ordersDialog.total": { en: "Total", hi: "कुल", ta: "மொத்தம்", te: "మొత్తం" },
    "admin.users.ordersDialog.status": { en: "Status", hi: "स्थिति", ta: "நிலை", te: "స్థితి" },
    "admin.users.ordersDialog.payment": { en: "Payment", hi: "भुगतान", ta: "கட்டணம்", te: "చెల్లింపు" },

    // OTPInput
    "auth.otp.didntReceive": { en: "Didn't receive code?", hi: "कोड नहीं मिला?", ta: "குறியீடு வரவில்லையா?", te: "కోడ్ రాలేదా?" },

    // PermissionProtectedRoute
    "auth.verifyingPermissions": { en: "Verifying permissions...", hi: "अनुमतियाँ सत्यापित हो रही हैं...", ta: "அனுமதிகள் சரிபார்க்கப்படுகின்றன...", te: "అనుమతులు ధృవీకరించబడుతున్నాయి..." },

    // AuthCallback
    "auth.authenticating": { en: "Authenticating...", hi: "प्रमाणित हो रहा है...", ta: "அங்கீகரிக்கிறது...", te: "ధృవీకరిస్తోంది..." },
    "auth.pleaseWait": { en: "Please wait while we log you in.", hi: "कृपया प्रतीक्षा करें, हम आपको लॉग इन कर रहे हैं।", ta: "நாங்கள் உங்களை உள்நுழைய வைக்கும் வரை காத்திருங்கள்.", te: "మేము మిమ్మల్ని లాగిన్ చేస్తున్నప్పుడు దయచేసి వేచి ఉండండి." },

    // FolderImagesDialog
    "admin.gallery.uploadNewImages": { en: "Upload New Images", hi: "नई छवियां अपलोड करें", ta: "புதிய படங்களை பதிவேற்றவும்", te: "కొత్త చిత్రాలను అప్‌లోడ్ చేయండి" },

    // PolicyPreviewDialog
    "admin.policy.noContentPreview": { en: "No content available to preview.", hi: "पूर्वावलोकन के लिए कोई सामग्री उपलब्ध नहीं है।", ta: "முன்னோட்டத்திற்கு உள்ளடக்கம் இல்லை.", te: "ప్రివ్యూ కోసం కంటెంట్ అందుబాటులో లేదు." },

    // ProfileImageCropper
    "admin.profile.previewAlt": { en: "Profile preview", hi: "प्रोफ़ाइल पूर्वावलोकन", ta: "சுயவிவர முன்னோட்டம்", te: "ప్రొఫైల్ ప్రివ్యూ" },

    // ImageCropperModal
    "profile.updateProfilePicture": { en: "Update Profile Picture", hi: "प्रोफ़ाइल चित्र अपडेट करें", ta: "சுயவிவர படத்தை புதுப்பிக்கவும்", te: "ప్రొఫైల్ చిత్రాన్ని అప్‌డేట్ చేయండి" },
    "profile.zoom": { en: "Zoom", hi: "ज़ूम", ta: "பெரிதாக்கு", te: "జూమ్" },

    // ProfileSettings
    "profile.emailPlaceholder": { en: "Email Address", hi: "ईमेल पता", ta: "மின்னஞ்சல் முகவரி", te: "ఇమెయిల్ చిరునామా" },
    "profile.mobilePlaceholder": { en: "Mobile Number", hi: "मोबाइल नंबर", ta: "கைபேசி எண்", te: "మొబైల్ నంబర్" },

    // UpdatePasswordDialog
    "profile.password.securityVeil": { en: "Security Veil", hi: "सुरक्षा आवरण", ta: "பாதுகாப்பு திரை", te: "భద్రతా తెర" },
    "profile.password.validationRequired": { en: "Validation Required", hi: "सत्यापन आवश्यक", ta: "சரிபார்ப்பு தேவை", te: "ధృవీకరణ అవసరం" },

    // VariantSelector
    "products.selectSize": { en: "Select product size", hi: "उत्पाद का आकार चुनें", ta: "தயாரிப்பு அளவைத் தேர்ந்தெடுக்கவும்", te: "ఉత్పత్తి పరిమాణాన్ని ఎంచుకోండి" },

    // VariantFormSection
    "admin.products.dialog.featurePlaceholder": { en: "• Feature 1\n• Feature 2", hi: "• विशेषता 1\n• विशेषता 2", ta: "• அம்சம் 1\n• அம்சம் 2", te: "• ఫీచర్ 1\n• ఫీచర్ 2" },

    // FAQ.tsx
    "faq.heroAlt": { en: "FAQ Hero", hi: "FAQ हीरो", ta: "FAQ ஹீரோ", te: "FAQ హీరో" },
    "faq.contactAlt": { en: "Contact", hi: "संपर्क", ta: "தொடர்பு", te: "సంప్రదింపు" },

    // EventsManagement
    "admin.events.retryFailedJob": { en: "Retry failed job", hi: "विफल कार्य पुनः प्रयास करें", ta: "தோல்வியுற்ற வேலையை மீண்டும் முயற்சிக்கவும்", te: "విఫలమైన జాబ్‌ను మళ్ళీ ప్రయత్నించండి" },

    // UI Framework - accessibility text
    "common.accessibility.more": { en: "More", hi: "अधिक", ta: "மேலும்", te: "మరింత" },
    "common.accessibility.previousSlide": { en: "Previous slide", hi: "पिछली स्लाइड", ta: "முந்தைய ஸ்லைடு", te: "మునుపటి స్లైడ్" },
    "common.accessibility.nextSlide": { en: "Next slide", hi: "अगली स्लाइड", ta: "அடுத்த ஸ்லைடு", te: "తదుపటి స్లైడ్" },
    "common.accessibility.close": { en: "Close", hi: "बंद करें", ta: "மூடு", te: "మూసివేయండి" },
    "common.accessibility.toggleSidebar": { en: "Toggle Sidebar", hi: "साइडबार टॉगल करें", ta: "பக்கப்பட்டியை மாற்று", te: "సైడ్‌బార్ టోగుల్ చేయండి" },
};

let phase3Count = 0;
for (const [key, translations] of Object.entries(frontendNewKeys)) {
    for (const lang of ['en', 'hi', 'ta', 'te']) {
        setNestedKey(frontendLocales[lang], key, translations[lang]);
        phase3Count++;
    }
}
console.log(`  Phase 3: Added ${phase3Count} frontend i18n keys for hardcoded strings.\n`);

// ========== PHASE 4: Add backend keys for hardcoded strings ==========
console.log('=== PHASE 4: Adding backend i18n keys for hardcoded strings ===\n');

const backendNewKeys = {
    // Route success messages
    "success.about.updated": { en: "About section updated successfully", hi: "जानकारी अनुभाग सफलतापूर्वक अपडेट किया गया", ta: "பற்றிய பகுதி வெற்றிகரமாக புதுப்பிக்கப்பட்டது", te: "గురించి విభాగం విజయవంతంగా నవీకరించబడింది" },
    "success.about.memberAdded": { en: "Team member added successfully", hi: "टीम सदस्य सफलतापूर्वक जोड़ा गया", ta: "குழு உறுப்பினர் வெற்றிகரமாக சேர்க்கப்பட்டார்", te: "జట్టు సభ్యుడు విజయవంతంగా జోడించబడ్డారు" },
    "success.about.memberDeleted": { en: "Team member removed successfully", hi: "टीम सदस्य सफलतापूर्वक हटाया गया", ta: "குழு உறுப்பினர் வெற்றிகரமாக நீக்கப்பட்டார்", te: "జట్టు సభ్యుడు విజయవంతంగా తొలగించబడ్డారు" },
    "success.blog.created": { en: "Blog post created successfully", hi: "ब्लॉग पोस्ट सफलतापूर्वक बनाई गई", ta: "வலைப்பதிவு பதிவு வெற்றிகரமாக உருவாக்கப்பட்டது", te: "బ్లాగ్ పోస్ట్ విజయవంతంగా సృష్టించబడింది" },
    "success.blog.updated": { en: "Blog post updated successfully", hi: "ब्लॉग पोस्ट सफलतापूर्वक अपडेट की गई", ta: "வலைப்பதிவு பதிவு வெற்றிகரமாக புதுப்பிக்கப்பட்டது", te: "బ్లాగ్ పోస్ట్ విజయవంతంగా నవీకరించబడింది" },
    "success.blog.deleted": { en: "Blog post deleted successfully", hi: "ब्लॉग पोस्ट सफलतापूर्वक हटाई गई", ta: "வலைப்பதிவு பதிவு வெற்றிகரமாக நீக்கப்பட்டது", te: "బ్లాగ్ పోస్ట్ విజయవంతంగా తొలగించబడింది" },
    "success.category.created": { en: "Category created successfully", hi: "श्रेणी सफलतापूर्वक बनाई गई", ta: "வகை வெற்றிகரமாக உருவாக்கப்பட்டது", te: "వర్గం విజయవంతంగా సృష్టించబడింది" },
    "success.category.updated": { en: "Category updated successfully", hi: "श्रेणी सफलतापूर्वक अपडेट की गई", ta: "வகை வெற்றிகரமாக புதுப்பிக்கப்பட்டது", te: "వర్గం విజయవంతంగా నవీకరించబడింది" },
    "success.category.deleted": { en: "Category deleted successfully", hi: "श्रेणी सफलतापूर्वक हटाई गई", ta: "வகை வெற்றிகரமாக நீக்கப்பட்டது", te: "వర్గం విజయవంతంగా తొలగించబడింది" },
    "success.contact.messageSent": { en: "Message sent successfully", hi: "संदेश सफलतापूर्वक भेजा गया", ta: "செய்தி வெற்றிகரமாக அனுப்பப்பட்டது", te: "సందేశం విజయవంతంగా పంపబడింది" },
    "success.contact.settingsUpdated": { en: "Contact settings updated successfully", hi: "संपर्क सेटिंग्स सफलतापूर्वक अपडेट की गईं", ta: "தொடர்பு அமைப்புகள் வெற்றிகரமாக புதுப்பிக்கப்பட்டன", te: "సంప్రదింపు సెట్టింగ్‌లు విజయవంతంగా నవీకరించబడ్డాయి" },
    "success.contact.messageDeleted": { en: "Message deleted successfully", hi: "संदेश सफलतापूर्वक हटाया गया", ta: "செய்தி வெற்றிகரமாக நீக்கப்பட்டது", te: "సందేశం విజయవంతంగా తొలగించబడింది" },
    "success.coupon.deactivated": { en: "Coupon deactivated successfully", hi: "कूपन सफलतापूर्वक निष्क्रिय किया गया", ta: "கூப்பன் வெற்றிகரமாக செயலிழக்கப்பட்டது", te: "కూపన్ విజయవంతంగా నిష్క్రియం చేయబడింది" },
    "success.donation.verified": { en: "Donation verified successfully", hi: "दान सफलतापूर्वक सत्यापित हुआ", ta: "நன்கொடை வெற்றிகரமாக சரிபார்க்கப்பட்டது", te: "దానం విజయవంతంగా ధృవీకరించబడింది" },
    "success.subscription.cancelled": { en: "Subscription cancelled successfully", hi: "सदस्यता सफलतापूर्वक रद्द की गई", ta: "சந்தா வெற்றிகரமாக ரத்து செய்யப்பட்டது", te: "సబ్‌స్క్రిప్షన్ విజయవంతంగా రద్దు చేయబడింది" },
    "success.subscription.paused": { en: "Subscription paused successfully", hi: "सदस्यता सफलतापूर्वक रोकी गई", ta: "சந்தா வெற்றிகரமாக இடைநிறுத்தப்பட்டது", te: "సబ్‌స్క్రిప్షన్ విజయవంతంగా నిలిపివేయబడింది" },
    "success.subscription.resumed": { en: "Subscription resumed successfully", hi: "सदस्यता सफलतापूर्वक पुनः शुरू की गई", ta: "சந்தா வெற்றிகரமாக மீண்டும் தொடங்கப்பட்டது", te: "సబ్‌స్క్రిప్షన్ విజయవంతంగా పునఃప్రారంభించబడింది" },
    "success.email.sent": { en: "Email sent successfully", hi: "ईमेल सफलतापूर्वक भेजा गया", ta: "மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது", te: "ఇమెయిల్ విజయవంతంగా పంపబడింది" },
    "success.email.templatedSent": { en: "Templated email sent successfully", hi: "टेम्पलेट ईमेल सफलतापूर्वक भेजा गया", ta: "வார்ப்புரு மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது", te: "టెంప్లేట్ ఇమెయిల్ విజయవంతంగా పంపబడింది" },
    "success.email.testSent": { en: "Test email sent successfully", hi: "परीक्षण ईमेल सफलतापूर्वक भेजा गया", ta: "சோதனை மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது", te: "టెస్ట్ ఇమెయిల్ విజయవంతంగా పంపబడింది" },
    "success.faq.deleted": { en: "FAQ deleted successfully", hi: "FAQ सफलतापूर्वक हटाया गया", ta: "FAQ வெற்றிகரமாக நீக்கப்பட்டது", te: "FAQ విజయవంతంగా తొలగించబడింది" },
    "success.faq.reordered": { en: "FAQs reordered successfully", hi: "FAQ सफलतापूर्वक पुनः क्रमित किए गए", ta: "FAQ வெற்றிகரமாக மறுவரிசைப்படுத்தப்பட்டது", te: "FAQ విజయవంతంగా పునఃక్రమబద్ధీకరించబడింది" },
    "success.invoice.regenerated": { en: "Invoice regenerated successfully", hi: "चालान सफलतापूर्वक पुनः जनित किया गया", ta: "விலைப்பட்டியல் வெற்றிகரமாக மீண்டும் உருவாக்கப்பட்டது", te: "ఇన్‌వాయిస్ విజయవంతంగా పునఃసృష్టించబడింది" },
    "success.jobs.deletionRetry": { en: "Account deletion job retry triggered successfully.", hi: "खाता हटाने का कार्य पुनः प्रयास सफलतापूर्वक शुरू किया गया।", ta: "கணக்கு நீக்க வேலை மீண்டும் முயற்சி வெற்றிகரமாக தூண்டப்பட்டது.", te: "ఖాతా తొలగింపు జాబ్ మళ్ళీ ప్రయత్నం విజయవంతంగా ప్రారంభించబడింది." },
    "success.jobs.allCancelled": { en: "All registrations already cancelled. Job marked as completed.", hi: "सभी पंजीकरण पहले से रद्द हैं। कार्य पूर्ण के रूप में चिह्नित।", ta: "அனைத்து பதிவுகளும் ஏற்கனவே ரத்து செய்யப்பட்டன. வேலை நிறைவு செய்யப்பட்டதாக குறிக்கப்பட்டது.", te: "అన్ని నమోదులు ఇప్పటికే రద్దు చేయబడ్డాయి. జాబ్ పూర్తయినట్లు గుర్తించబడింది." },
    "success.jobs.deletionTriggered": { en: "Account deletion job processing triggered.", hi: "खाता हटाने का कार्य प्रसंस्करण शुरू किया गया।", ta: "கணக்கு நீக்க வேலை செயலாக்கம் தூண்டப்பட்டது.", te: "ఖాతా తొలగింపు జాబ్ ప్రాసెసింగ్ ప్రారంభించబడింది." },
    "success.jobs.eventCancellation": { en: "Event cancellation job processing triggered.", hi: "इवेंट रद्दीकरण कार्य प्रसंस्करण शुरू किया गया।", ta: "நிகழ்வு ரத்து வேலை செயலாக்கம் தூண்டப்பட்டது.", te: "ఈవెంట్ రద్దు జాబ్ ప్రాసెసింగ్ ప్రారంభించబడింది." },
    "success.return.cancelled": { en: "Return request cancelled successfully", hi: "वापसी अनुरोध सफलतापूर्वक रद्द किया गया", ta: "திரும்ப கோரிக்கை வெற்றிகரமாக ரத்து செய்யப்பட்டது", te: "రిటర్న్ అభ్యర్థన విజయవంతంగా రద్దు చేయబడింది" },
    "success.return.submitted": { en: "Return request submitted successfully", hi: "वापसी अनुरोध सफलतापूर्वक जमा किया गया", ta: "திரும்ப கோரிக்கை வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது", te: "రిటర్న్ అభ్యర్థన విజయవంతంగా సమర్పించబడింది" },
    "success.return.approved": { en: "Return approved", hi: "वापसी स्वीकृत", ta: "திரும்ப ஒப்புதல்", te: "రిటర్న్ ఆమోదించబడింది" },
    "success.return.rejected": { en: "Return rejected", hi: "वापसी अस्वीकृत", ta: "திரும்ப நிராகரிப்பு", te: "రిటర్న్ తిరస్కరించబడింది" },
    "success.review.submitted": { en: "Review submitted successfully", hi: "समीक्षा सफलतापूर्वक जमा की गई", ta: "விமர்சனம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது", te: "సమీక్ష విజయవంతంగా సమర్పించబడింది" },
    "success.review.deleted": { en: "Review deleted successfully", hi: "समीक्षा सफलतापूर्वक हटाई गई", ta: "விமர்சனம் வெற்றிகரமாக நீக்கப்பட்டது", te: "సమీక్ష విజయవంతంగా తొలగించబడింది" },
    "success.socialMedia.deleted": { en: "Social media link deleted successfully", hi: "सोशल मीडिया लिंक सफलतापूर्वक हटाया गया", ta: "சமூக ஊடக இணைப்பு வெற்றிகரமாக நீக்கப்பட்டது", te: "సోషల్ మీడియా లింక్ విజయవంతంగా తొలగించబడింది" },
    "success.socialMedia.reordered": { en: "Social media links reordered successfully", hi: "सोशल मीडिया लिंक सफलतापूर्वक पुनः क्रमित किए गए", ta: "சமூக ஊடக இணைப்புகள் வெற்றிகரமாக மறுவரிசைப்படுத்தப்பட்டன", te: "సోషల్ మీడియా లింక్‌లు విజయవంతంగా పునఃక్రమబద్ధీకరించబడ్డాయి" },
    "success.upload.completed": { en: "File uploaded successfully", hi: "फ़ाइल सफलतापूर्वक अपलोड की गई", ta: "கோப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது", te: "ఫైల్ విజయవంతంగా అప్‌లోడ్ చేయబడింది" },
    "success.otp.sent": { en: "OTP sent to your email", hi: "OTP आपके ईमेल पर भेजा गया", ta: "OTP உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது", te: "OTP మీ ఇమెయిల్‌కు పంపబడింది" },
    "success.otp.verified": { en: "OTP verified successfully", hi: "OTP सफलतापूर्वक सत्यापित हुआ", ta: "OTP வெற்றிகரமாக சரிபார்க்கப்பட்டது", te: "OTP విజయవంతంగా ధృవీకరించబడింది" },
    "success.eventCancellation.initiated": { en: "Event cancellation initiated. Processing users in background.", hi: "इवेंट रद्दीकरण शुरू किया गया। पृष्ठभूमि में उपयोगकर्ताओं को संसाधित किया जा रहा है।", ta: "நிகழ்வு ரத்து தொடங்கப்பட்டது. பின்னணியில் பயனர்களை செயலாக்குகிறது.", te: "ఈవెంట్ రద్దు ప్రారంభించబడింది. వినియోగదారులను బ్యాక్‌గ్రౌండ్‌లో ప్రాసెస్ చేస్తోంది." },

    // Error messages
    "errors.policy.invalidFileType": { en: "Invalid file type. Only PDF, DOC, and DOCX are allowed.", hi: "अमान्य फ़ाइल प्रकार। केवल PDF, DOC और DOCX की अनुमति है।", ta: "தவறான கோப்பு வகை. PDF, DOC மற்றும் DOCX மட்டுமே அனுமதிக்கப்படும்.", te: "చెల్లని ఫైల్ రకం. PDF, DOC మరియు DOCX మాత్రమే అనుమతించబడతాయి." },
    "errors.upload.onlyImages": { en: "Only image files are allowed", hi: "केवल छवि फ़ाइलों की अनुमति है", ta: "பட கோப்புகள் மட்டுமே அனுமதிக்கப்படும்", te: "చిత్ర ఫైల్‌లు మాత్రమే అనుమతించబడతాయి" },
    "errors.razorpay.invalidSignature": { en: "Invalid signature", hi: "अमान्य हस्ताक्षर", ta: "தவறான கையொப்பம்", te: "చెల్లని సంతకం" },
    "errors.webhook.processingError": { en: "Internal processing error", hi: "आंतरिक प्रसंस्करण त्रुटि", ta: "உள் செயலாக்க பிழை", te: "అంతర్గత ప్రాసెసింగ్ లోపం" },
    "errors.account.adminCannotDelete": { en: "System admin accounts cannot be deleted. Please contact system support if you need to transfer ownership.", hi: "सिस्टम व्यवस्थापक खातों को हटाया नहीं जा सकता। कृपया स्वामित्व हस्तांतरित करने के लिए सिस्टम सपोर्ट से संपर्क करें।", ta: "கணினி நிர்வாகி கணக்குகளை நீக்க முடியாது. உரிமையை மாற்ற கணினி ஆதரவைத் தொடர்பு கொள்ளவும்.", te: "సిస్టమ్ అడ్మిన్ ఖాతాలను తొలగించడం సాధ్యం కాదు. యాజమాన్యాన్ని బదిలీ చేయడానికి సిస్టమ్ సపోర్ట్‌ను సంప్రదించండి." },
    "errors.account.legalReview": { en: "Your account is under legal review and cannot be deleted at this time. Please contact support.", hi: "आपका खाता कानूनी समीक्षा में है और इस समय हटाया नहीं जा सकता। कृपया सहायता से संपर्क करें।", ta: "உங்கள் கணக்கு சட்ட ஆய்வில் உள்ளது, தற்போது நீக்க முடியாது. ஆதரவைத் தொடர்பு கொள்ளவும்.", te: "మీ ఖాతా చట్టపరమైన సమీక్షలో ఉంది, ప్రస్తుతం తొలగించడం సాధ్యం కాదు. సపోర్ట్‌ను సంప్రదించండి." },
    "errors.account.verificationFailed": { en: "Failed to send verification code. Please try again.", hi: "सत्यापन कोड भेजने में विफल। कृपया पुनः प्रयास करें।", ta: "சரிபார்ப்புக் குறியீட்டை அனுப்ப இயலவில்லை. மீண்டும் முயற்சிக்கவும்.", te: "ధృవీకరణ కోడ్ పంపడం విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి." },
};

let phase4Count = 0;
for (const [key, translations] of Object.entries(backendNewKeys)) {
    for (const lang of ['en', 'hi', 'ta', 'te']) {
        setNestedKey(backendLocales[lang], key, translations[lang]);
        phase4Count++;
    }
}
console.log(`  Phase 4: Added ${phase4Count} backend i18n keys for hardcoded strings.\n`);

// ========== SAVE ALL FILES ==========
console.log('=== Saving all locale files ===\n');

for (const lang of ['en', 'hi', 'ta', 'te']) {
    const frontPath = path.join(FRONTEND_DIR, `${lang}.json`);
    saveJSON(frontPath, frontendLocales[lang]);
    console.log(`  ✅ Saved ${frontPath}`);

    const backPath = path.join(BACKEND_DIR, `${lang}.json`);
    saveJSON(backPath, backendLocales[lang]);
    console.log(`  ✅ Saved ${backPath}`);
}

console.log('\n✅ All locale files updated successfully!');
