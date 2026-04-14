/**
 * SES Templates: Contact
 * Templates: mgm_contact_form, mgm_contact_auto_reply
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_contact_form (Admin notification) ──────────────────────────────────

const contactFormHtml = wrapInSesTemplate(`
    <p>Hi,</p>
    <p>A new inquiry has been submitted via the website:</p>
    <p><strong>Name:</strong> {{contactName}}<br>
    <strong>Email:</strong> {{contactEmail}}<br>
    <strong>Phone:</strong> {{contactPhone}}</p>
    {{#if hasSubject}}
    <p><strong>Subject:</strong> {{contactSubject}}</p>
    {{else}}
    <p><strong>Subject:</strong> General Inquiry</p>
    {{/if}}

    <p style="margin-top: 20px;"><strong>Message:</strong></p>
    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #B85C3C; margin-top: 10px; white-space: pre-wrap; font-family: monospace;">
        {{contactMessage}}
    </div>

    <p style="margin-top: 30px;">You can reply directly to this email to contact {{contactName}}.</p>
`, { title: '{{contactName}} wants to get in touch' });

const mgm_contact_form = {
    TemplateName: 'mgm_contact_form',
    SubjectPart: 'Inquiry from {{contactName}}: {{contactSubjectLine}}',
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
