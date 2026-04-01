const { wrapInTemplate, APP_NAME } = require('./base.template');
const { escapeHtml, buildActionButton } = require('./template.utils');

function renderOtpBlock(otp) {
    return `<p style="text-align: center; margin: 28px 0;"><span class="code">${escapeHtml(otp || '------')}</span></p>`;
}

function getOTPEmail({ otp, expiryMinutes }) {
    const content = `
        <h2>Your verification code</h2>
        <p>Use the code below to complete your sign-in.</p>
        ${renderOtpBlock(otp)}
        <p class="muted">This code will expire in ${escapeHtml(expiryMinutes || 10)} minutes.</p>
        <p class="muted">If you did not request this code, please ignore this email.</p>
    `;

    return {
        subject: `${otp} is your ${APP_NAME} verification code`,
        html: wrapInTemplate(content, { title: 'Verification code', preheader: 'Use this code to complete your sign-in.' })
    };
}

function getPasswordChangeOTPEmail({ otp, expiryMinutes }) {
    const content = `
        <h2>Confirm password change</h2>
        <p>Use the verification code below to confirm your password change request.</p>
        ${renderOtpBlock(otp)}
        <div class="panel panel-warning">
            <p><strong>Important</strong></p>
            <p>This code expires in ${escapeHtml(expiryMinutes || 10)} minutes.</p>
            <p>If you did not request a password change, secure your account immediately.</p>
        </div>
    `;

    return {
        subject: `${otp} is your password change code`,
        html: wrapInTemplate(content, { title: 'Confirm password change', preheader: 'Use this code to confirm your password change.' })
    };
}

function getPasswordResetEmail({ resetLink }) {
    const safeLink = escapeHtml(resetLink || '');
    const content = `
        <h2>Reset your password</h2>
        <p>We received a request to reset your password. Use the button below to choose a new password.</p>
        ${buildActionButton('Reset Password', resetLink)}
        <div class="panel">
            <p><strong>If the button does not work, use this link:</strong></p>
            <p style="word-break: break-word;">${safeLink}</p>
        </div>
        <p class="muted">This reset link expires in 1 hour. If you did not request it, you can ignore this message.</p>
    `;

    return {
        subject: `Reset your ${APP_NAME} password`,
        html: wrapInTemplate(content, { title: 'Reset your password', preheader: 'Use this secure link to reset your password.' })
    };
}

module.exports = {
    getOTPEmail,
    getPasswordChangeOTPEmail,
    getPasswordResetEmail
};
