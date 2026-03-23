const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

/**
 * Welcome email for newly created managers
 */
function getManagerWelcomeEmail({ name, email, password, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: `Welcome to the ${APP_NAME} Team!`,
            desc: `You have been added as a manager to the <strong>${APP_NAME}</strong> administrative portal.`,
            credsTitle: 'Your Login Credentials:',
            email: 'Email',
            tempPass: 'Temporary Password',
            accessButton: 'Access Admin Portal',
            actionTitle: 'Action Required:',
            actionDesc: 'For security reasons, you will be prompted to change your password upon your first login.',
            trouble: 'If you have any trouble logging in, please contact the system administrator.',
            subject: `Welcome to the ${APP_NAME} Manager Portal`,
            templateTitle: 'Manager Account Created'
        },
        hi: {
            title: `${APP_NAME} टीम में आपका स्वागत है!`,
            desc: `आपको <strong>${APP_NAME}</strong> प्रशासनिक पोर्टल में एक प्रबंधक के रूप में जोड़ा गया है।`,
            credsTitle: 'आपका लॉगिन क्रेडेंशियल:',
            email: 'ईमेल',
            tempPass: 'अस्थायी पासवर्ड',
            accessButton: 'एडमिन पोर्टल एक्सेस करें',
            actionTitle: 'कार्रवाई आवश्यक:',
            actionDesc: 'सुरक्षा कारणों से, आपको अपने पहले लॉगिन पर अपना पासवर्ड बदलने के लिए कहा जाएगा।',
            trouble: 'यदि आपको लॉग इन करने में कोई समस्या होती है, तो कृपया सिस्टम प्रशासक से संपर्क करें।',
            subject: `${APP_NAME} मैनेजर पोर्टल में आपका स्वागत है`,
            templateTitle: 'प्रबंधक खाता बनाया गया'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.desc}</p>
        
        <div class="info-box">
            <strong>${s.credsTitle}</strong><br>
            📧 ${s.email}: ${email}<br>
            🔑 ${s.tempPass}: <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${password}</code>
        </div>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/admin" class="button">${s.accessButton}</a>
        </p>
        
        <div class="warning-box">
            <strong>${s.actionTitle}</strong> ${s.actionDesc}
        </div>
        
        <p>${s.trouble}</p>
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: s.subject,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

module.exports = {
    getManagerWelcomeEmail
};
