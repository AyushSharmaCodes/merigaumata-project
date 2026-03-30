/**
 * SES Templates: Contact
 * Templates: mgm_contact_form, mgm_contact_auto_reply
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_contact_form (Admin notification) ──────────────────────────────────

const contactFormHtml = wrapInSesTemplate(`
    <h2>New Contact Form Submission 📬</h2>
    <p>A new contact form message has been submitted on the website.</p>

    <div class="info-box">
        <strong>Contact Details:</strong><br>
        👤 Name: {{contactName}}<br>
        📧 Email: {{contactEmail}}<br>
        📱 Phone: {{contactPhone}}<br>
        📅 Submitted: {{submittedDate}}
    </div>

    {{#if hasSubject}}
    <p><strong>Subject:</strong> {{contactSubject}}</p>
    {{/if}}

    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <strong>Message:</strong>
        <p style="white-space: pre-wrap; margin-top: 10px;">{{contactMessage}}</p>
    </div>

    <p class="text-muted">
        Please respond to the sender directly.<br>
        Reply to <a href="mailto:{{contactEmail}}">{{contactEmail}}</a>
    </p>
`, { title: 'Contact Form Submission' });

const mgm_contact_form = {
    TemplateName: 'mgm_contact_form',
    SubjectPart: '[Contact Form] {{contactSubjectLine}} from {{contactName}}',
    HtmlPart: contactFormHtml,
    TextPart: stripToText(contactFormHtml)
};

// ─── mgm_contact_auto_reply ─────────────────────────────────────────────────

const contactAutoReplyHtml = wrapInSesTemplate(`
    <h2>We've Received Your Message! ✉️</h2>
    <p>Dear {{firstName}},</p>
    <p>Thank you for reaching out to us. We have received your message and our team will get back to you shortly.</p>

    <div class="info-box">
        <strong>What happens next?</strong>
        <ul style="margin: 5px 0;">
            <li>Our team will review your message</li>
            <li>We typically respond within 24-48 hours</li>
            <li>Check your inbox (and spam folder) for our reply</li>
        </ul>
    </div>

    <p>Thank you for your patience.</p>
    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Message Received' });

const mgm_contact_auto_reply = {
    TemplateName: 'mgm_contact_auto_reply',
    SubjectPart: 'We received your message - {{appName}}',
    HtmlPart: contactAutoReplyHtml,
    TextPart: stripToText(contactAutoReplyHtml)
};

module.exports = [
    mgm_contact_form,
    mgm_contact_auto_reply
];
