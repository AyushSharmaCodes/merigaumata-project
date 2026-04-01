const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { buildGreeting, escapeHtml, formatDate, buildActionButton } = require('./template.utils');

function getRegistrationEmail({ name, email }) {
    const content = `
        <h2>Welcome to ${APP_NAME}</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>Your account has been created successfully. You can now sign in, update your profile, and start using ${APP_NAME}.</p>
        <div class="panel panel-success">
            <p><strong>Account details</strong></p>
            <p>Email: ${escapeHtml(email || 'Not available')}</p>
            <p>Joined: ${formatDate(new Date())}</p>
        </div>
        <p>We recommend completing your profile and reviewing your account settings before your next order or registration.</p>
        ${buildActionButton('Open Website', FRONTEND_URL)}
        <p class="muted">If you did not create this account, please contact support immediately.</p>
    `;

    return {
        subject: `Welcome to ${APP_NAME}`,
        html: wrapInTemplate(content, { title: `Welcome to ${APP_NAME}`, preheader: `Your ${APP_NAME} account is ready.` })
    };
}

function getEmailConfirmationEmail({ name, verificationLink }) {
    const safeLink = escapeHtml(verificationLink || FRONTEND_URL);
    const content = `
        <h2>Confirm your email address</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>Please confirm your email address to activate your account.</p>
        ${buildActionButton('Confirm Email', verificationLink)}
        <div class="panel">
            <p><strong>If the button does not work, use this link:</strong></p>
            <p style="word-break: break-word;">${safeLink}</p>
        </div>
        <p class="muted">This link will expire in 24 hours. If you did not create an account, you can ignore this email.</p>
    `;

    return {
        subject: `Confirm your email for ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Confirm your email', preheader: 'Activate your account by confirming your email.' })
    };
}

module.exports = {
    getRegistrationEmail,
    getEmailConfirmationEmail
};
