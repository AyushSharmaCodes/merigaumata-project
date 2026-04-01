const { APP_NAME, FRONTEND_URL } = require('./base.template');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const trimmed = String(value).trim();
        if (trimmed) return trimmed;
    }
    return '';
}

function getFirstName(name, fallback = 'there') {
    const fullName = firstNonEmpty(name);
    if (!fullName) return fallback;
    return fullName.split(/\s+/)[0];
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getCurrencySymbol(currency = 'INR') {
    if (currency === 'USD') return '$';
    if (currency === 'EUR') return 'EUR ';
    if (currency === 'GBP') return 'GBP ';
    return currency === 'INR' ? '₹' : `${currency} `;
}

function getCurrencyContext(data = {}, ...fallbackSources) {
    const currency = firstNonEmpty(
        data.currency,
        data.display_currency,
        data.preferredCurrency,
        data.preferred_currency,
        ...fallbackSources.flatMap((source) => (source ? [
            source.currency,
            source.display_currency,
            source.preferredCurrency,
            source.preferred_currency
        ] : [])),
        'INR'
    ) || 'INR';

    const rate = Math.max(
        toNumber(
            data.rate ??
            data.currencyRate ??
            data.exchangeRate ??
            data.currency_rate ??
            data.exchange_rate,
            1
        ),
        0.000001
    );

    return {
        currency,
        currencySymbol: getCurrencySymbol(currency),
        rate
    };
}

function formatCurrency(amount, currency = 'INR', conversionRate = 1) {
    const currencySymbol = getCurrencySymbol(currency);
    const convertedAmount = toNumber(amount, 0) * toNumber(conversionRate, 1);

    return `${currencySymbol}${new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(convertedAmount)}`;
}

function formatDate(value, options = {}) {
    if (!value) return 'Not available';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        ...options
    }).format(date);
}

function formatDateTime(value) {
    if (!value) return 'Not available';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function formatTime(value) {
    if (!value) return 'Not available';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function buildGreeting(name, fallback = 'there') {
    return `Hello ${escapeHtml(getFirstName(name, fallback))},`;
}

function renderDetailList(items) {
    const rows = items
        .filter((item) => firstNonEmpty(item.value))
        .map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.value}</li>`)
        .join('');

    return rows ? `<ul class="detail-list">${rows}</ul>` : '';
}

function normalizeAddress(address) {
    if (!address) return '';
    if (typeof address === 'string') return escapeHtml(address).replace(/\n/g, '<br>');

    const lines = [
        firstNonEmpty(address.full_name, address.name, address.label),
        firstNonEmpty(address.street_address, address.address_line1, address.addressLine1, address.street),
        firstNonEmpty(address.apartment, address.address_line2, address.addressLine2),
        [
            firstNonEmpty(address.city),
            firstNonEmpty(address.state),
            firstNonEmpty(address.postal_code, address.postalCode, address.pinCode, address.zip)
        ].filter(Boolean).join(', '),
        firstNonEmpty(address.country, 'India'),
        firstNonEmpty(address.phone, address.phone_number) ? `Phone: ${firstNonEmpty(address.phone, address.phone_number)}` : ''
    ].filter(Boolean);

    return lines.map((line) => escapeHtml(line)).join('<br>');
}

function getOrderNumber(order) {
    return firstNonEmpty(order?.order_number, order?.orderNumber, order?.id, 'Not available');
}

function getOrderItems(order) {
    return order?.items || order?.order_items || [];
}

function getItemTitle(item) {
    return firstNonEmpty(
        item?.product?.title,
        item?.products?.title,
        item?.title,
        item?.name,
        'Product'
    );
}

function renderOrderItemsTable(order, currencyOptions = {}) {
    const items = getOrderItems(order);
    if (!items.length) return '<p class="muted">No line items were found for this order.</p>';
    const { currency, rate } = getCurrencyContext(currencyOptions, order);

    const rows = items.map((item) => {
        const quantity = toNumber(item.quantity, 1);
        const unitPrice = toNumber(
            item.price_per_unit ??
            item.price ??
            item.selling_price ??
            item.product_variants?.selling_price ??
            item.variant_snapshot?.selling_price ??
            item.variant?.selling_price,
            0
        );
        const lineTotal = item.total_amount !== undefined ? toNumber(item.total_amount, 0) : unitPrice * quantity;
        const variantLabel = firstNonEmpty(item?.variant_snapshot?.size_label, item?.variant?.size_label, item?.product_variants?.size_label);

        return `<tr>
            <td>${escapeHtml(getItemTitle(item))}${variantLabel ? `<div class="muted">${escapeHtml(variantLabel)}</div>` : ''}</td>
            <td>${quantity}</td>
            <td>${formatCurrency(unitPrice, currency, rate)}</td>
            <td>${formatCurrency(lineTotal, currency, rate)}</td>
        </tr>`;
    }).join('');

    return `<table>
        <thead>
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function getLocationString(location) {
    if (!location) return 'To be announced';
    if (typeof location === 'string') return location;
    const parts = [
        firstNonEmpty(location.venue),
        firstNonEmpty(location.address),
        firstNonEmpty(location.city),
        firstNonEmpty(location.name)
    ].filter(Boolean);
    return parts.join(', ') || 'To be announced';
}

function buildActionButton(label, href) {
    if (!firstNonEmpty(href)) return '';
    return `<p style="margin: 24px 0;"><a href="${href}" class="button">${escapeHtml(label)}</a></p>`;
}

module.exports = {
    APP_NAME,
    FRONTEND_URL,
    escapeHtml,
    firstNonEmpty,
    getFirstName,
    toNumber,
    getCurrencySymbol,
    getCurrencyContext,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatTime,
    buildGreeting,
    renderDetailList,
    normalizeAddress,
    getOrderNumber,
    getOrderItems,
    renderOrderItemsTable,
    getLocationString,
    buildActionButton
};
