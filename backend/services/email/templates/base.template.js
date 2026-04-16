const APP_NAME = process.env.APP_NAME || 'MeriGauMata';

if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL environment variable is required for email templates');
}

const FRONTEND_URL = String(process.env.FRONTEND_URL).split(',')[0].trim();

function wrapInTemplate(content, options = {}) {
    const { title = APP_NAME, preheader = '' } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #f3f4f6;
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            color: #1f2937;
            line-height: 1.6;
        }
        .preheader {
            display: none !important;
            visibility: hidden;
            opacity: 0;
            color: transparent;
            height: 0;
            width: 0;
            overflow: hidden;
            mso-hide: all;
        }
        .outer {
            width: 100%;
            padding: 24px 12px;
            box-sizing: border-box;
        }
        .card {
            max-width: 640px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            overflow: hidden;
        }
        .header {
            padding: 28px 32px 20px;
            background: linear-gradient(180deg, #fdfaf3 0%, #ffffff 100%);
            border-bottom: 1px solid #f1f5f9;
        }
        .brand {
            font-size: 20px;
            font-weight: 700;
            color: #92400e;
            margin: 0;
        }
        .body {
            padding: 32px;
        }
        .footer {
            padding: 20px 32px 32px;
            color: #6b7280;
            font-size: 13px;
        }
        h1, h2, h3 {
            color: #111827;
            margin-top: 0;
        }
        p {
            margin: 0 0 16px;
        }
        a {
            color: #b45309;
        }
        .button {
            display: inline-block;
            background: #b45309;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: 600;
        }
        .panel {
            background: #fafaf9;
            border: 1px solid #e7e5e4;
            border-radius: 14px;
            padding: 16px 18px;
            margin: 20px 0;
        }
        .panel-success {
            background: #f0fdf4;
            border-color: #bbf7d0;
        }
        .panel-warning {
            background: #fff7ed;
            border-color: #fed7aa;
        }
        .muted {
            color: #6b7280;
        }
        .code {
            display: inline-block;
            padding: 12px 18px;
            background: #111827;
            color: #ffffff;
            border-radius: 12px;
            font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 28px;
            letter-spacing: 6px;
            font-weight: 700;
        }
        .detail-list {
            margin: 0;
            padding: 0;
            list-style: none;
        }
        .detail-list li {
            margin: 0 0 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
        }
        th {
            background: #f9fafb;
            color: #374151;
            font-size: 13px;
        }
        @media only screen and (max-width: 640px) {
            .header, .body, .footer {
                padding-left: 20px;
                padding-right: 20px;
            }
            .code {
                font-size: 24px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="preheader">${preheader}</div>
    <div class="outer">
        <div class="card">
            <div class="header">
                <p class="brand">${APP_NAME}</p>
            </div>
            <div class="body">
                ${content}
            </div>
            <div class="footer">
                <p>Sent by ${APP_NAME}</p>
                <p><a href="${FRONTEND_URL}">Visit our website</a></p>
            </div>
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
    wrapInTemplate,
    APP_NAME,
    FRONTEND_URL
};
