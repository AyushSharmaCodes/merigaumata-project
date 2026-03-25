#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FRONTEND_LOCALES_DIR = path.join(ROOT, "frontend/src/i18n/locales");
const BACKEND_LOCALES_DIR = path.join(ROOT, "backend/locales");
const SOURCE_DIRS = [path.join(ROOT, "frontend/src"), path.join(ROOT, "backend")];
const LOCALES = ["en", "hi", "ta", "te"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "coverage"]);
const JUNK_TOP_LEVEL_KEYS = new Set([
  "canvas",
  "2d",
  ":",
  ",",
  "axios",
  "authRefreshLock",
  "auth:session-expired",
  "a",
  "token",
  "ji",
  "there",
]);

const MANUAL_VALUES = {
  en: {
    "admin.backgroundJobs.dialog.emailType": "Email Type",
    "admin.backgroundJobs.dialog.recipient": "Recipient",
    "admin.backgroundJobs.dialog.retryCount": "Retry count",
    "admin.backgroundJobs.toasts.invoiceTriggerSuccess": "Invoice regeneration triggered successfully",
    "admin.backgroundJobs.toasts.sweepSuccess": "Orphan sweep completed",
    "admin.backgroundJobs.types.emailNotification": "Email Notification",
    "admin.delivery.validation.chargeNonNegative": "Delivery charge cannot be negative",
    "admin.delivery.validation.itemsPerPackageMin": "Items per package must be at least 1",
    "admin.delivery.validation.weightPositive": "Unit weight must be greater than 0",
    "admin.managers.dialog.validation.emailRequired": "Email is required",
    "admin.managers.dialog.validation.fixErrors": "Please correct the highlighted fields before continuing.",
    "admin.managers.dialog.validation.nameRequired": "Name is required",
    "admin.orders.stats.total": "Total Orders",
    "admin.orders.stats.new": "New Orders",
    "admin.orders.stats.processing": "Orders in Process",
    "admin.orders.stats.cancelled": "Cancelled Orders",
    "admin.orders.stats.returned": "Partial | Full Returned Orders",
    "admin.orders.stats.returnRequested": "Return Requests",
    "admin.orders.stats.failed": "Failed Orders",
    "admin.orders.status.returnPickedUp": "Return Picked Up",
    "admin.products.variants.descriptionPlaceholderBullets": "• Feature 1\n• Feature 2",
    "admin.settings.delivery.saveSuccess": "Delivery settings saved successfully",
    "admin.users.dialog.createSuccess": "Admin user created successfully",
    "admin.users.dialog.requiredFields": "Please fill in all required fields",
    "auth.enterVerificationCodeTitle": "Enter verification code",
    "auth.loginOtpDescription": "We sent a 6-digit code to your email or phone",
    "auth.otpResentTo": "OTP has been resent to {{target}}",
    "auth.otpVerifiedSuccess": "OTP verified successfully",
    "auth.reactivation.dialogDescription": "Your account is currently scheduled to be permanently deleted on",
    "auth.reactivation.dialogHelp": "You can recover your account now and continue using it, or log out if you still wish to proceed with the deletion.",
    "auth.reactivation.dialogTitle": "Account scheduled for deletion",
    "auth.reactivation.errorTitle": "Failed to recover account",
    "auth.reactivation.logout": "Logout",
    "auth.reactivation.successDescription": "Your account deletion has been cancelled successfully.",
    "auth.reactivation.successTitle": "Welcome back!",
    "auth.reactivation.undoDeletion": "Undo deletion",
    "auth.registrationVerifiedSuccess": "Registration verified!",
    "auth.resetPasswordOtpDescription": "We sent a 6-digit code to reset your password",
    "auth.verificationFailed": "Verification failed",
    "auth.verifyAccountOtpDescription": "We sent a 6-digit code to verify your account",
    "auth.verifyAccountTitle": "Verify your account",
    "donation.validation.emailRequired": "Email is required",
    "donation.validation.fixDetails": "Please correct the highlighted details before continuing.",
    "donation.validation.fullNameRequired": "Full name is required",
    "donation.validation.phoneRequired": "Phone number is required",
    "errors.location.loadFailed": "Failed to load locations",
    "errors.auth.emailNotConfirmed": "Please verify your email before logging in.",
    "errors.auth.otpRateLimit": "Too many OTP requests. Please try again later.",
    "errors.rateLimit.commentPosting": "You are posting too fast. Please wait {{minutes}} minutes before posting again.",
    "errors.rateLimit.contactForm": "Too many messages sent from this IP, please try again after an hour",
    "errors.rateLimit.phoneValidation": "You are attempting to validate phone numbers too frequently. Please try again in 10 minutes.",
    "errors.order.statusChanged": "Order status has changed. Please refresh and try again.",
    "errors.upload.imagesOnly": "Only image files are allowed",
    "errors.upload.invalidPolicyFileType": "Invalid file type. Only PDF, DOC, and DOCX are allowed.",
    "errors.validation.phoneRequired": "Phone number is required",
    "events.registration.backToEvent": "Back to Event",
    "events.registration.eventFull": "This event is fully booked",
    "events.registration.eventFullDesc": "All available slots have been filled. Please check back later as slots may open up if cancellations occur.",
    "orderSummary.legacyFlowUnavailable": "This payment screen is no longer available. Please complete checkout from the current checkout page.",
    "orders.invoice.billOfSupply": "Bill of supply",
    "orders.invoice.generateError": "Failed to generate invoice",
    "orders.invoice.generatedSuccess": "{{invoiceType}} generated successfully!",
    "orders.invoice.gstInvoice": "GST invoice",
    "paymentStatus.processedNotice": "(Refunds are typically processed within 5-7 business days)",
    "profile.personalInfo.bioAndOtherDetails": "Bio & other details",
    "admin.orders.detail.paymentInfo.invoiceUnavailable": "Invoice link is unavailable.",
    "success.jobs.emailRetryTriggered": "Email retry triggered successfully",
    "validation.phone.required": "Phone number is required",
  },
  hi: {
    "admin.backgroundJobs.dialog.emailType": "ईमेल प्रकार",
    "admin.backgroundJobs.dialog.recipient": "प्राप्तकर्ता",
    "admin.backgroundJobs.dialog.retryCount": "पुनः प्रयास संख्या",
    "admin.backgroundJobs.types.emailNotification": "ईमेल सूचना",
    "admin.delivery.validation.chargeNonNegative": "डिलीवरी शुल्क नकारात्मक नहीं हो सकता",
    "admin.delivery.validation.itemsPerPackageMin": "प्रति पैकेज आइटम कम से कम 1 होना चाहिए",
    "admin.delivery.validation.weightPositive": "इकाई वजन 0 से अधिक होना चाहिए",
    "admin.managers.dialog.validation.emailRequired": "ईमेल आवश्यक है",
    "admin.managers.dialog.validation.fixErrors": "कृपया आगे बढ़ने से पहले हाइलाइट की गई त्रुटियों को ठीक करें।",
    "admin.managers.dialog.validation.nameRequired": "नाम आवश्यक है",
    "admin.orders.stats.total": "कुल ऑर्डर",
    "admin.orders.stats.new": "नए ऑर्डर",
    "admin.orders.stats.processing": "प्रक्रिया में ऑर्डर",
    "admin.orders.stats.cancelled": "रद्द किए गए ऑर्डर",
    "admin.orders.stats.returned": "आंशिक | पूर्ण लौटाए गए ऑर्डर",
    "admin.orders.stats.returnRequested": "रिटर्न अनुरोध",
    "admin.orders.stats.failed": "विफल ऑर्डर",
    "admin.orders.status.returnPickedUp": "रिटर्न पिक अप",
    "admin.products.variants.descriptionPlaceholderBullets": "• विशेषता 1\n• विशेषता 2",
    "admin.settings.delivery.saveSuccess": "डिलीवरी सेटिंग्स सफलतापूर्वक सहेजी गईं",
    "admin.users.dialog.createSuccess": "एडमिन उपयोगकर्ता सफलतापूर्वक बनाया गया",
    "admin.users.dialog.requiredFields": "कृपया सभी आवश्यक फ़ील्ड भरें",
    "auth.enterVerificationCodeTitle": "सत्यापन कोड दर्ज करें",
    "auth.loginOtpDescription": "हमने आपके ईमेल या फ़ोन पर 6 अंकों का कोड भेजा है",
    "auth.otpResentTo": "OTP {{target}} पर फिर से भेज दिया गया है",
    "auth.otpVerifiedSuccess": "OTP सफलतापूर्वक सत्यापित हुआ",
    "auth.reactivation.dialogDescription": "आपका खाता स्थायी रूप से हटाने के लिए निर्धारित है",
    "auth.reactivation.dialogHelp": "आप अभी अपना खाता पुनर्प्राप्त कर सकते हैं और उसका उपयोग जारी रख सकते हैं, या यदि आप हटाना जारी रखना चाहते हैं तो लॉग आउट कर सकते हैं।",
    "auth.reactivation.dialogTitle": "खाता हटाने के लिए निर्धारित है",
    "auth.reactivation.errorTitle": "खाता पुनर्प्राप्त करने में विफल",
    "auth.reactivation.logout": "लॉग आउट",
    "auth.reactivation.successDescription": "आपके खाते का हटाना सफलतापूर्वक रद्द कर दिया गया है।",
    "auth.reactivation.successTitle": "वापसी पर स्वागत है!",
    "auth.reactivation.undoDeletion": "हटाना रद्द करें",
    "auth.registrationVerifiedSuccess": "पंजीकरण सत्यापित हो गया!",
    "auth.resetPasswordOtpDescription": "हमने आपका पासवर्ड रीसेट करने के लिए 6 अंकों का कोड भेजा है",
    "auth.verificationFailed": "सत्यापन विफल",
    "auth.verifyAccountOtpDescription": "हमने आपका खाता सत्यापित करने के लिए 6 अंकों का कोड भेजा है",
    "auth.verifyAccountTitle": "अपने खाते को सत्यापित करें",
    "donation.validation.emailRequired": "ईमेल आवश्यक है",
    "donation.validation.fixDetails": "कृपया आगे बढ़ने से पहले हाइलाइट किए गए विवरण ठीक करें।",
    "donation.validation.fullNameRequired": "पूरा नाम आवश्यक है",
    "donation.validation.phoneRequired": "फ़ोन नंबर आवश्यक है",
    "errors.auth.emailNotConfirmed": "लॉगिन करने से पहले कृपया अपना ईमेल सत्यापित करें।",
    "errors.auth.otpRateLimit": "बहुत अधिक OTP अनुरोध किए गए हैं। कृपया बाद में पुनः प्रयास करें।",
    "errors.location.loadFailed": "स्थान लोड करने में विफल",
    "errors.rateLimit.commentPosting": "आप बहुत तेजी से पोस्ट कर रहे हैं। कृपया दोबारा पोस्ट करने से पहले {{minutes}} मिनट प्रतीक्षा करें।",
    "errors.rateLimit.contactForm": "इस IP से बहुत अधिक संदेश भेजे गए हैं, कृपया एक घंटे बाद पुनः प्रयास करें",
    "errors.rateLimit.phoneValidation": "आप बहुत अधिक बार फ़ोन नंबर सत्यापित करने का प्रयास कर रहे हैं। कृपया 10 मिनट बाद पुनः प्रयास करें।",
    "errors.order.statusChanged": "ऑर्डर की स्थिति बदल गई है। कृपया पेज रिफ्रेश करके फिर से प्रयास करें।",
    "errors.upload.imagesOnly": "केवल इमेज फ़ाइलें ही अनुमत हैं",
    "errors.upload.invalidPolicyFileType": "अमान्य फ़ाइल प्रकार। केवल PDF, DOC और DOCX की अनुमति है।",
    "errors.validation.phoneRequired": "फ़ोन नंबर आवश्यक है",
    "events.registration.backToEvent": "कार्यक्रम पर वापस जाएं",
    "events.registration.eventFull": "यह कार्यक्रम पूरी तरह भर चुका है",
    "events.registration.eventFullDesc": "सभी उपलब्ध स्लॉट भर चुके हैं। कृपया बाद में फिर देखें, क्योंकि रद्दीकरण होने पर स्लॉट खुल सकते हैं।",
    "orderSummary.legacyFlowUnavailable": "यह भुगतान स्क्रीन अब उपलब्ध नहीं है। कृपया वर्तमान चेकआउट पेज से चेकआउट पूरा करें।",
    "orders.invoice.billOfSupply": "बिल ऑफ सप्लाई",
    "orders.invoice.generateError": "इनवॉइस जनरेट करने में विफल",
    "orders.invoice.generatedSuccess": "{{invoiceType}} सफलतापूर्वक जनरेट हो गया!",
    "orders.invoice.gstInvoice": "GST इनवॉइस",
    "paymentStatus.processedNotice": "(धनवापसी आमतौर पर 5-7 कार्य दिवसों के भीतर संसाधित की जाती है)",
    "profile.personalInfo.bioAndOtherDetails": "बायो और अन्य विवरण",
    "admin.orders.detail.paymentInfo.invoiceUnavailable": "इनवॉइस लिंक उपलब्ध नहीं है।",
    "success.jobs.emailRetryTriggered": "ईमेल पुनः प्रयास सफलतापूर्वक ट्रिगर किया गया",
    "validation.phone.required": "फ़ोन नंबर आवश्यक है",
  },
  ta: {
    "admin.backgroundJobs.dialog.emailType": "மின்னஞ்சல் வகை",
    "admin.backgroundJobs.dialog.recipient": "பெறுநர்",
    "admin.backgroundJobs.dialog.retryCount": "மீண்டும் முயற்சி எண்ணிக்கை",
    "admin.backgroundJobs.types.emailNotification": "மின்னஞ்சல் அறிவிப்பு",
    "admin.delivery.validation.chargeNonNegative": "டெலிவரி கட்டணம் எதிர்மறையாக இருக்க முடியாது",
    "admin.delivery.validation.itemsPerPackageMin": "ஒரு பொதியில் குறைந்தது 1 பொருள் இருக்க வேண்டும்",
    "admin.delivery.validation.weightPositive": "அலகு எடை 0-ஐ விட அதிகமாக இருக்க வேண்டும்",
    "admin.managers.dialog.validation.emailRequired": "மின்னஞ்சல் அவசியம்",
    "admin.managers.dialog.validation.fixErrors": "தொடர்வதற்கு முன் குறிக்கப்பட்ட பிழைகளைச் சரிசெய்யவும்.",
    "admin.managers.dialog.validation.nameRequired": "பெயர் அவசியம்",
    "admin.orders.stats.total": "மொத்த ஆர்டர்கள்",
    "admin.orders.stats.new": "புதிய ஆர்டர்கள்",
    "admin.orders.stats.processing": "செயல்முறையில் உள்ள ஆர்டர்கள்",
    "admin.orders.stats.cancelled": "ரத்து செய்யப்பட்ட ஆர்டர்கள்",
    "admin.orders.stats.returned": "பகுதி | முழுமையாக திரும்பிய ஆர்டர்கள்",
    "admin.orders.stats.returnRequested": "திரும்பப்பெறும் கோரிக்கைகள்",
    "admin.orders.stats.failed": "தோல்வியடைந்த ஆர்டர்கள்",
    "admin.orders.status.returnPickedUp": "திரும்பப் பெறுதல் எடுக்கப்பட்டது",
    "admin.products.variants.descriptionPlaceholderBullets": "• அம்சம் 1\n• அம்சம் 2",
    "admin.settings.delivery.saveSuccess": "டெலிவரி அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன",
    "admin.users.dialog.createSuccess": "அட்மின் பயனர் வெற்றிகரமாக உருவாக்கப்பட்டார்",
    "admin.users.dialog.requiredFields": "தேவையான அனைத்து புலங்களையும் நிரப்பவும்",
    "auth.enterVerificationCodeTitle": "சரிபார்ப்பு குறியீட்டை உள்ளிடவும்",
    "auth.loginOtpDescription": "உங்கள் மின்னஞ்சல் அல்லது தொலைபேசிக்கு 6 இலக்க குறியீட்டை அனுப்பியுள்ளோம்",
    "auth.otpResentTo": "OTP மீண்டும் {{target}}-க்கு அனுப்பப்பட்டது",
    "auth.otpVerifiedSuccess": "OTP வெற்றிகரமாக சரிபார்க்கப்பட்டது",
    "auth.reactivation.dialogDescription": "உங்கள் கணக்கு நிரந்தரமாக நீக்கப்படுவதற்காக திட்டமிடப்பட்டுள்ளது",
    "auth.reactivation.dialogHelp": "நீங்கள் இப்போது உங்கள் கணக்கை மீட்டெடுத்து பயன்படுத்தத் தொடரலாம், அல்லது நீக்கலைத் தொடர விரும்பினால் வெளியேறலாம்.",
    "auth.reactivation.dialogTitle": "நீக்கத்திற்காக திட்டமிடப்பட்ட கணக்கு",
    "auth.reactivation.errorTitle": "கணக்கை மீட்டெடுக்க முடியவில்லை",
    "auth.reactivation.logout": "வெளியேறு",
    "auth.reactivation.successDescription": "உங்கள் கணக்கு நீக்கம் வெற்றிகரமாக ரத்து செய்யப்பட்டது.",
    "auth.reactivation.successTitle": "மீண்டும் வரவேற்கிறோம்!",
    "auth.reactivation.undoDeletion": "நீக்கத்தை ரத்து செய்",
    "auth.registrationVerifiedSuccess": "பதிவு சரிபார்க்கப்பட்டது!",
    "auth.resetPasswordOtpDescription": "உங்கள் கடவுச்சொல்லை மீட்டமைக்க 6 இலக்க குறியீட்டை அனுப்பியுள்ளோம்",
    "auth.verificationFailed": "சரிபார்ப்பு தோல்வியடைந்தது",
    "auth.verifyAccountOtpDescription": "உங்கள் கணக்கை சரிபார்க்க 6 இலக்க குறியீட்டை அனுப்பியுள்ளோம்",
    "auth.verifyAccountTitle": "உங்கள் கணக்கை சரிபார்க்கவும்",
    "donation.validation.emailRequired": "மின்னஞ்சல் அவசியம்",
    "donation.validation.fixDetails": "தொடர்வதற்கு முன் குறிப்பிடப்பட்ட விவரங்களைச் சரிசெய்யவும்.",
    "donation.validation.fullNameRequired": "முழுப்பெயர் அவசியம்",
    "donation.validation.phoneRequired": "தொலைபேசி எண் அவசியம்",
    "errors.auth.emailNotConfirmed": "உள்நுழைவதற்கு முன் உங்கள் மின்னஞ்சலை சரிபார்க்கவும்.",
    "errors.auth.otpRateLimit": "மிக அதிகமான OTP கோரிக்கைகள் செய்யப்பட்டுள்ளன. தயவுசெய்து பிறகு மீண்டும் முயற்சிக்கவும்.",
    "errors.location.loadFailed": "இடங்களை ஏற்ற முடியவில்லை",
    "errors.rateLimit.commentPosting": "நீங்கள் மிகவும் விரைவாக பதிவிடுகிறீர்கள். மீண்டும் பதிவிடுவதற்கு முன் {{minutes}} நிமிடங்கள் காத்திருக்கவும்.",
    "errors.rateLimit.contactForm": "இந்த IP இலிருந்து மிக அதிகமான செய்திகள் அனுப்பப்பட்டுள்ளன, தயவுசெய்து ஒரு மணி நேரத்திற்கு பிறகு மீண்டும் முயற்சிக்கவும்",
    "errors.rateLimit.phoneValidation": "நீங்கள் தொலைபேசி எண்களை மிகவும் அடிக்கடி சரிபார்க்க முயற்சிக்கிறீர்கள். தயவுசெய்து 10 நிமிடங்களில் மீண்டும் முயற்சிக்கவும்.",
    "errors.order.statusChanged": "ஆர்டர் நிலை மாற்றப்பட்டுள்ளது. தயவுசெய்து பக்கத்தை புதுப்பித்து மீண்டும் முயற்சிக்கவும்.",
    "errors.upload.imagesOnly": "படக் கோப்புகள் மட்டுமே அனுமதிக்கப்படுகின்றன",
    "errors.upload.invalidPolicyFileType": "தவறான கோப்பு வகை. PDF, DOC, மற்றும் DOCX மட்டுமே அனுமதிக்கப்படுகின்றன.",
    "errors.validation.phoneRequired": "தொலைபேசி எண் அவசியம்",
    "events.registration.backToEvent": "நிகழ்விற்கு திரும்பு",
    "events.registration.eventFull": "இந்த நிகழ்வு முழுமையாக நிரம்பியுள்ளது",
    "events.registration.eventFullDesc": "அனைத்து இடங்களும் நிரம்பியுள்ளன. ரத்துசெய்தல் ஏற்பட்டால் இடங்கள் திறக்கப்படலாம், எனவே பின்னர் மீண்டும் பார்க்கவும்.",
    "orderSummary.legacyFlowUnavailable": "இந்த கட்டண திரை இனி கிடைக்காது. தற்போதைய செக்அவுட் பக்கத்திலிருந்து செக்அவுட்டை முடிக்கவும்.",
    "orders.invoice.billOfSupply": "வழங்கல் பில்",
    "orders.invoice.generateError": "விலைப்பட்டியலை உருவாக்க முடியவில்லை",
    "orders.invoice.generatedSuccess": "{{invoiceType}} வெற்றிகரமாக உருவாக்கப்பட்டது!",
    "orders.invoice.gstInvoice": "GST விலைப்பட்டியல்",
    "paymentStatus.processedNotice": "(பணத்தைத் திரும்பப்பெறுதல் பொதுவாக 5-7 வேலை நாட்களில் செயல்படுத்தப்படும்)",
    "profile.personalInfo.bioAndOtherDetails": "சுயவிவரம் மற்றும் பிற விவரங்கள்",
    "admin.orders.detail.paymentInfo.invoiceUnavailable": "விலைப்பட்டியல் இணைப்பு கிடைக்கவில்லை.",
    "success.jobs.emailRetryTriggered": "மின்னஞ்சல் மீண்டும் முயற்சி வெற்றிகரமாக தொடங்கப்பட்டது",
    "validation.phone.required": "தொலைபேசி எண் அவசியம்",
  },
  te: {
    "admin.backgroundJobs.dialog.emailType": "ఇమెయిల్ రకం",
    "admin.backgroundJobs.dialog.recipient": "గ్రహీత",
    "admin.backgroundJobs.dialog.retryCount": "మళ్లీ ప్రయత్నించిన సంఖ్య",
    "admin.backgroundJobs.types.emailNotification": "ఇమెయిల్ నోటిఫికేషన్",
    "admin.delivery.validation.chargeNonNegative": "డెలివరీ ఛార్జ్ ప్రతికూలంగా ఉండకూడదు",
    "admin.delivery.validation.itemsPerPackageMin": "ఒక ప్యాకేజీలో కనీసం 1 అంశం ఉండాలి",
    "admin.delivery.validation.weightPositive": "యూనిట్ బరువు 0 కంటే ఎక్కువగా ఉండాలి",
    "admin.managers.dialog.validation.emailRequired": "ఇమెయిల్ అవసరం",
    "admin.managers.dialog.validation.fixErrors": "కొనసాగించే ముందు హైలైట్ చేసిన లోపాలను సరిచేయండి.",
    "admin.managers.dialog.validation.nameRequired": "పేరు అవసరం",
    "admin.orders.stats.total": "మొత్తం ఆర్డర్లు",
    "admin.orders.stats.new": "కొత్త ఆర్డర్లు",
    "admin.orders.stats.processing": "ప్రాసెస్‌లో ఉన్న ఆర్డర్లు",
    "admin.orders.stats.cancelled": "రద్దు చేసిన ఆర్డర్లు",
    "admin.orders.stats.returned": "భాగిక | పూర్తిగా తిరిగి వచ్చిన ఆర్డర్లు",
    "admin.orders.stats.returnRequested": "రిటర్న్ అభ్యర్థనలు",
    "admin.orders.stats.failed": "విఫలమైన ఆర్డర్లు",
    "admin.orders.status.returnPickedUp": "రిటర్న్ పిక్ అప్ చేయబడింది",
    "admin.products.variants.descriptionPlaceholderBullets": "• లక్షణం 1\n• లక్షణం 2",
    "admin.settings.delivery.saveSuccess": "డెలివరీ సెట్టింగ్‌లు విజయవంతంగా సేవ్ చేయబడ్డాయి",
    "admin.users.dialog.createSuccess": "అడ్మిన్ వినియోగదారు విజయవంతంగా సృష్టించబడ్డారు",
    "admin.users.dialog.requiredFields": "దయచేసి అవసరమైన అన్ని ఫీల్డ్‌లను పూరించండి",
    "auth.enterVerificationCodeTitle": "ధృవీకరణ కోడ్‌ను నమోదు చేయండి",
    "auth.loginOtpDescription": "మీ ఇమెయిల్ లేదా ఫోన్‌కు 6 అంకెల కోడ్‌ను పంపాము",
    "auth.otpResentTo": "OTP మళ్లీ {{target}} కు పంపబడింది",
    "auth.otpVerifiedSuccess": "OTP విజయవంతంగా ధృవీకరించబడింది",
    "auth.reactivation.dialogDescription": "మీ ఖాతా శాశ్వతంగా తొలగించబడేందుకు షెడ్యూల్ చేయబడింది",
    "auth.reactivation.dialogHelp": "మీరు ఇప్పుడు మీ ఖాతాను తిరిగి పొందుకొని ఉపయోగించడం కొనసాగించవచ్చు, లేదా తొలగింపును కొనసాగించాలని అనుకుంటే లాగ్ అవుట్ కావచ్చు.",
    "auth.reactivation.dialogTitle": "తొలగింపుకు షెడ్యూల్ చేసిన ఖాతా",
    "auth.reactivation.errorTitle": "ఖాతాను తిరిగి పొందడంలో విఫలమైంది",
    "auth.reactivation.logout": "లాగ్ అవుట్",
    "auth.reactivation.successDescription": "మీ ఖాతా తొలగింపు విజయవంతంగా రద్దు చేయబడింది.",
    "auth.reactivation.successTitle": "మళ్లీ స్వాగతం!",
    "auth.reactivation.undoDeletion": "తొలగింపును రద్దు చేయండి",
    "auth.registrationVerifiedSuccess": "నమోదు ధృవీకరించబడింది!",
    "auth.resetPasswordOtpDescription": "మీ పాస్‌వర్డ్‌ను రీసెట్ చేయడానికి 6 అంకెల కోడ్‌ను పంపాము",
    "auth.verificationFailed": "ధృవీకరణ విఫలమైంది",
    "auth.verifyAccountOtpDescription": "మీ ఖాతాను ధృవీకరించడానికి 6 అంకెల కోడ్‌ను పంపాము",
    "auth.verifyAccountTitle": "మీ ఖాతాను ధృవీకరించండి",
    "donation.validation.emailRequired": "ఇమెయిల్ అవసరం",
    "donation.validation.fixDetails": "కొనసాగించే ముందు హైలైట్ చేసిన వివరాలను సరిచేయండి.",
    "donation.validation.fullNameRequired": "పూర్తి పేరు అవసరం",
    "donation.validation.phoneRequired": "ఫోన్ నంబర్ అవసరం",
    "errors.auth.emailNotConfirmed": "లాగిన్ చేయడానికి ముందు దయచేసి మీ ఇమెయిల్‌ను ధృవీకరించండి.",
    "errors.auth.otpRateLimit": "చాలా ఎక్కువ OTP అభ్యర్థనలు చేయబడ్డాయి. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి.",
    "errors.location.loadFailed": "లొకేషన్‌లను లోడ్ చేయడంలో విఫలమైంది",
    "errors.rateLimit.commentPosting": "మీరు చాలా వేగంగా పోస్ట్ చేస్తున్నారు. మళ్లీ పోస్ట్ చేయడానికి ముందు దయచేసి {{minutes}} నిమిషాలు వేచి ఉండండి.",
    "errors.rateLimit.contactForm": "ఈ IP నుండి చాలా సందేశాలు పంపబడ్డాయి, దయచేసి ఒక గంట తర్వాత మళ్లీ ప్రయత్నించండి",
    "errors.rateLimit.phoneValidation": "మీరు ఫోన్ నంబర్లను చాలా తరచుగా ధృవీకరించడానికి ప్రయత్నిస్తున్నారు. దయచేసి 10 నిమిషాల తర్వాత మళ్లీ ప్రయత్నించండి.",
    "errors.order.statusChanged": "ఆర్డర్ స్థితి మారింది. దయచేసి పేజీని రిఫ్రెష్ చేసి మళ్లీ ప్రయత్నించండి.",
    "errors.upload.imagesOnly": "చిత్ర ఫైల్‌లు మాత్రమే అనుమతించబడతాయి",
    "errors.upload.invalidPolicyFileType": "చెల్లని ఫైల్ రకం. PDF, DOC మరియు DOCX మాత్రమే అనుమతించబడతాయి.",
    "errors.validation.phoneRequired": "ఫోన్ నంబర్ అవసరం",
    "events.registration.backToEvent": "ఈవెంట్‌కు తిరిగి వెళ్ళు",
    "events.registration.eventFull": "ఈ ఈవెంట్ పూర్తిగా నిండి ఉంది",
    "events.registration.eventFullDesc": "అన్ని అందుబాటులో ఉన్న స్లాట్‌లు నిండి ఉన్నాయి. రద్దులు జరిగితే స్లాట్‌లు మళ్లీ ఖాళీ కావచ్చు, కాబట్టి తరువాత మళ్లీ చూడండి.",
    "orderSummary.legacyFlowUnavailable": "ఈ చెల్లింపు స్క్రీన్ ఇక అందుబాటులో లేదు. దయచేసి ప్రస్తుత చెకౌట్ పేజీ నుండి చెకౌట్ పూర్తి చేయండి.",
    "orders.invoice.billOfSupply": "బిల్ ఆఫ్ సప్లై",
    "orders.invoice.generateError": "ఇన్‌వాయిస్‌ను సృష్టించడంలో విఫలమైంది",
    "orders.invoice.generatedSuccess": "{{invoiceType}} విజయవంతంగా సృష్టించబడింది!",
    "orders.invoice.gstInvoice": "GST ఇన్‌వాయిస్",
    "paymentStatus.processedNotice": "(రీఫండ్‌లు సాధారణంగా 5-7 పని దినాలలో ప్రాసెస్ చేయబడతాయి)",
    "profile.personalInfo.bioAndOtherDetails": "బయో మరియు ఇతర వివరాలు",
    "admin.orders.detail.paymentInfo.invoiceUnavailable": "ఇన్‌వాయిస్ లింక్ అందుబాటులో లేదు.",
    "success.jobs.emailRetryTriggered": "ఇమెయిల్ రీట్రై విజయవంతంగా ట్రిగ్గర్ చేయబడింది",
    "validation.phone.required": "ఫోన్ నంబర్ అవసరం",
  },
};

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, override) {
  const result = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(result[key]) && isPlainObject(value)) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }
  return result;
}

function setNestedValue(obj, keyPath, value) {
  const parts = keyPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!isPlainObject(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function getNestedValue(obj, keyPath) {
  const parts = keyPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function deleteJunkTopLevelKeys(obj) {
  for (const key of JUNK_TOP_LEVEL_KEYS) {
    delete obj[key];
  }
}

function recursivelySort(value) {
  if (Array.isArray(value)) {
    return value.map(recursivelySort);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = recursivelySort(value[key]);
      return acc;
    }, {});
}

function pruneToSchema(value, schema) {
  if (Array.isArray(schema)) {
    return Array.isArray(value) ? value : clone(schema);
  }
  if (!isPlainObject(schema)) {
    return value === undefined ? schema : value;
  }

  const result = {};
  for (const key of Object.keys(schema)) {
    result[key] = pruneToSchema(value ? value[key] : undefined, schema[key]);
  }
  return result;
}

function collectSourceFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, result);
      continue;
    }
    if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

function extractUsedKeys() {
  const files = SOURCE_DIRS.flatMap((dir) => collectSourceFiles(dir));
  const patterns = [
    /(?:^|[^\w])t\(\s*['"]([^'"]+)['"]/g,
    /(?:^|[^\w])translate\(\s*['"]([^'"]+)['"]/g,
  ];
  const usage = new Map();

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const key = match[1];
        if (!key || key === "status.") {
          continue;
        }
        if (!usage.has(key)) {
          usage.set(key, []);
        }
        const refs = usage.get(key);
        if (refs.length < 5) {
          refs.push(path.relative(ROOT, filePath));
        }
      }
    }
  }

  return usage;
}

function keyExistsWithPluralSupport(obj, keyPath) {
  if (getNestedValue(obj, keyPath) !== undefined) {
    return true;
  }
  return (
    getNestedValue(obj, `${keyPath}_one`) !== undefined ||
    getNestedValue(obj, `${keyPath}_other`) !== undefined
  );
}

function flattenStrings(value, prefix = "", result = {}) {
  if (Array.isArray(value)) {
    result[prefix] = value;
    return result;
  }
  if (!isPlainObject(value)) {
    result[prefix] = value;
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenStrings(child, nextPrefix, result);
  }
  return result;
}

function findPlaceholderValues(obj, lang) {
  const flat = flattenStrings(obj);
  return Object.entries(flat)
    .filter(([, value]) => typeof value === "string" && value.includes("[MISSING_TRANSLATION]"))
    .map(([key, value]) => `${lang}:${key}=${value}`);
}

function writeLocalePair(lang, data) {
  const json = `${JSON.stringify(recursivelySort(data), null, 2)}\n`;
  fs.writeFileSync(path.join(FRONTEND_LOCALES_DIR, `${lang}.json`), json, "utf8");
  fs.writeFileSync(path.join(BACKEND_LOCALES_DIR, `${lang}.json`), json, "utf8");
}

function buildLocale(lang) {
  const backend = loadJson(path.join(BACKEND_LOCALES_DIR, `${lang}.json`));
  const frontend = loadJson(path.join(FRONTEND_LOCALES_DIR, `${lang}.json`));

  deleteJunkTopLevelKeys(backend);
  deleteJunkTopLevelKeys(frontend);

  const merged = deepMerge(backend, frontend);

  for (const [key, value] of Object.entries(MANUAL_VALUES[lang] || {})) {
    setNestedValue(merged, key, value);
  }

  return merged;
}

function verify(frontendPath, backendPath) {
  return fs.readFileSync(frontendPath, "utf8") === fs.readFileSync(backendPath, "utf8");
}

function main() {
  const usage = extractUsedKeys();
  const mergedLocales = {
    en: buildLocale("en"),
  };
  const englishSchema = mergedLocales.en;

  for (const lang of LOCALES) {
    if (lang === "en") {
      writeLocalePair(lang, mergedLocales.en);
      continue;
    }
    mergedLocales[lang] = pruneToSchema(buildLocale(lang), englishSchema);
    writeLocalePair(lang, mergedLocales[lang]);
  }

  const verificationIssues = [];

  for (const lang of LOCALES) {
    const frontendPath = path.join(FRONTEND_LOCALES_DIR, `${lang}.json`);
    const backendPath = path.join(BACKEND_LOCALES_DIR, `${lang}.json`);
    const locale = loadJson(frontendPath);

    if (!verify(frontendPath, backendPath)) {
      verificationIssues.push(`frontend/backend drift remains for ${lang}.json`);
    }

    for (const key of usage.keys()) {
      if (!keyExistsWithPluralSupport(locale, key)) {
        verificationIssues.push(`missing ${lang}:${key}`);
      }
    }

    for (const placeholder of findPlaceholderValues(locale, lang)) {
      verificationIssues.push(`placeholder ${placeholder}`);
    }
  }

  if (verificationIssues.length > 0) {
    console.error("Locale sweep found remaining issues:");
    for (const issue of verificationIssues.slice(0, 200)) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("Locale sweep complete.");
  for (const lang of LOCALES) {
    const locale = loadJson(path.join(FRONTEND_LOCALES_DIR, `${lang}.json`));
    const flat = flattenStrings(locale);
    console.log(`- ${lang}.json synced with ${Object.keys(flat).length} leaf keys`);
  }
  console.log(`- verified ${usage.size} referenced translation keys across frontend and backend`);
}

main();
