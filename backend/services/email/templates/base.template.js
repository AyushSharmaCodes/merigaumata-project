/**
 * Base Email Template
 * Provides the HTML wrapper for all email templates
 */

const APP_NAME = process.env.APP_NAME || 'MeriGauMata';
const { i18next } = require('../../../middleware/i18n.middleware');

// Validate required environment variables
if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL environment variable is required for email templates');
}

const rawFrontendUrl = process.env.FRONTEND_URL;
const FRONTEND_URL = rawFrontendUrl.split(',')[0].trim();

/**
 * Wrap content in the base email template
 */
function wrapInTemplate(content, options = {}) {
    const { title = APP_NAME, lang = 'en' } = options;
    const t = options.t || i18next.getFixedT(lang);

    return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            background-color: #f5f5f5; 
            line-height: 1.6;
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff; 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            padding: 40px 20px; 
            text-align: center; 
        }
        .header h1 { 
            color: #ffffff; 
            margin: 0; 
            font-size: 28px; 
            font-weight: 600; 
        }
        .content { 
            padding: 40px 30px; 
        }
        .footer { 
            background-color: #f8f9fa; 
            padding: 30px; 
            text-align: center; 
            color: #6c757d; 
            font-size: 14px; 
        }
        .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: #ffffff !important; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 20px 0; 
        }
        .info-box { 
            background-color: #e7f3ff; 
            border-left: 4px solid #2196F3; 
            padding: 15px; 
            margin: 20px 0; 
        }
        .success-box { 
            background-color: #d4edda; 
            border-left: 4px solid #28a745; 
            padding: 15px; 
            margin: 20px 0; 
        }
        .warning-box { 
            background-color: #fff3cd; 
            border-left: 4px solid #ffc107; 
            padding: 15px; 
            margin: 20px 0; 
        }
        .order-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #e9ecef; 
        }
        h2 { color: #333; margin-top: 0; }
        p { color: #555; }
        .text-muted { color: #6c757d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>${APP_NAME}</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${APP_NAME}. ${t('emails.common.rights')}</p>
            <p class="text-muted">
                <a href="${FRONTEND_URL}" style="color: #667eea;">${t('emails.common.visit')}</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}

module.exports = { wrapInTemplate, APP_NAME, FRONTEND_URL };
