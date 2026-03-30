/**
 * SES Templates: Subscriptions (Recurring Donations)
 * Templates: mgm_subscription_confirmation, mgm_subscription_cancellation
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_subscription_confirmation ──────────────────────────────────────────

const subscriptionConfirmationHtml = wrapInSesTemplate(`
    <h2>Welcome to Our Monthly Giving Family! 🐄💚</h2>
    <p>Dear {{firstName}},</p>
    <p>Thank you for joining our community of monthly supporters! Your recurring contribution creates a lasting impact for the cows in our care.</p>

    <div class="success-box" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e;">
        <strong style="font-size: 18px;">🎉 Monthly Donation Activated</strong><br><br>
        💰 <strong>Monthly Amount:</strong> {{currencySymbol}}{{amount}}<br>
        📅 <strong>Started:</strong> {{startDate}}<br>
        🔄 <strong>Next Contribution:</strong> {{nextBillingDate}}<br>
        {{#if hasDonationRef}}🧾 <strong>Reference:</strong> {{donationRef}}{{/if}}
    </div>

    <h3 style="color: #16a34a;">What Your Monthly Donation Provides:</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
            <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">🌾 <strong>Nutritious Fodder</strong></td>
            <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">🏥 <strong>Regular Veterinary Care</strong></td>
        </tr>
        <tr>
            <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 0 8px;">🏠 <strong>Clean Shelter</strong></td>
            <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 8px 0;">💚 <strong>Daily Love &amp; Care</strong></td>
        </tr>
    </table>

    <div class="info-box" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
        <strong>📋 Managing Your Subscription</strong><br>
        You can view, pause, or cancel your monthly donation anytime from your profile dashboard. All tax receipts will be sent automatically after each monthly payment.
    </div>

    <p style="text-align: center; margin-top: 24px;">
        <strong style="font-size: 16px; color: #16a34a;">Together, we're making a difference every single month! 🌟</strong>
    </p>

    <p class="text-muted">With gratitude,<br>The {{appName}} Team</p>
`, { title: 'Monthly Donation Started' });

const mgm_subscription_confirmation = {
    TemplateName: 'mgm_subscription_confirmation',
    SubjectPart: '🐄 Welcome to Monthly Giving - {{firstName}}!',
    HtmlPart: subscriptionConfirmationHtml,
    TextPart: stripToText(subscriptionConfirmationHtml)
};

// ─── mgm_subscription_cancellation ──────────────────────────────────────────

const subscriptionCancellationHtml = wrapInSesTemplate(`
    <h2>Monthly Giving Update</h2>
    <p>Dear {{firstName}},</p>
    <p>As per your request, we have cancelled your recurring monthly donation for <strong>{{appName}}</strong>.</p>

    <div class="warning-box" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid #64748b; padding: 20px;">
        <strong style="font-size: 18px;">🛑 Recurring Donation Auto-Pay Cancelled</strong><br><br>
        💰 <strong>Monthly Amount:</strong> {{currencySymbol}}{{amount}}<br>
        📅 <strong>Cancellation Date:</strong> {{cancelDate}}<br>
        {{#if hasDonationRef}}🧾 <strong>Reference:</strong> {{donationRef}}{{/if}}
    </div>

    <p>Your auto-pay has been stopped, and no further contributions will be processed automatically. We are deeply grateful for the support you have provided to our cows.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
            <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">🌾 <strong>Impact Made</strong></td>
            <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">🏥 <strong>Care Provided</strong></td>
        </tr>
        <tr>
            <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 0 8px;">🏠 <strong>Shelter Supported</strong></td>
            <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 8px 0;">💚 <strong>Lives Touched</strong></td>
        </tr>
    </table>

    <div class="info-box" style="background: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong>💖 Every Bit Counts</strong><br>
        While your monthly commitment has ended, you can still support us through one-time donations whenever you wish. Your kindness remains the foundation of our sanctuary.
    </div>

    <p style="text-align: center; margin-top: 24px;">
        <a href="{{frontendUrl}}/donations" class="button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">Continue Your Support</a>
    </p>

    <p>If you have any questions or would like to reactivate your recurring support in the future, we are always here for you.</p>

    <p class="text-muted">With gratitude,<br>The {{appName}} Team</p>
`, { title: 'Recurring Donation Cancelled' });

const mgm_subscription_cancellation = {
    TemplateName: 'mgm_subscription_cancellation',
    SubjectPart: 'Confirmation: Your recurring donation auto-pay has been cancelled',
    HtmlPart: subscriptionCancellationHtml,
    TextPart: stripToText(subscriptionCancellationHtml)
};

module.exports = [
    mgm_subscription_confirmation,
    mgm_subscription_cancellation
];
