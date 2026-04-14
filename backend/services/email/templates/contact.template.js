const { wrapInTemplate, APP_NAME } = require('./base.template');
const { buildGreeting, escapeHtml, formatDateTime } = require('./template.utils');

function getContactFormEmail({ name, email, phone, subject, message }) {
    const previewText = message ? message.substring(0, 50) + '...' : 'A new website query was received.';
    const content = `
        <p>Hi,</p>
        <p>A new inquiry has been submitted via the website:</p>
        <p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p>
        <p><strong>Email:</strong> ${escapeHtml(email || 'Not provided')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
        ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
        
        <p style="margin-top: 20px;"><strong>Message:</strong></p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #B85C3C; margin-top: 10px; white-space: pre-wrap; font-family: monospace;">
            ${escapeHtml(message || '')}
        </div>
        
        <p style="margin-top: 30px; font-size: 14px;" class="muted">You can reply directly to this email to contact ${escapeHtml(name || 'the sender')}.</p>
    `;

    return {
        subject: `Inquiry from ${name || 'Visitor'}: ${subject || 'General Question'}`,
        html: wrapInTemplate(content, { title: `${name || 'Someone'} wants to get in touch`, preheader: previewText })
    };
}

function getContactAutoReplyEmail({ name }) {
    const content = `
        <h2>We received your message</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>Thank you for reaching out. Our team has received your message and will review it shortly.</p>
        <div class="panel">
            <p><strong>What happens next</strong></p>
            <p>We typically reply within 1 to 2 business days.</p>
            <p>Please keep an eye on your inbox and spam folder for our response.</p>
        </div>
        <p class="muted">This is an automated confirmation from ${APP_NAME}.</p>
    `;

    return {
        subject: `We received your message - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Message received', preheader: 'Your contact request has been received.' })
    };
}

module.exports = {
    getContactFormEmail,
    getContactAutoReplyEmail
};
