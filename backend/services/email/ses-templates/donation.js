/**
 * SES Templates: Donations
 * Templates: mgm_donation_receipt
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_donation_receipt ────────────────────────────────────────────────────

const donationReceiptHtml = wrapInSesTemplate(`
    <h2>Thank You for Your Donation! 🙏</h2>
    <p>Dear {{firstName}},</p>
    <p>We are deeply grateful for your generous contribution to our cause. Your support makes a real difference.</p>

    <div class="success-box">
        <strong>Donation Details</strong><br>
        💰 Amount: {{currencySymbol}}{{amount}}<br>
        📅 Date: {{donationDate}}<br>
        🧾 Receipt ID: {{donationId}}
        {{#if hasCampaign}}<br>🎯 Campaign: {{campaign}}{{/if}}
    </div>

    <p>Your contribution helps us continue our mission and create positive impact in our community.</p>

    <div class="info-box">
        <strong>Tax Information:</strong><br>
        This receipt can be used for tax purposes. Please retain it for your records.
    </div>

    <p>Thank You for Your Donation! 🙏</p>
    <p class="text-muted">With gratitude,<br>The {{appName}} Team</p>
`, { title: 'Donation Receipt' });

const mgm_donation_receipt = {
    TemplateName: 'mgm_donation_receipt',
    SubjectPart: 'Thank You for Your Donation - Receipt #{{donationId}}',
    HtmlPart: donationReceiptHtml,
    TextPart: stripToText(donationReceiptHtml)
};

module.exports = [
    mgm_donation_receipt
];
