const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

/**
 * Welcome email for new user registration
 */
function getRegistrationEmail({ name, email, lang = 'en', t }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: `Welcome to ${APP_NAME}! 🎉`,
            thrilled: "We're thrilled to have you join our community. Your account has been successfully created.",
            detailsTitle: 'Your Account Details:',
            email: 'Email',
            joined: 'Joined',
            whatsNext: "What's Next?",
            step1: 'Browse our latest products',
            step2: 'Complete your profile',
            step3: 'Start shopping!',
            startButton: 'Start Exploring',
            questions: 'If you have any questions, our support team is always here to help.',
            welcomeAboard: 'Welcome aboard!',
            subject: 'Welcome to',
            templateTitle: 'Welcome to'
        },
        hi: {
            title: `${APP_NAME} में आपका स्वागत है! 🎉`,
            thrilled: 'हमें खुशी है कि आप हमारे समुदाय में शामिल हुए हैं। आपका खाता सफलतापूर्वक बना लिया गया है।',
            detailsTitle: 'आपके खाते का विवरण:',
            email: 'ईमेल',
            joined: 'शामिल हुए',
            whatsNext: 'आगे क्या?',
            step1: 'हमारे नवीनतम उत्पादों को ब्राउज़ करें',
            step2: 'अपनी प्रोफ़ाइल पूरी करें',
            step3: 'खरीदारी शुरू करें!',
            startButton: 'खोजना शुरू करें',
            questions: 'यदि आपके कोई प्रश्न हैं, तो हमारी सहायता टीम हमेशा मदद के लिए यहाँ है।',
            welcomeAboard: 'स्वागत है!',
            subject: 'में आपका स्वागत है',
            templateTitle: 'में आपका स्वागत है'
        }
    };

    const s = i18n[lang] || i18n.en;
    let firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');

    // Handle default username key
    if (firstName === 'common.user.defaultName' || name === 'common.user.defaultName') {
        // Use provided t function or fallback to hardcoded translation if t is missing key/function
        firstName = (t && t('common.user.defaultName') !== 'common.user.defaultName')
            ? t('common.user.defaultName')
            : (lang === 'hi' ? 'उपयोगकर्ता' : 'User');
    }

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.thrilled}</p>
        
        <div class="info-box">
            <strong>${s.detailsTitle}</strong><br>
            📧 ${s.email}: ${email}<br>
            📅 ${s.joined}: ${new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
        </div>
        
        <h3>${s.whatsNext}</h3>
        <ul style="color: #555;">
            <li>${s.step1}</li>
            <li>${s.step2}</li>
            <li>${s.step3}</li>
        </ul>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}" class="button">${s.startButton}</a>
        </p>
        
        <p>${s.questions}</p>
        <p class="text-muted">${s.welcomeAboard}<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} ${APP_NAME}! 🎉`,
        html: wrapInTemplate(content, { title: `${s.templateTitle} ${APP_NAME}`, lang })
    };
}

/**
 * Email verification (if needed separately)
 */
function getEmailVerificationEmail({ name, verificationLink, lang = 'en', t }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Verify Your Email Address',
            desc: 'Please click the button below to verify your email address:',
            verifyButton: 'Verify Email',
            copyPaste: 'Or copy and paste this link:',
            expire: 'This link will expire in 24 hours.',
            subject: 'Verify your email'
        },
        hi: {
            title: 'अपना ईमेल पता सत्यापित करें',
            desc: 'अपना ईमेल पता सत्यापित करने के लिए कृपया नीचे दिए गए बटन पर क्लिक करें:',
            verifyButton: 'ईमेल सत्यापित करें',
            copyPaste: 'या इस लिंक को कॉपी और पेस्ट करें:',
            expire: 'यह लिंक 24 घंटों में समाप्त हो जाएगा।',
            subject: 'अपना ईमेल सत्यापित करें'
        }
    };

    const s = i18n[lang] || i18n.en;
    let firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');

    // Handle default username key
    if (firstName === 'common.user.defaultName' || name === 'common.user.defaultName') {
        firstName = (t && t('common.user.defaultName') !== 'common.user.defaultName')
            ? t('common.user.defaultName')
            : (lang === 'hi' ? 'उपयोगकर्ता' : 'User');
    }

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.desc}</p>
        
        <p style="text-align: center;">
            <a href="${verificationLink}" class="button">${s.verifyButton}</a>
        </p>
        
        <p class="text-muted">${s.copyPaste}</p>
        <p style="word-break: break-all; font-size: 12px; color: #667eea;">
            ${verificationLink}
        </p>
        
        <p class="text-muted">${s.expire}</p>
    `;

    return {
        subject: `${s.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: s.title, lang })
    };
}

/**
 * Email confirmation for signup verification (with link)
 */
function getEmailConfirmationEmail({ name, email, verificationLink, lang = 'en', t }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Confirm Your Email Address',
            desc: 'Thank you for signing up! Please confirm your email address to activate your account.',
            confirmButton: 'Confirm My Email',
            copyPaste: 'Or copy and paste this link in your browser:',
            important: 'Important:',
            expire: 'This link will expire in 24 hours. If you didn\'t create an account, please ignore this email.',
            thanks: 'Thanks',
            subject: 'Confirm your email',
            templateTitle: 'Email Confirmation'
        },
        hi: {
            title: 'अपने ईमेल पते की पुष्टि करें',
            desc: 'साइन अप करने के लिए धन्यवाद! अपना खाता सक्रिय करने के लिए कृपया अपने ईमेल पते की पुष्टि करें।',
            confirmButton: 'मेरा ईमेल पुष्ट करें',
            copyPaste: 'या अपने ब्राउज़र में इस लिंक को कॉपी और पेस्ट करें:',
            important: 'महत्वपूर्ण:',
            expire: 'यह लिंक 24 घंटों में समाप्त हो जाएगा। यदि आपने खाता नहीं बनाया है, तो कृपया इस ईमेल को अनदेखा करें।',
            thanks: 'धन्यवाद',
            subject: 'अपने ईमेल की पुष्टि करें',
            templateTitle: 'ईमेल पुष्टिकरण'
        }
    };

    const s = i18n[lang] || i18n.en;
    let firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');

    // Handle default username key
    if (firstName === 'common.user.defaultName' || name === 'common.user.defaultName') {
        firstName = (t && t('common.user.defaultName') !== 'common.user.defaultName')
            ? t('common.user.defaultName')
            : (lang === 'hi' ? 'उपयोगकर्ता' : 'User');
    }

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.desc}</p>
        
        <p style="text-align: center;">
            <a href="${verificationLink}" class="button">${s.confirmButton}</a>
        </p>
        
        <p class="text-muted">${s.copyPaste}</p>
        <p style="word-break: break-all; font-size: 12px; color: #667eea; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${verificationLink}
        </p>
        
        <div class="warning-box">
            <strong>${s.important}</strong> ${s.expire}
        </div>
        
        <p class="text-muted">${s.thanks},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

module.exports = {
    getRegistrationEmail,
    getEmailVerificationEmail,
    getEmailConfirmationEmail
};
