/**
 * SES Template Data Builders
 *
 * SES templates do not support complex operations (like date formatting, currency
 * formatting, or dynamic HTML generation). These builders take raw application data
 * and pre-compute all variables required by the SES handlebars templates.
 */

const { format } = require('date-fns');

/**
 * Common template data injected into every SES email
 */
function getCommonBaseData() {
    return {
        appName: process.env.APP_NAME || 'MeriGauMata',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        year: new Date().getFullYear(),
    };
}

/**
 * Format currency
 * Uses preferred currency passed in context, defaulting to INR
 */
function formatCurrency(amount, currency = 'INR') {
    if (amount === undefined || amount === null) return '';
    const formatter = new Intl.NumberFormat('en-IN', {
         minimumFractionDigits: 2,
         maximumFractionDigits: 2
    });
    return formatter.format(amount);
}

/**
 * Build pre-rendered HTML for order items table
 */
function buildItemsTableHtml(items, currency = 'INR', currencySymbol = '₹') {
    if (!items || !items.length) return '';

    let html = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    html += '<tr style="background-color: #f8f9fa;">';
    html += '<th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>';
    html += '<th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>';
    html += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>';
    html += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>';
    html += '</tr>';

    let subtotal = 0;

    items.forEach(item => {
        const itemPrice = parseFloat(item.price || 0);
        const itemTotal = itemPrice * (item.quantity || 1);
        subtotal += itemTotal;

        html += '<tr>';
        html += `<td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${item.name || 'Product'}</td>`;
        html += `<td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${item.quantity || 1}</td>`;
        html += `<td style="padding: 12px; text-align: right; border-bottom: 1px solid #e9ecef;">${currencySymbol}${formatCurrency(itemPrice, currency)}</td>`;
        html += `<td style="padding: 12px; text-align: right; border-bottom: 1px solid #e9ecef;"><strong>${currencySymbol}${formatCurrency(itemTotal, currency)}</strong></td>`;
        html += '</tr>';
    });

    html += '</table>';
    return html;
}

/**
 * Build pre-rendered HTML for address
 */
function buildAddressHtml(address) {
    if (!address) return 'Not available';
    if (typeof address === 'string') return address.replace(/\\n/g, '<br>');

    const parts = [];
    if (address.name) parts.push(`<strong>${address.name}</strong>`);
    if (address.addressLine1 || address.street) parts.push(address.addressLine1 || address.street);
    if (address.addressLine2 || address.apartment) parts.push(address.addressLine2 || address.apartment);
    if (address.city || address.state || address.pinCode || address.zip) {
        let cityStateZip = [];
        if (address.city) cityStateZip.push(address.city);
        if (address.state) cityStateZip.push(address.state);
        if (address.pinCode || address.zip) cityStateZip.push(address.pinCode || address.zip);
        parts.push(cityStateZip.join(', '));
    }
    if (address.country) parts.push(address.country);

    return parts.join('<br>');
}

/**
 * Main builder function: prepares template data based on event type
 * @param {string} eventType - The EmailEventType
 * @param {object} context - Raw data context from backend
 * @returns {object} Flattened data object for SES templates
 */
function buildSesTemplateData(eventType, context) {
    const data = { ...getCommonBaseData(), ...context };

    // Standardize currency handling across templates
    const preferredCurrency = context.currency || context.preferredCurrency || context.preferred_currency || 'INR';
    data.currencySymbol = preferredCurrency === 'INR' ? '₹' : (preferredCurrency === 'USD' ? '$' : preferredCurrency);

    // Format dates if they exist in context
    if (context.date && typeof context.date !== 'string') {
        try {
            data.dateStr = format(new Date(context.date), 'MMMM dd, yyyy');
        } catch (e) {
            data.dateStr = String(context.date);
        }
    }

    if (context.amount !== undefined) {
        data.amount = formatCurrency(parseFloat(context.amount), preferredCurrency);
    }

    // Specific formatting per context attributes
    if (context.orders && Array.isArray(context.orders)) {
         data.itemsTableHtml = buildItemsTableHtml(context.orders, preferredCurrency, data.currencySymbol);
    }
    else if (context.items && Array.isArray(context.items)) {
         data.itemsTableHtml = buildItemsTableHtml(context.items, preferredCurrency, data.currencySymbol);
    }

    if (context.shippingAddress) {
        data.shippingAddressHtml = buildAddressHtml(context.shippingAddress);
    }

    if (context.billingAddress) {
        data.billingAddressHtml = buildAddressHtml(context.billingAddress);
    }

    // Handle generic formatting safely
    for (const key of Object.keys(data)) {
        if (typeof data[key] === 'number') {
           data[key] = String(data[key]); // Ensure all types are string compatible for Handlebars
        }
    }

    // specific pre-computed booleans based on existence of values (for Handlebars {{#if}})
    data.hasPaymentDetails = !!context.transactionId || !!context.paymentId;
    data.hasDescription = !!context.description;
    data.hasCancellationReason = !!context.cancellationReason;
    data.hasRefundProcessed = !!context.refundId && !!context.refundAmount;
    data.hasRefundInitiated = !!context.initRefundAmount;
    data.hasUpdateReason = !!context.updateReason;
    data.hasCampaign = !!context.campaign;
    data.hasDonationRef = !!context.donationRef;
    data.hasSubject = !!context.contactSubject;
    data.hasRefund = !!context.refundAmount;

    return data;
}

module.exports = {
    buildSesTemplateData,
    buildItemsTableHtml,
    buildAddressHtml,
    formatCurrency
};
