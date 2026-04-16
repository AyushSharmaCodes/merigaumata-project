/**
 * SES Templates: Authentication
 * Templates: mgm_auth_otp, mgm_auth_password_change_otp, mgm_auth_password_reset
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_auth_otp ────────────────────────────────────────────────────────────

const otpHtml = wrapInSesTemplate(`
    <div style="text-align: center;">
        <h2 style="color: #4a5568; margin-bottom: 16px;">Your Verification Code</h2>
        <p style="color: #718096; line-height: 1.6;">Use the code below to complete your login. This code is valid for {{expiryMinutes}} minutes.</p>

        <div style="background-color: #f7fafc; padding: 24px; margin: 32px auto; width: fit-content; border-radius: 12px; border: 2px dashed #ecc94b;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #b7791f; font-family: 'Roboto Mono', 'Noto Sans Devanagari', monospace;">{{otp}}</span>
        </div>

        <p style="color: #a0aec0; font-size: 14px; margin-top: 24px;">This is an automated security notification.</p>
    </div>
`, { title: 'Verification Code' });

const mgm_auth_otp = {
    TemplateName: 'mgm_auth_otp',
    SubjectPart: '{{otp}} - Verification Code | {{appName}}',
    HtmlPart: otpHtml,
    TextPart: stripToText(otpHtml)
};

// ─── mgm_auth_password_change_otp ────────────────────────────────────────────

const passwordChangeOtpHtml = wrapInSesTemplate(`
    <div style="text-align: center; font-family: 'Roboto', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Noto Sans Telugu', system-ui, sans-serif;">
        <div style="display: inline-block; padding: 12px; background: #fffaf0; border-radius: 50%; margin-bottom: 24px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#b7791f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="#b7791f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>

        <h1 style="color: #1a202c; font-size: 24px; font-weight: 700; margin: 0 0 12px 0;">Password Change Verification</h1>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; max-width: 400px; margin-left: auto; margin-right: auto;">
            To confirm your password change, please use the following one-time password (OTP). This code is valid for {{expiryMinutes}} minutes.
        </p>

        <div style="background: linear-gradient(135deg, #fffaf0 0%, #fef3c7 100%); padding: 32px; border-radius: 16px; margin-bottom: 32px; border: 1px solid #fde68a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #92400e; font-family: 'Roboto Mono', 'Noto Sans Devanagari', monospace; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">{{otp}}</span>
        </div>

        <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; text-align: left; margin-bottom: 24px;">
            <p style="color: #991b1b; font-size: 13px; margin: 0; font-weight: 500;">
                If you did not request this, please secure your account immediately.
            </p>
        </div>

        <p style="color: #718096; font-size: 14px; margin: 0;">
            Valid for <strong>{{expiryMinutes}} minutes</strong>
        </p>
    </div>
`, { title: 'Security Verification' });

const mgm_auth_password_change_otp = {
    TemplateName: 'mgm_auth_password_change_otp',
    SubjectPart: '{{otp}} - Password Change Verification | {{appName}}',
    HtmlPart: passwordChangeOtpHtml,
    TextPart: stripToText(passwordChangeOtpHtml)
};

// ─── mgm_auth_password_reset ─────────────────────────────────────────────────

const passwordResetHtml = wrapInSesTemplate(`
    <div style="font-family: 'Roboto', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Noto Sans Telugu', system-ui, sans-serif;">
        <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin-bottom: 16px;">Reset Your Password</h2>
        <p style="color: #4a5568; line-height: 1.6; margin-bottom: 24px;">We received a request to reset your password. Click the button below to choose a new one:</p>

        <p style="text-align: center; margin: 32px 0;">
            <a href="{{resetLink}}" style="background-color: #b7791f; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
        </p>

        <p style="color: #718096; font-size: 14px; margin-bottom: 8px;">Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; font-size: 12px; color: #b7791f; background: #fefaf0; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;">
            {{resetLink}}
        </p>

        <div style="background-color: #fffaf0; padding: 16px; border-radius: 8px; border: 1px solid #fde68a; margin-top: 24px;">
            <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
                This link will expire in 1 hour. If you didn't request a password reset, please secure your account or contact us.
            </p>
        </div>
    </div>
`, { title: 'Password Reset' });

const mgm_auth_password_reset = {
    TemplateName: 'mgm_auth_password_reset',
    SubjectPart: 'Reset Your Password - {{appName}}',
    HtmlPart: passwordResetHtml,
    TextPart: stripToText(passwordResetHtml)
};

module.exports = [
    mgm_auth_otp,
    mgm_auth_password_change_otp,
    mgm_auth_password_reset
];
