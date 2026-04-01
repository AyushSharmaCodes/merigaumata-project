const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { buildGreeting, firstNonEmpty, getCurrencyContext, formatCurrency, formatDate, buildActionButton } = require('./template.utils');

function getDonationReceiptEmail({ donation, donorName, isAnonymous = false }) {
    const displayName = isAnonymous ? 'Supporter' : firstNonEmpty(donorName, 'Supporter');
    const donationId = firstNonEmpty(donation?.receipt_id, donation?.donationRef, donation?.id, 'Not available');
    const campaign = firstNonEmpty(donation?.campaign_name, donation?.campaign);
    const { currency, rate } = getCurrencyContext(arguments[0], donation);

    const content = `
        <h2>Thank you for your donation</h2>
        <p>${buildGreeting(displayName, 'supporter')}</p>
        <p>We appreciate your support. Your contribution helps us continue our work and care programs.</p>
        <div class="panel panel-success">
            <p><strong>Donation details</strong></p>
            <p>Amount: ${formatCurrency(donation?.amount, currency, rate)}</p>
            <p>Date: ${formatDate(donation?.created_at || donation?.createdAt || donation?.date || new Date())}</p>
            <p>Receipt ID: ${donationId}</p>
            ${campaign ? `<p>Campaign: ${campaign}</p>` : ''}
        </div>
        <p class="muted">Please keep this email for your records. It may be useful for future reference and tax documentation.</p>
    `;

    return {
        subject: `Donation receipt ${donationId} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Donation receipt', preheader: 'Thank you for your donation.' })
    };
}

function getSubscriptionConfirmationEmail({ subscription, donorName, isAnonymous = false }) {
    const displayName = isAnonymous ? 'Supporter' : firstNonEmpty(donorName, 'Supporter');
    const { currency, rate } = getCurrencyContext(arguments[0], subscription);

    const content = `
        <h2>Monthly donation activated</h2>
        <p>${buildGreeting(displayName, 'supporter')}</p>
        <p>Your recurring donation has been set up successfully.</p>
        <div class="panel panel-success">
            <p><strong>Subscription details</strong></p>
            <p>Amount: ${formatCurrency(subscription?.amount, currency, rate)}</p>
            <p>Started: ${formatDate(subscription?.startDate || subscription?.created_at || new Date())}</p>
            <p>Next contribution: ${formatDate(subscription?.nextBillingDate || subscription?.next_billing_date)}</p>
            ${subscription?.donationRef ? `<p>Reference: ${subscription.donationRef}</p>` : ''}
        </div>
        <p>You can review or manage your recurring support from your profile dashboard.</p>
        ${buildActionButton('Open Donations Page', `${FRONTEND_URL}/donations`)}
    `;

    return {
        subject: `Monthly donation started - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Monthly donation started', preheader: 'Your recurring donation is active.' })
    };
}

function getSubscriptionCancellationEmail({ subscription, donorName }) {
    const { currency, rate } = getCurrencyContext(arguments[0], subscription);
    const content = `
        <h2>Recurring donation cancelled</h2>
        <p>${buildGreeting(donorName, 'supporter')}</p>
        <p>Your recurring donation has been cancelled as requested. No future automatic payments will be processed.</p>
        <div class="panel panel-warning">
            <p><strong>Cancellation details</strong></p>
            <p>Amount: ${formatCurrency(subscription?.amount, currency, rate)}</p>
            <p>Cancelled on: ${formatDate(subscription?.cancelDate || subscription?.cancelled_at || new Date())}</p>
            ${subscription?.donationRef ? `<p>Reference: ${subscription.donationRef}</p>` : ''}
        </div>
        ${buildActionButton('Make a one-time donation', `${FRONTEND_URL}/donations`)}
    `;

    return {
        subject: `Recurring donation cancelled - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Recurring donation cancelled', preheader: 'Your recurring donation has been cancelled.' })
    };
}

module.exports = {
    getDonationReceiptEmail,
    getSubscriptionConfirmationEmail,
    getSubscriptionCancellationEmail
};
