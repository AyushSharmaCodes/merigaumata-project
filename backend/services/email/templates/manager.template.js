const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { buildGreeting, escapeHtml, buildActionButton } = require('./template.utils');

function getManagerWelcomeEmail({ name, email, password }) {
    const content = `
        <h2>Manager account created</h2>
        <p>${buildGreeting(name, 'there')}</p>
        <p>You have been added as a manager in the ${APP_NAME} admin portal.</p>
        <div class="panel">
            <p><strong>Login details</strong></p>
            <p>Email: ${escapeHtml(email || 'Not available')}</p>
            <p>Temporary password: <code>${escapeHtml(password || 'Not available')}</code></p>
        </div>
        <div class="panel panel-warning">
            <p><strong>Action required</strong></p>
            <p>You should change this password the first time you sign in.</p>
        </div>
        ${buildActionButton('Open admin portal', `${FRONTEND_URL}/admin`)}
    `;

    return {
        subject: `Welcome to the ${APP_NAME} manager portal`,
        html: wrapInTemplate(content, { title: 'Manager account created', preheader: 'Your manager account is ready.' })
    };
}

module.exports = {
    getManagerWelcomeEmail
};
