const { wrapInTemplate, APP_NAME } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

/**
 * Account deletion confirmation email
 */
function getAccountDeletedEmail({ name, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Account Deleted Successfully',
            confirmed: `This is to confirm that your account with <strong>${APP_NAME}</strong> has been permanently deleted as requested.`,
            deletedTitle: 'What has been deleted?',
            deleted1: 'Your personal profile and contact information',
            deleted2: 'Your saved addresses and phone numbers',
            deleted3: 'Your cart and notification preferences',
            legalNote: 'Please note that some transaction records (orders and donations) are retained for legal and tax purposes, but have been anonymized.',
            sorryNotify: "We're sorry to see you go. If you ever change your mind, you're always welcome to create a new account.",
            subject: 'Account Deleted',
            templateTitle: 'Account Deleted'
        },
        hi: {
            title: 'खाता सफलतापूर्वक हटा दिया गया',
            confirmed: `यह पुष्टि करने के लिए है कि <strong>${APP_NAME}</strong> के साथ आपका खाता अनुरोध के अनुसार स्थायी रूप से हटा दिया गया है।`,
            deletedTitle: 'क्या हटाया गया है?',
            deleted1: 'आपकी व्यक्तिगत प्रोफ़ाइल और संपर्क जानकारी',
            deleted2: 'आपके सहेजे गए पते और फ़ोन नंबर',
            deleted3: 'आपकी कार्ट और सूचना प्राथमिकताएं',
            legalNote: 'कृपया ध्यान दें कि कुछ लेनदेन रिकॉर्ड (ऑर्डर और दान) कानूनी और कर उद्देश्यों के लिए रखे जाते हैं, लेकिन उन्हें अज्ञात कर दिया गया है।',
            sorryNotify: 'हमें आपको जाते हुए देखकर खेद है। यदि आप कभी अपना मन बदलते हैं, तो आपका हमेशा एक नया खाता बनाने के लिए स्वागत है।',
            subject: 'खाता हटा दिया गया',
            templateTitle: 'खाता हटा दिया गया'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.confirmed}</p>
        
        <div class="info-box">
            <strong>${s.deletedTitle}</strong>
            <ul style="color: #555;">
                <li>${s.deleted1}</li>
                <li>${s.deleted2}</li>
                <li>${s.deleted3}</li>
            </ul>
        </div>
        
        <p>${s.legalNote}</p>
        <p>${s.sorryNotify}</p>
        
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * Account deletion scheduled email (grace period)
 */
function getAccountDeletionScheduledEmail({ name, scheduledDate, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Account Deletion Scheduled',
            received: "We've received your request to delete your account. Your account is now scheduled for permanent deletion on:",
            mindTitle: 'Changed your mind?',
            mindDesc: 'No problem! You can cancel this request anytime before the scheduled date by logging in to your account and selecting "Cancel Deletion" on the account deletion page or via the popup.',
            noteTitle: 'Note:',
            noteDesc: 'During this grace period, your access to certain features may be restricted until you cancel the deletion request.',
            questions: 'If you have any questions, please contact our support team.',
            subject: 'Account Deletion Scheduled',
            templateTitle: 'Deletion Scheduled'
        },
        hi: {
            title: 'खाता हटाना निर्धारित है',
            received: 'हमें आपका खाता हटाने का अनुरोध प्राप्त हुआ है। आपका खाता अब स्थायी रूप से हटाने के लिए निर्धारित है:',
            mindTitle: 'अपना मन बदल लिया?',
            mindDesc: 'कोई बात नहीं! आप अपने खाते में लॉग इन करके और खाता हटाने के पृष्ठ पर या पॉपअप के माध्यम से "हटाना रद्द करें" चुनकर निर्धारित तिथि से पहले किसी भी समय इस अनुरोध को रद्द कर सकते हैं।',
            noteTitle: 'नोट:',
            noteDesc: 'इस रियायती अवधि के दौरान, जब तक आप हटाने के अनुरोध को रद्द नहीं करते, कुछ सुविधाओं तक आपकी पहुंच प्रतिबंधित हो सकती है।',
            questions: 'यदि आपके कोई प्रश्न हैं, तो कृपया हमारी सहायता टीम से संपर्क करें।',
            subject: 'खाता हटाना निर्धारित',
            templateTitle: 'निर्धारित हटाना'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');
    const dateStr = new Date(scheduledDate).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.received}</p>
        
        <div class="info-box" style="text-align: center; font-size: 18px;">
            <strong>${dateStr}</strong>
        </div>
        
        <p><strong>${s.mindTitle}</strong> ${s.mindDesc}</p>
        
        <div class="warning-box">
            <strong>${s.noteTitle}</strong> ${s.noteDesc}
        </div>
        
        <p>${s.questions}</p>
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * Account deletion OTP verification email
 */
function getAccountDeletionOTPEmail({ otp, expiryMinutes, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Confirm Account Deletion',
            received: 'We received a request to permanently delete your account. To proceed, please use the following verification code:',
            expire: `This code will expire in <strong>${expiryMinutes} minutes</strong>.`,
            warningTitle: 'Warning:',
            warningDesc: 'Deleting your account is permanent and cannot be undone. All your personal data, saved addresses, and preferences will be destroyed.',
            notTitle: "Didn't request this?",
            notDesc: 'If you did not initiate this deletion request, please ignore this email. Your account is still secure.',
            subject: 'is your verification code for account deletion',
            templateTitle: 'Security Verification'
        },
        hi: {
            title: 'खाता हटाने की पुष्टि करें',
            received: 'हमें आपका खाता स्थायी रूप से हटाने का अनुरोध प्राप्त हुआ है। आगे बढ़ने के लिए, कृपया निम्नलिखित सत्यापन कोड का उपयोग करें:',
            expire: `यह कोड <strong>${expiryMinutes} मिनट</strong> में समाप्त हो जाएगा।`,
            warningTitle: 'चेतावनी:',
            warningDesc: 'अपना खाता हटाना स्थायी है और इसे पूर्ववत नहीं किया जा सकता है। आपका सभी व्यक्तिगत डेटा, सहेजे गए पते और प्राथमिकताएं नष्ट हो जाएंगी।',
            notTitle: 'यह अनुरोध नहीं किया था?',
            notDesc: 'यदि आपने यह हटाने का अनुरोध शुरू नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें। आपका खाता अभी भी सुरक्षित है।',
            subject: 'खाता हटाने के लिए आपका सत्यापन कोड है',
            templateTitle: 'सुरक्षा सत्यापन'
        }
    };

    const s = i18n[lang] || i18n.en;

    const content = `
        <div style="text-align: center;">
            <h2 style="color: #e53e3e;">${s.title}</h2>
            <p>${s.received}</p>
            
            <div style="background-color: #fff5f5; padding: 25px; margin: 30px auto; width: fit-content; border-radius: 8px; border: 2px solid #feb2b2;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #c53030;">${otp}</span>
            </div>
            
            <p>${s.expire}</p>
            
            <div style="background-color: #fffaf0; padding: 15px; border-radius: 8px; border-left: 4px solid #ed8936; text-align: left; margin: 25px 0;">
                <strong style="color: #c05621;">${s.warningTitle}</strong> ${s.warningDesc}
            </div>
            
            <p class="text-muted" style="font-size: 13px; margin-top: 30px;">
                <strong>${s.notTitle}</strong> ${s.notDesc}
            </p>
        </div>
    `;

    return {
        subject: `[URGENT] ${otp} ${s.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

module.exports = {
    getAccountDeletedEmail,
    getAccountDeletionScheduledEmail,
    getAccountDeletionOTPEmail
};
