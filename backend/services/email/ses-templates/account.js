/**
 * SES Templates: Account Management
 * Templates: mgm_account_deleted, mgm_account_deletion_scheduled, mgm_account_deletion_otp
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_account_deleted ────────────────────────────────────────────────────

const accountDeletedHtml = wrapInSesTemplate(`
    <h2>Account Deleted Successfully</h2>
    <p>Dear {{firstName}},</p>
    <p>This is to confirm that your account with <strong>{{appName}}</strong> has been permanently deleted as requested.</p>

    <div class="info-box">
        <strong>What has been deleted?</strong>
        <ul style="color: #555;">
            <li>Your personal profile and contact information</li>
            <li>Your saved addresses and phone numbers</li>
            <li>Your cart and notification preferences</li>
        </ul>
    </div>

    <p>Please note that some transaction records (orders and donations) are retained for legal and tax purposes, but have been anonymized.</p>
    <p>We're sorry to see you go. If you ever change your mind, you're always welcome to create a new account.</p>

    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Account Deleted' });

const mgm_account_deleted = {
    TemplateName: 'mgm_account_deleted',
    SubjectPart: 'Account Deleted - {{appName}}',
    HtmlPart: accountDeletedHtml,
    TextPart: stripToText(accountDeletedHtml)
};

// ─── mgm_account_deletion_scheduled ─────────────────────────────────────────

const accountDeletionScheduledHtml = wrapInSesTemplate(`
    <h2>Account Deletion Scheduled</h2>
    <p>Dear {{firstName}},</p>
    <p>We've received your request to delete your account. Your account is now scheduled for permanent deletion on:</p>

    <div class="info-box" style="text-align: center; font-size: 18px;">
        <strong>{{scheduledDate}}</strong>
    </div>

    <p><strong>Changed your mind?</strong> No problem! You can cancel this request anytime before the scheduled date by logging in to your account and selecting "Cancel Deletion" on the account deletion page or via the popup.</p>

    <div class="warning-box">
        <strong>Note:</strong> During this grace period, your access to certain features may be restricted until you cancel the deletion request.
    </div>

    <p>If you have any questions, please contact our support team.</p>
    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Deletion Scheduled' });

const mgm_account_deletion_scheduled = {
    TemplateName: 'mgm_account_deletion_scheduled',
    SubjectPart: 'Account Deletion Scheduled - {{appName}}',
    HtmlPart: accountDeletionScheduledHtml,
    TextPart: stripToText(accountDeletionScheduledHtml)
};

// ─── mgm_account_deletion_otp ───────────────────────────────────────────────

const accountDeletionOtpHtml = wrapInSesTemplate(`
    <div style="text-align: center;">
        <h2 style="color: #e53e3e;">Confirm Account Deletion</h2>
        <p>We received a request to permanently delete your account. To proceed, please use the following verification code:</p>

        <div style="background-color: #fff5f5; padding: 25px; margin: 30px auto; width: fit-content; border-radius: 8px; border: 2px solid #feb2b2;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #c53030;">{{otp}}</span>
        </div>

        <p>This code will expire in <strong>{{expiryMinutes}} minutes</strong>.</p>

        <div style="background-color: #fffaf0; padding: 15px; border-radius: 8px; border-left: 4px solid #ed8936; text-align: left; margin: 25px 0;">
            <strong style="color: #c05621;">Warning:</strong> Deleting your account is permanent and cannot be undone. All your personal data, saved addresses, and preferences will be destroyed.
        </div>

        <p class="text-muted" style="font-size: 13px; margin-top: 30px;">
            <strong>Didn't request this?</strong> If you did not initiate this deletion request, please ignore this email. Your account is still secure.
        </p>
    </div>
`, { title: 'Security Verification' });

const mgm_account_deletion_otp = {
    TemplateName: 'mgm_account_deletion_otp',
    SubjectPart: '[URGENT] {{otp}} is your verification code for account deletion - {{appName}}',
    HtmlPart: accountDeletionOtpHtml,
    TextPart: stripToText(accountDeletionOtpHtml)
};

module.exports = [
    mgm_account_deleted,
    mgm_account_deletion_scheduled,
    mgm_account_deletion_otp
];
