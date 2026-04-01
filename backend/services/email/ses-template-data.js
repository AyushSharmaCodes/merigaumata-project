/**
 * SES Template Data Builders
 *
 * SES-managed templates need flat, fully prepared values. This module converts
 * the application's richer payloads into a deterministic SES-safe payload and
 * reports missing fields before we attempt a templated send.
 */

const { EmailEventTypes } = require('./types');

function getCommonBaseData() {
    return {
        appName: process.env.APP_NAME || 'MeriGauMata',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        year: String(new Date().getFullYear())
    };
}

function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(amount, currency = 'INR') {
    const numericAmount = toFiniteNumber(amount);
    if (numericAmount === null) return '';

    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numericAmount);
}

function formatDate(value, locale = 'en-IN') {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function formatTime(value, locale = 'en-IN') {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const stringValue = String(value).trim();
        if (stringValue) return stringValue;
    }
    return '';
}

function getFirstName(name, fallback = 'Customer') {
    const fullName = firstNonEmpty(name);
    if (!fullName) return fallback;
    return fullName.split(/\s+/)[0];
}

function getCurrencySymbol(currency = 'INR') {
    if (currency === 'INR') return '₹';
    if (currency === 'USD') return '$';
    return `${currency} `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildItemsTableHtml(items, currency = 'INR', currencySymbol = '₹') {
    if (!Array.isArray(items) || items.length === 0) return '';

    let html = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    html += '<tr style="background-color: #f8f9fa;">';
    html += '<th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>';
    html += '<th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>';
    html += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>';
    html += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>';
    html += '</tr>';

    items.forEach((item) => {
        const title = firstNonEmpty(
            item?.name,
            item?.title,
            item?.product?.title,
            item?.products?.title,
            'Product'
        );
        const quantity = toFiniteNumber(item?.quantity) || 1;
        const unitPrice = toFiniteNumber(
            item?.price_per_unit ??
            item?.price ??
            item?.selling_price ??
            item?.product_variants?.selling_price ??
            item?.variant_snapshot?.selling_price ??
            item?.variant?.selling_price
        ) || 0;
        const total = toFiniteNumber(item?.total_amount) ?? (unitPrice * quantity);

        html += '<tr>';
        html += `<td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${escapeHtml(title)}</td>`;
        html += `<td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${quantity}</td>`;
        html += `<td style="padding: 12px; text-align: right; border-bottom: 1px solid #e9ecef;">${currencySymbol}${formatCurrency(unitPrice, currency)}</td>`;
        html += `<td style="padding: 12px; text-align: right; border-bottom: 1px solid #e9ecef;"><strong>${currencySymbol}${formatCurrency(total, currency)}</strong></td>`;
        html += '</tr>';
    });

    html += '</table>';
    return html;
}

function buildAddressHtml(address) {
    if (!address) return 'Not available';
    if (typeof address === 'string') {
        return escapeHtml(address).replace(/\n/g, '<br>');
    }

    const lines = [];
    const name = firstNonEmpty(address.full_name, address.name, address.label);
    const addressLine1 = firstNonEmpty(address.street_address, address.address_line1, address.addressLine1, address.street);
    const addressLine2 = firstNonEmpty(address.apartment, address.address_line2, address.addressLine2);
    const locality = [
        firstNonEmpty(address.city),
        firstNonEmpty(address.state),
        firstNonEmpty(address.postal_code, address.postalCode, address.pinCode, address.zip)
    ].filter(Boolean).join(', ');
    const country = firstNonEmpty(address.country, 'India');
    const phone = firstNonEmpty(address.phone, address.phone_number);

    if (name) lines.push(`<strong>${escapeHtml(name)}</strong>`);
    if (addressLine1) lines.push(escapeHtml(addressLine1));
    if (addressLine2) lines.push(escapeHtml(addressLine2));
    if (locality) lines.push(escapeHtml(locality));
    if (country) lines.push(escapeHtml(country));
    if (phone) lines.push(`Phone: ${escapeHtml(phone)}`);

    return lines.join('<br>') || 'Not available';
}

function getOrderItems(order, context) {
    return context.items || context.orders || order?.items || order?.order_items || [];
}

function getPreferredCurrency(context, fallback = 'INR') {
    return firstNonEmpty(
        context.currency,
        context.preferredCurrency,
        context.preferred_currency,
        context.order?.currency,
        context.event?.currency,
        context.subscription?.currency,
        fallback
    ) || fallback;
}

function buildBaseData(context) {
    const preferredCurrency = getPreferredCurrency(context);

    return {
        ...getCommonBaseData(),
        currency: preferredCurrency,
        currencySymbol: getCurrencySymbol(preferredCurrency)
    };
}

function stringifyLeafValues(data) {
    const result = {};

    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
            result[key] = '';
            continue;
        }

        if (typeof value === 'boolean') {
            result[key] = value;
            continue;
        }

        if (typeof value === 'number') {
            result[key] = String(value);
            continue;
        }

        result[key] = value;
    }

    return result;
}

function buildRegistrationData(context) {
    return {
        firstName: getFirstName(context.name, 'Friend'),
        email: firstNonEmpty(context.email),
        joinedDate: formatDate(context.joinedDate || context.createdAt || new Date()),
        verificationLink: firstNonEmpty(context.verificationLink)
    };
}

function buildOrderData(context) {
    const order = context.order || {};
    const currency = getPreferredCurrency(context);
    const currencySymbol = getCurrencySymbol(currency);
    const refundAmount = context.refundAmount ?? order.refund_amount ?? order.total_amount;

    return {
        firstName: getFirstName(context.customerName, 'Customer'),
        orderNumber: firstNonEmpty(order.order_number, order.orderNumber, order.id),
        orderDate: formatDate(order.created_at || order.createdAt || context.orderDate || new Date()),
        deliveryDate: formatDate(order.delivered_at || order.updated_at || context.deliveryDate || new Date()),
        paymentId: firstNonEmpty(context.paymentId, order.payment_id, order.razorpay_payment_id),
        receiptUrl: firstNonEmpty(context.receiptUrl),
        invoiceUrl: firstNonEmpty(context.invoiceUrl),
        itemsTableHtml: buildItemsTableHtml(getOrderItems(order, context), currency, currencySymbol),
        shippingAddressHtml: buildAddressHtml(context.shippingAddress || order.shipping_address || order.shippingAddress),
        billingAddressHtml: buildAddressHtml(context.billingAddress || order.billing_address || order.billingAddress),
        refundAmount: refundAmount !== undefined && refundAmount !== null
            ? formatCurrency(refundAmount, currency)
            : '',
        hasRefund: refundAmount !== undefined && refundAmount !== null
    };
}

function buildEventRegistrationData(context) {
    const event = context.event || {};
    const registration = context.registration || {};
    const paymentDetails = context.paymentDetails || {};
    const amount = paymentDetails.totalAmount ?? paymentDetails.amount ?? registration.amount;

    return {
        firstName: getFirstName(context.attendeeName, 'Guest'),
        eventTitle: firstNonEmpty(event.title, event.name),
        eventId: firstNonEmpty(event.slug, event.id),
        eventCode: firstNonEmpty(event.event_code, event.code),
        dateStr: formatDate(event.start_date || event.event_date || event.date),
        timeStr: firstNonEmpty(event.time, formatTime(event.start_date || event.event_date || event.date)),
        locationStr: firstNonEmpty(event.location, event.venue, event.address, 'To be announced'),
        registrationId: firstNonEmpty(registration.registration_number, registration.id),
        description: firstNonEmpty(event.short_description, event.description),
        isPaid: Boolean(context.isPaid),
        basePrice: formatCurrency(paymentDetails.basePrice ?? event.base_price, getPreferredCurrency(context)),
        gstRate: firstNonEmpty(paymentDetails.gstRate, event.gst_rate),
        gstAmount: formatCurrency(paymentDetails.gstAmount ?? event.gst_amount, getPreferredCurrency(context)),
        totalAmount: formatCurrency(amount, getPreferredCurrency(context)),
        transactionId: firstNonEmpty(paymentDetails.transactionId, paymentDetails.paymentId, registration.payment_id),
        paymentDate: formatDate(paymentDetails.paymentDate || registration.paid_at || registration.created_at),
        invoiceUrl: firstNonEmpty(paymentDetails.invoiceUrl),
        receiptUrl: firstNonEmpty(paymentDetails.receiptUrl),
        hasPaymentDetails: Boolean(
            firstNonEmpty(paymentDetails.transactionId, paymentDetails.paymentId, paymentDetails.invoiceUrl, paymentDetails.receiptUrl)
        ),
        hasDescription: Boolean(firstNonEmpty(event.short_description, event.description))
    };
}

function buildEventCancellationData(context) {
    const event = context.event || {};
    const registration = context.registration || {};
    const refundDetails = context.refundDetails || {};

    return {
        firstName: getFirstName(context.attendeeName, 'Guest'),
        eventTitle: firstNonEmpty(event.title, event.name),
        eventDate: formatDate(event.start_date || event.event_date || event.date),
        locationStr: firstNonEmpty(event.location, event.venue, event.address, 'To be announced'),
        registrationId: firstNonEmpty(registration.registration_number, registration.id),
        cancelledDate: formatDate(context.cancelledDate || registration.cancelled_at || new Date()),
        cancellationReason: firstNonEmpty(refundDetails.reason, context.cancellationReason),
        refundAmount: formatCurrency(refundDetails.amount ?? context.refundAmount, getPreferredCurrency(context)),
        refundId: firstNonEmpty(refundDetails.refundId, refundDetails.id),
        initRefundAmount: formatCurrency(refundDetails.initiatedAmount, getPreferredCurrency(context)),
        refundReference: firstNonEmpty(refundDetails.reference, refundDetails.refundReference),
        hasCancellationReason: Boolean(firstNonEmpty(refundDetails.reason, context.cancellationReason)),
        hasRefundProcessed: Boolean(
            firstNonEmpty(refundDetails.refundId, refundDetails.id) &&
            (refundDetails.amount !== undefined && refundDetails.amount !== null)
        ),
        hasRefundInitiated: refundDetails.initiatedAmount !== undefined && refundDetails.initiatedAmount !== null
    };
}

function buildEventUpdateData(context) {
    const event = context.event || {};

    return {
        firstName: getFirstName(context.attendeeName, 'Guest'),
        eventTitle: firstNonEmpty(event.title, event.name),
        eventId: firstNonEmpty(event.slug, event.id),
        dateStr: formatDate(event.start_date || event.event_date || event.date),
        timeStr: firstNonEmpty(event.time, formatTime(event.start_date || event.event_date || event.date)),
        locationStr: firstNonEmpty(event.location, event.venue, event.address, 'To be announced'),
        updateReason: firstNonEmpty(context.updateReason, event.update_reason),
        hasUpdateReason: Boolean(firstNonEmpty(context.updateReason, event.update_reason))
    };
}

function buildDonationData(context) {
    const donation = context.donation || {};

    return {
        firstName: getFirstName(context.isAnonymous ? 'Valued Donor' : context.donorName, 'Valued Donor'),
        amount: formatCurrency(context.amount ?? donation.amount, getPreferredCurrency(context)),
        donationDate: formatDate(donation.created_at || donation.date || new Date()),
        donationId: firstNonEmpty(donation.receipt_id, donation.donationRef, donation.id),
        campaign: firstNonEmpty(donation.campaign_name, donation.campaign),
        hasCampaign: Boolean(firstNonEmpty(donation.campaign_name, donation.campaign))
    };
}

function buildSubscriptionData(context, { cancelled = false } = {}) {
    const subscription = context.subscription || {};

    return {
        firstName: getFirstName(context.isAnonymous ? 'Supporter' : context.donorName, 'Supporter'),
        amount: formatCurrency(subscription.amount, getPreferredCurrency(context)),
        startDate: formatDate(subscription.startDate || subscription.created_at || new Date()),
        nextBillingDate: formatDate(subscription.nextBillingDate || subscription.next_billing_date),
        cancelDate: formatDate(subscription.cancelDate || subscription.cancelled_at || new Date()),
        donationRef: firstNonEmpty(subscription.donationRef, subscription.reference),
        hasDonationRef: Boolean(firstNonEmpty(subscription.donationRef, subscription.reference)),
        cancelled
    };
}

function buildContactNotificationData(context) {
    const subject = firstNonEmpty(context.subject, 'General Inquiry');

    return {
        contactName: firstNonEmpty(context.name, 'Website Visitor'),
        contactEmail: firstNonEmpty(context.email),
        contactPhone: firstNonEmpty(context.phone, 'Not provided'),
        submittedDate: formatDate(context.submittedDate || new Date()),
        contactSubject: subject,
        contactSubjectLine: subject,
        contactMessage: firstNonEmpty(context.message, 'No message provided'),
        hasSubject: Boolean(subject)
    };
}

function buildContactAutoReplyData(context) {
    return {
        firstName: getFirstName(context.name, 'Friend')
    };
}

function buildAccountData(context) {
    return {
        firstName: getFirstName(context.name, 'there'),
        scheduledDate: firstNonEmpty(
            context.scheduledDate ? formatDate(context.scheduledDate) : '',
            context.scheduledDate
        ),
        otp: firstNonEmpty(context.otp),
        expiryMinutes: firstNonEmpty(context.expiryMinutes)
    };
}

function buildAuthData(context) {
    return {
        otp: firstNonEmpty(context.otp),
        expiryMinutes: firstNonEmpty(context.expiryMinutes),
        resetLink: firstNonEmpty(context.resetLink)
    };
}

function buildManagerData(context) {
    return {
        firstName: getFirstName(context.name, 'there'),
        email: firstNonEmpty(context.email),
        password: firstNonEmpty(context.password)
    };
}

const REQUIRED_FIELDS = {
    [EmailEventTypes.USER_REGISTRATION]: ['firstName', 'email', 'joinedDate'],
    [EmailEventTypes.EMAIL_CONFIRMATION]: ['firstName', 'verificationLink'],
    [EmailEventTypes.OTP_VERIFICATION]: ['otp', 'expiryMinutes'],
    [EmailEventTypes.PASSWORD_CHANGE_OTP]: ['otp', 'expiryMinutes'],
    [EmailEventTypes.PASSWORD_RESET]: ['resetLink'],
    [EmailEventTypes.ORDER_PLACED]: ['firstName', 'orderNumber', 'orderDate'],
    [EmailEventTypes.ORDER_CONFIRMED]: ['firstName', 'orderNumber', 'shippingAddressHtml', 'billingAddressHtml', 'itemsTableHtml'],
    [EmailEventTypes.ORDER_SHIPPED]: ['firstName', 'orderNumber'],
    [EmailEventTypes.ORDER_DELIVERED]: ['firstName', 'orderNumber', 'deliveryDate'],
    [EmailEventTypes.ORDER_CANCELLED]: ['firstName', 'orderNumber'],
    [EmailEventTypes.ORDER_RETURNED]: ['firstName', 'orderNumber'],
    [EmailEventTypes.EVENT_REGISTRATION]: ['firstName', 'eventTitle', 'dateStr', 'timeStr', 'locationStr', 'registrationId'],
    [EmailEventTypes.EVENT_CANCELLATION]: ['firstName', 'eventTitle', 'eventDate', 'locationStr', 'registrationId', 'cancelledDate'],
    [EmailEventTypes.EVENT_UPDATE]: ['firstName', 'eventTitle', 'dateStr', 'timeStr', 'locationStr'],
    [EmailEventTypes.DONATION_RECEIPT]: ['firstName', 'amount', 'donationDate', 'donationId'],
    [EmailEventTypes.SUBSCRIPTION_STARTED]: ['firstName', 'amount', 'startDate', 'nextBillingDate'],
    [EmailEventTypes.SUBSCRIPTION_CANCELLED]: ['firstName', 'amount', 'cancelDate'],
    [EmailEventTypes.CONTACT_NOTIFICATION]: ['contactName', 'contactEmail', 'contactPhone', 'submittedDate', 'contactSubjectLine', 'contactMessage'],
    [EmailEventTypes.CONTACT_FORM]: ['contactName', 'contactEmail', 'contactPhone', 'submittedDate', 'contactSubjectLine', 'contactMessage'],
    [EmailEventTypes.CONTACT_AUTO_REPLY]: ['firstName'],
    [EmailEventTypes.ACCOUNT_DELETED]: ['firstName'],
    [EmailEventTypes.ACCOUNT_DELETION_SCHEDULED]: ['firstName', 'scheduledDate'],
    [EmailEventTypes.ACCOUNT_DELETION_OTP]: ['otp', 'expiryMinutes'],
    [EmailEventTypes.MANAGER_WELCOME]: ['firstName', 'email', 'password']
};

function buildEventSpecificData(eventType, context) {
    switch (eventType) {
        case EmailEventTypes.USER_REGISTRATION:
        case EmailEventTypes.EMAIL_CONFIRMATION:
            return buildRegistrationData(context);

        case EmailEventTypes.OTP_VERIFICATION:
        case EmailEventTypes.PASSWORD_CHANGE_OTP:
        case EmailEventTypes.PASSWORD_RESET:
            return buildAuthData(context);

        case EmailEventTypes.ORDER_PLACED:
        case EmailEventTypes.ORDER_CONFIRMED:
        case EmailEventTypes.ORDER_SHIPPED:
        case EmailEventTypes.ORDER_DELIVERED:
        case EmailEventTypes.ORDER_CANCELLED:
        case EmailEventTypes.ORDER_RETURNED:
            return buildOrderData(context);

        case EmailEventTypes.EVENT_REGISTRATION:
            return buildEventRegistrationData(context);

        case EmailEventTypes.EVENT_CANCELLATION:
            return buildEventCancellationData(context);

        case EmailEventTypes.EVENT_UPDATE:
            return buildEventUpdateData(context);

        case EmailEventTypes.DONATION_RECEIPT:
            return buildDonationData(context);

        case EmailEventTypes.SUBSCRIPTION_STARTED:
            return buildSubscriptionData(context);

        case EmailEventTypes.SUBSCRIPTION_CANCELLED:
            return buildSubscriptionData(context, { cancelled: true });

        case EmailEventTypes.CONTACT_FORM:
        case EmailEventTypes.CONTACT_NOTIFICATION:
            return buildContactNotificationData(context);

        case EmailEventTypes.CONTACT_AUTO_REPLY:
            return buildContactAutoReplyData(context);

        case EmailEventTypes.ACCOUNT_DELETED:
        case EmailEventTypes.ACCOUNT_DELETION_SCHEDULED:
        case EmailEventTypes.ACCOUNT_DELETION_OTP:
            return buildAccountData(context);

        case EmailEventTypes.MANAGER_WELCOME:
            return buildManagerData(context);

        default:
            return {};
    }
}

function buildSesTemplateData(eventType, context = {}) {
    const combined = stringifyLeafValues({
        ...buildBaseData(context),
        ...buildEventSpecificData(eventType, context)
    });

    const requiredFields = REQUIRED_FIELDS[eventType] || [];
    const missingFields = requiredFields.filter((field) => !firstNonEmpty(combined[field]));

    return {
        templateData: combined,
        missingFields
    };
}

module.exports = {
    buildSesTemplateData,
    buildItemsTableHtml,
    buildAddressHtml,
    formatCurrency,
    formatDate,
    formatTime
};
