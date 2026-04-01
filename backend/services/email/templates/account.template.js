const { wrapInTemplate, APP_NAME } = require('./base.template');
const { buildGreeting, escapeHtml, formatDate } = require('./template.utils');

function getAccountDeletedEmail({ name }) {
    const content = `
        <h2>Account deleted</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>This confirms that your ${APP_NAME} account has been permanently deleted as requested.</p>
        <div class="panel">
            <p><strong>Data removed</strong></p>
            <p>Your profile, saved addresses, phone numbers, cart, and notification preferences have been removed.</p>
        </div>
        <p class="muted">Some transaction records may still be retained for legal or tax purposes, but they are anonymized where applicable.</p>
    `;

    return {
        subject: `Account deleted - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Account deleted', preheader: 'Your account deletion request has been completed.' })
    };
}

function getAccountDeletionScheduledEmail({ name, scheduledDate }) {
    const content = `
        <h2>Account deletion scheduled</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>Your account is scheduled for permanent deletion on <strong>${escapeHtml(formatDate(scheduledDate))}</strong>.</p>
        <div class="panel panel-warning">
            <p><strong>Changed your mind?</strong></p>
            <p>You can cancel this request before the scheduled date from your account deletion settings.</p>
        </div>
        <p class="muted">Some account features may remain limited until the deletion request is cancelled or completed.</p>
    `;

    return {
        subject: `Account deletion scheduled - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Account deletion scheduled', preheader: 'Your account deletion request is pending.' })
    };
}

function getAccountDeletionOTPEmail({ otp, expiryMinutes }) {
    const content = `
        <h2>Confirm account deletion</h2>
        <p>Use the verification code below to confirm your account deletion request.</p>
        <p style="text-align: center; margin: 28px 0;"><span class="code">${escapeHtml(otp || '------')}</span></p>
        <div class="panel panel-warning">
            <p><strong>Important</strong></p>
            <p>This code expires in ${escapeHtml(expiryMinutes || 10)} minutes.</p>
            <p>Deleting your account is permanent and cannot be undone.</p>
        </div>
        <p class="muted">If you did not request account deletion, you can ignore this email.</p>
    `;

    return {
        subject: `${otp} is your account deletion verification code`,
        html: wrapInTemplate(content, { title: 'Confirm account deletion', preheader: 'Use this code to confirm account deletion.' })
    };
}

module.exports = {
    getAccountDeletedEmail,
    getAccountDeletionScheduledEmail,
    getAccountDeletionOTPEmail
};
