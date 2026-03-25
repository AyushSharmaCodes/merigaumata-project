#!/usr/bin/env node
/**
 * Phase 5: Add new i18n keys introduced during hardcoded string replacement
 * Adds keys to all 4 frontend locale files (en, hi, ta, te)
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src/i18n/locales');

function setNestedKey(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    // Only set if key doesn't already exist
    if (current[parts[parts.length - 1]] === undefined) {
        current[parts[parts.length - 1]] = value;
        return true;
    }
    return false;
}

// New keys grouped by component/feature
const newKeys = {
    // AuthCallback
    'auth.authenticating': {
        en: 'Authenticating...',
        hi: 'प्रमाणित हो रहा है...',
        ta: 'அங்கீகரிக்கிறது...',
        te: 'ధృవీకరిస్తోంది...'
    },
    'auth.pleaseWait': {
        en: 'Please wait while we log you in.',
        hi: 'कृपया प्रतीक्षा करें, हम आपको लॉग इन कर रहे हैं।',
        ta: 'நாங்கள் உங்களை உள்நுழைய வைக்கும் வரை காத்திருங்கள்.',
        te: 'మేము మిమ్మల్ని లాగిన్ చేస్తున్నాము, దయచేసి వేచి ఉండండి.'
    },
    // OTPInput
    'auth.otp.resentSuccess': {
        en: 'OTP resent successfully',
        hi: 'OTP सफलतापूर्वक पुनः भेजा गया',
        ta: 'OTP வெற்றிகரமாக மீண்டும் அனுப்பப்பட்டது',
        te: 'OTP విజయవంతంగా మళ్ళీ పంపబడింది'
    },
    'auth.otp.resentFailed': {
        en: 'Failed to resend OTP',
        hi: 'OTP पुनः भेजने में विफल',
        ta: 'OTP மீண்டும் அனுப்ப இயலவில்லை',
        te: 'OTP మళ్ళీ పంపడం విఫలమైంది'
    },
    'auth.otp.expiresIn': {
        en: 'Code expires in',
        hi: 'कोड समाप्त होगा',
        ta: 'குறியீடு காலாவதியாகும்',
        te: 'కోడ్ ముగుస్తుంది'
    },
    'auth.otp.expired': {
        en: 'OTP expired',
        hi: 'OTP समाप्त हो गया',
        ta: 'OTP காலாவதியானது',
        te: 'OTP గడువు ముగిసింది'
    },
    'auth.otp.didntReceive': {
        en: "Didn't receive code?",
        hi: 'कोड प्राप्त नहीं हुआ?',
        ta: 'குறியீடு கிடைக்கவில்லையா?',
        te: 'కోడ్ అందలేదా?'
    },
    'auth.otp.sending': {
        en: 'Sending...',
        hi: 'भेज रहा है...',
        ta: 'அனுப்புகிறது...',
        te: 'పంపుతోంది...'
    },
    'auth.otp.resend': {
        en: 'Resend OTP',
        hi: 'OTP पुनः भेजें',
        ta: 'OTP மீண்டும் அனுப்பு',
        te: 'OTP మళ్ళీ పంపు'
    },
    'auth.otp.sentTo': {
        en: 'Sent to',
        hi: 'भेजा गया',
        ta: 'அனுப்பப்பட்டது',
        te: 'పంపబడింది'
    },
    // FolderImagesDialog
    'admin.gallery.addImagesToFolder': {
        en: 'Add Images to Folder',
        hi: 'फ़ोल्डर में चित्र जोड़ें',
        ta: 'கோப்புறையில் படங்களை சேர்க்கவும்',
        te: 'ఫోల్డర్‌కు చిత్రాలను జోడించండి'
    },
    'admin.gallery.uploadNewImages': {
        en: 'Upload New Images',
        hi: 'नई छवियाँ अपलोड करें',
        ta: 'புதிய படங்களை பதிவேற்றவும்',
        te: 'కొత్త చిత్రాలను అప్‌లోడ్ చేయండి'
    },
    'admin.gallery.noImagesYet': {
        en: 'No images in this folder yet',
        hi: 'इस फ़ोल्डर में अभी कोई चित्र नहीं है',
        ta: 'இந்த கோப்புறையில் இன்னும் படங்கள் இல்லை',
        te: 'ఈ ఫోల్డర్‌లో ఇంకా చిత్రాలు లేవు'
    },
    // PolicyPreviewDialog
    'admin.policy.noContentPreview': {
        en: 'No content available to preview.',
        hi: 'पूर्वावलोकन के लिए कोई सामग्री उपलब्ध नहीं है।',
        ta: 'முன்னோட்டத்திற்கு எந்த உள்ளடக்கமும் கிடைக்கவில்லை.',
        te: 'ప్రివ్యూ కోసం ఏ కంటెంట్ అందుబాటులో లేదు.'
    },
    'admin.policy.closePreview': {
        en: 'Close Preview',
        hi: 'पूर्वावलोकन बंद करें',
        ta: 'முன்னோட்டத்தை மூடு',
        te: 'ప్రివ్యూ మూసివేయండి'
    },
    // ProfileImageCropper
    'admin.profile.previewAlt': {
        en: 'Profile preview',
        hi: 'प्रोफ़ाइल पूर्वावलोकन',
        ta: 'சுயவிவர முன்னோட்டம்',
        te: 'ప్రొఫైల్ ప్రివ్యూ'
    },
    // ImageCropperModal
    'profile.updateProfilePicture': {
        en: 'Update Profile Picture',
        hi: 'प्रोफ़ाइल चित्र अपडेट करें',
        ta: 'சுயவிவர படத்தை புதுப்பிக்கவும்',
        te: 'ప్రొఫైల్ చిత్రాన్ని నవీకరించండి'
    },
    'profile.uploadAndCrop': {
        en: 'Upload and crop your profile picture. Recommended size: 400x400px',
        hi: 'अपनी प्रोफ़ाइल तस्वीर अपलोड और क्रॉप करें। अनुशंसित आकार: 400x400px',
        ta: 'உங்கள் சுயவிவர படத்தை பதிவேற்றம் செய்து வெட்டவும். பரிந்துரைக்கப்பட்ட அளவு: 400x400px',
        te: 'మీ ప్రొఫైల్ చిత్రాన్ని అప్‌లోడ్ చేసి కత్తిరించండి. సిఫార్సు చేసిన పరిమాణం: 400x400px'
    },
    'profile.dropImageHere': {
        en: 'Drop the image here',
        hi: 'छवि यहाँ छोड़ें',
        ta: 'படத்தை இங்கே விடுங்கள்',
        te: 'చిత్రాన్ని ఇక్కడ వదలండి'
    },
    'profile.dragAndDrop': {
        en: 'Drag and drop an image, or click to select',
        hi: 'एक छवि खींचें और छोड़ें, या चयन करने के लिए क्लिक करें',
        ta: 'ஒரு படத்தை இழுத்து விடுங்கள் அல்லது தேர்ந்தெடுக்க கிளிக் செய்யுங்கள்',
        te: 'చిత్రాన్ని లాగి వదలండి లేదా ఎంచుకోవడానికి క్లిక్ చేయండి'
    },
    'profile.supportedFormats': {
        en: 'Supports: JPG, PNG, WEBP (max 5MB)',
        hi: 'समर्थित: JPG, PNG, WEBP (अधिकतम 5MB)',
        ta: 'ஆதரிக்கப்படுவது: JPG, PNG, WEBP (அதிகபட்சம் 5MB)',
        te: 'మద్దతు: JPG, PNG, WEBP (గరిష్టంగా 5MB)'
    },
    'profile.zoom': {
        en: 'Zoom',
        hi: 'ज़ूम',
        ta: 'பெரிதாக்கு',
        te: 'జూమ్'
    },
    'profile.chooseDifferentImage': {
        en: 'Choose Different Image',
        hi: 'अलग छवि चुनें',
        ta: 'வேறு படத்தை தேர்ந்தெடுக்கவும்',
        te: 'వేరే చిత్రాన్ని ఎంచుకోండి'
    },
    'profile.deleteCurrentPicture': {
        en: 'Delete Current Picture',
        hi: 'वर्तमान चित्र हटाएं',
        ta: 'தற்போதைய படத்தை நீக்கு',
        te: 'ప్రస్తుత చిత్రాన్ని తొలగించండి'
    },
    'profile.savePicture': {
        en: 'Save Picture',
        hi: 'चित्र सहेजें',
        ta: 'படத்தை சேமிக்கவும்',
        te: 'చిత్రాన్ని సేవ్ చేయండి'
    },
    // EventsManagement
    'admin.events.management.tooltips.retry': {
        en: 'Retry failed job',
        hi: 'विफल कार्य पुनः प्रयास करें',
        ta: 'தோல்வியடைந்த பணியை மீண்டும் முயற்சிக்கவும்',
        te: 'విఫలమైన పనిని మళ్ళీ ప్రయత్నించండి'
    },
    // UpdatePasswordDialog
    'profile.personalInfo.passwordUpdate.securityVeil': {
        en: 'Security Veil',
        hi: 'सुरक्षा पर्दा',
        ta: 'பாதுகாப்பு திரை',
        te: 'భద్రతా తెర'
    },
    'profile.personalInfo.passwordUpdate.validationRequired': {
        en: 'Validation Required',
        hi: 'सत्यापन आवश्यक',
        ta: 'சரிபார்ப்பு தேவை',
        te: 'ధృవీకరణ అవసరం'
    },
};

// Load locale files
const locales = ['en', 'hi', 'ta', 'te'];
const localeData = {};

for (const locale of locales) {
    const filePath = path.join(FRONTEND_DIR, `${locale}.json`);
    localeData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Add all new keys
let addedCount = 0;
for (const [keyPath, translations] of Object.entries(newKeys)) {
    for (const locale of locales) {
        const value = translations[locale];
        if (value && setNestedKey(localeData[locale], keyPath, value)) {
            addedCount++;
            console.log(`  Added ${locale}: ${keyPath}`);
        }
    }
}

// Save locale files
for (const locale of locales) {
    const filePath = path.join(FRONTEND_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(localeData[locale], null, 2) + '\n', 'utf8');
}

console.log(`\nDone! Added ${addedCount} new keys across ${locales.length} locale files.`);
