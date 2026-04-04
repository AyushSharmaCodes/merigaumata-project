const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { buildGreeting, escapeHtml, buildActionButton } = require('./template.utils');

function getManagerWelcomeEmail({ name, email, password, temporaryPasswordExpiryHours = 48 }) {
    const content = `
        <h2>Manager account verified</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>Your email has been verified and your manager account is now ready in the ${APP_NAME} admin portal.</p>
        <div class="panel">
            <p><strong>Login details</strong></p>
            <p>Email: ${escapeHtml(email || 'Not available')}</p>
            <p>Temporary password: <code>${escapeHtml(password || 'Not available')}</code></p>
        </div>
        <div class="panel panel-warning">
            <p><strong>Action required</strong></p>
            <p>This temporary password expires in ${escapeHtml(String(temporaryPasswordExpiryHours))} hours.</p>
            <p>You should sign in and change this password immediately.</p>
        </div>
        ${buildActionButton('Open admin portal', `${FRONTEND_URL}/admin`)}
    `;

    return {
        subject: `Your ${APP_NAME} manager password is ready`,
        html: wrapInTemplate(content, { title: 'Manager account verified', preheader: 'Your temporary manager password is ready.' })
    };
}

module.exports = {
    getManagerWelcomeEmail
};
