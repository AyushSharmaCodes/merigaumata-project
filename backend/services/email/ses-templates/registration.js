/**
 * SES Templates: Registration
 * Templates: mgm_registration_welcome, mgm_registration_confirmation
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_registration_welcome ────────────────────────────────────────────────

const welcomeHtml = wrapInSesTemplate(`
    <h2>Welcome to {{appName}}! 🎉</h2>
    <p>Dear {{firstName}},</p>
    <p>We're thrilled to have you join our community. Your account has been successfully created.</p>

    <div class="info-box">
        <strong>Your Account Details:</strong><br>
        📧 Email: {{email}}<br>
        📅 Joined: {{joinedDate}}
    </div>

    <h3>What's Next?</h3>
    <ul style="color: #555;">
        <li>Browse our latest products</li>
        <li>Complete your profile</li>
        <li>Start shopping!</li>
    </ul>

    <p style="text-align: center;">
        <a href="{{frontendUrl}}" class="button">Start Exploring</a>
    </p>

    <p>If you have any questions, our support team is always here to help.</p>
    <p class="text-muted">Welcome aboard!<br>The {{appName}} Team</p>
`, { title: 'Welcome to {{appName}}' });

const mgm_registration_welcome = {
    TemplateName: 'mgm_registration_welcome',
    SubjectPart: 'Welcome to {{appName}}! 🎉',
    HtmlPart: welcomeHtml,
    TextPart: stripToText(welcomeHtml)
};

// ─── mgm_registration_confirmation ───────────────────────────────────────────

const confirmationHtml = wrapInSesTemplate(`
    <h2>Confirm Your Email Address</h2>
    <p>Dear {{firstName}},</p>
    <p>Thank you for signing up! Please confirm your email address to activate your account.</p>

    <p style="text-align: center;">
        <a href="{{verificationLink}}" class="button">Confirm My Email</a>
    </p>

    <p class="text-muted">Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; font-size: 12px; color: #667eea; background: #f5f5f5; padding: 10px; border-radius: 4px;">
        {{verificationLink}}
    </p>

    <div class="warning-box">
        <strong>Important:</strong> This link will expire in 24 hours. If you didn't create an account, please ignore this email.
    </div>

    <p class="text-muted">Thanks,<br>The {{appName}} Team</p>
`, { title: 'Email Confirmation' });

const mgm_registration_confirmation = {
    TemplateName: 'mgm_registration_confirmation',
    SubjectPart: 'Confirm your email - {{appName}}',
    HtmlPart: confirmationHtml,
    TextPart: stripToText(confirmationHtml)
};

module.exports = [
    mgm_registration_welcome,
    mgm_registration_confirmation
];
