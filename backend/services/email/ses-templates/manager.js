/**
 * SES Templates: Manager
 * Templates: mgm_manager_welcome
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_manager_welcome ────────────────────────────────────────────────────

const managerWelcomeHtml = wrapInSesTemplate(`
    <h2>Welcome to the {{appName}} Team!</h2>
    <p>Dear {{firstName}},</p>
    <p>You have been added as a manager to the <strong>{{appName}}</strong> administrative portal.</p>

    <div class="info-box">
        <strong>Your Login Credentials:</strong><br>
        📧 Email: {{email}}<br>
        🔑 Temporary Password: <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">{{password}}</code>
    </div>

    <p style="text-align: center;">
        <a href="{{frontendUrl}}/admin" class="button">Access Admin Portal</a>
    </p>

    <div class="warning-box">
        <strong>Action Required:</strong> For security reasons, you will be prompted to change your password upon your first login.
    </div>

    <p>If you have any trouble logging in, please contact the system administrator.</p>
    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Manager Account Created' });

const mgm_manager_welcome = {
    TemplateName: 'mgm_manager_welcome',
    SubjectPart: 'Welcome to the {{appName}} Manager Portal',
    HtmlPart: managerWelcomeHtml,
    TextPart: stripToText(managerWelcomeHtml)
};

module.exports = [
    mgm_manager_welcome
];
