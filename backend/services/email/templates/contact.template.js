const { wrapInTemplate, APP_NAME } = require('./base.template');
const { i18next } = require('../../../middleware/i18n.middleware');

/**
 * Contact form submission - internal notification to admin
 */
function getContactFormEmail({ name, email, phone, subject, message, lang = 'en', t }) {
    if (!t) t = i18next.getFixedT(lang);

    const title = t('emails.contact.title');
    const desc = t('emails.contact.desc');
    const detailsTitle = t('emails.contact.detailsTitle');
    const nameLabel = t('emails.contact.name');
    const emailLabel = t('emails.contact.email');
    const phoneLabel = t('emails.contact.phone');
    const submittedLabel = t('emails.contact.submitted');
    const subjectLabel = t('emails.contact.subjectLabel');
    const messageLabel = t('emails.contact.messageLabel');
    const respondPrompt = t('emails.contact.respondPrompt');
    const replyTo = t('emails.contact.replyTo');
    const templateTitle = t('emails.contact.templateTitle');
    const notProvided = t('emails.contact.notProvided');
    const newMessage = t('emails.contact.newMessage');

    const content = `
        <h2>${title}</h2>
        <p>${desc}</p>
        
        <div class="info-box">
            <strong>${detailsTitle}</strong><br>
            👤 ${nameLabel}: ${name || notProvided}<br>
            📧 ${emailLabel}: ${email}<br>
            📱 ${phoneLabel}: ${phone || notProvided}<br>
            📅 ${submittedLabel}: ${new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
        </div>
        
        ${subject ? `<p><strong>${subjectLabel}:</strong> ${subject}</p>` : ''}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <strong>${messageLabel}:</strong>
            <p style="white-space: pre-wrap; margin-top: 10px;">${message}</p>
        </div>
        
        <p class="text-muted">
            ${respondPrompt}<br>
            ${replyTo} <a href="mailto:${email}">${email}</a>
        </p>
    `;

    return {
        subject: `[Contact Form] ${subject || newMessage} from ${name || email}`,
        html: wrapInTemplate(content, { title: templateTitle, lang, t })
    };
}

/**
 * Auto-reply to contact form submitter
 */
function getContactAutoReplyEmail({ name, lang = 'en', t }) {
    if (!t) t = i18next.getFixedT(lang);

    const title = t('emails.contact.infoReceived');
    const received = t('emails.contact.weWillContact');
    const nextSteps = t('emails.contact.nextSteps');
    const step1 = t('emails.contact.step1');
    const step2 = t('emails.contact.step2');
    const step3 = t('emails.contact.step3');
    const thanksPatience = t('emails.contact.thanksPatience');
    const subject = t('emails.contact.msgSummary');

    // Common
    const dear = t('emails.common.dear');
    const withRegards = t('emails.common.withRegards');
    const team = t('emails.common.team', { appName: APP_NAME });

    const fallbackGreeting = t('emails.contact.greeting');
    const firstName = name ? name.split(' ')[0] : fallbackGreeting;

    const content = `
        <h2>${title}</h2>
        <p>${dear} ${firstName},</p>
        <p>${received}</p>
        
        <div class="info-box">
            <strong>${nextSteps}</strong>
            <ul style="margin: 5px 0;">
                <li>${step1}</li>
                <li>${step2}</li>
                <li>${step3}</li>
            </ul>
        </div>
        
        <p>${thanksPatience}</p>
        <p class="text-muted">${withRegards},<br>${team}</p>
    `;

    return {
        subject: `${subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title, lang, t })
    };
}

module.exports = {
    getContactFormEmail,
    getContactAutoReplyEmail
};
