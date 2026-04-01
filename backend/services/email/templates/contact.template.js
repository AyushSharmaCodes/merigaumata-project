const { wrapInTemplate, APP_NAME } = require('./base.template');
const { buildGreeting, escapeHtml, formatDateTime } = require('./template.utils');

function getContactFormEmail({ name, email, phone, subject, message }) {
    const content = `
        <h2>New contact form submission</h2>
        <p>A new message was submitted through the website contact form.</p>
        <div class="panel">
            <p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p>
            <p><strong>Email:</strong> ${escapeHtml(email || 'Not provided')}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
            <p><strong>Submitted:</strong> ${formatDateTime(new Date())}</p>
            ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
        </div>
        <div class="panel panel-success">
            <p><strong>Message</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(message || '')}</p>
        </div>
        <p class="muted">Reply directly to ${escapeHtml(email || 'the sender')} if follow-up is needed.</p>
    `;

    return {
        subject: `[Contact Form] ${subject || 'New message'} from ${name || email || 'visitor'}`,
        html: wrapInTemplate(content, { title: 'Contact form submission', preheader: 'A new website contact message was received.' })
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
