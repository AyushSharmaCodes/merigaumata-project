const { wrapInTemplate } = require('./base.template');
const {
    buildGreeting,
    firstNonEmpty,
    formatCurrency,
    formatDate,
    normalizeAddress,
    getOrderNumber,
    renderOrderItemsTable,
    buildActionButton
} = require('./template.utils');

function renderAddressColumns(order) {
    const shipping = normalizeAddress(order?.shipping_address || order?.shippingAddress);
    const billing = normalizeAddress(order?.billing_address || order?.billingAddress);

    return `<table>
        <thead>
            <tr>
                <th>Shipping address</th>
                <th>Billing address</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${shipping || 'Not available'}</td>
                <td>${billing || 'Not available'}</td>
            </tr>
        </tbody>
    </table>`;
}

function getOrderPlacedEmail({ order, customerName, receiptUrl, paymentId }) {
    const content = `
        <h2>Order received</h2>
        <p>${buildGreeting(customerName, 'customer')}</p>
        <p>We received your order <strong>#${getOrderNumber(order)}</strong> and it is now pending review.</p>
        <div class="panel panel-success">
            <p><strong>Order details</strong></p>
            <p>Order number: ${getOrderNumber(order)}</p>
            <p>Order date: ${formatDate(order?.created_at || order?.createdAt || new Date())}</p>
            ${paymentId ? `<p>Transaction ID: ${paymentId}</p>` : ''}
        </div>
        ${receiptUrl ? buildActionButton('Download payment receipt', receiptUrl) : ''}
        <p class="muted">We will notify you again once the order is confirmed.</p>
    `;

    return {
        subject: `Order placed - #${getOrderNumber(order)}`,
        html: wrapInTemplate(content, { title: 'Order received', preheader: `We received order #${getOrderNumber(order)}.` })
    };
}

function getOrderConfirmedEmail({ order, customerName }) {
    const content = `
        <h2>Order confirmed</h2>
        <p>${buildGreeting(customerName, 'customer')}</p>
        <p>Your order <strong>#${getOrderNumber(order)}</strong> has been confirmed and is being prepared.</p>
        <div class="panel">${renderAddressColumns(order)}</div>
        <div class="panel">
            <p><strong>Order items</strong></p>
            ${renderOrderItemsTable(order)}
        </div>
    `;

    return {
        subject: `Order confirmed - #${getOrderNumber(order)}`,
        html: wrapInTemplate(content, { title: 'Order confirmed', preheader: `Order #${getOrderNumber(order)} has been confirmed.` })
    };
}

function getOrderShippedEmail({ order, customerName }) {
    const content = `
        <h2>Order shipped</h2>
        <p>${buildGreeting(customerName, 'customer')}</p>
        <p>Your order <strong>#${getOrderNumber(order)}</strong> is on the way.</p>
        <div class="panel panel-success">
            <p><strong>Shipping update</strong></p>
            <p>Order number: ${getOrderNumber(order)}</p>
            <p>Status: Shipped</p>
        </div>
        <p class="muted">You can continue tracking the order from your account or order history page.</p>
    `;

    return {
        subject: `Order shipped - #${getOrderNumber(order)}`,
        html: wrapInTemplate(content, { title: 'Order shipped', preheader: `Order #${getOrderNumber(order)} is on the way.` })
    };
}

function getOrderDeliveredEmail({ order, customerName, invoiceUrl }) {
    const content = `
        <h2>Order delivered</h2>
        <p>${buildGreeting(customerName, 'customer')}</p>
        <p>Your order <strong>#${getOrderNumber(order)}</strong> has been delivered successfully.</p>
        <div class="panel panel-success">
            <p><strong>Delivery details</strong></p>
            <p>Order number: ${getOrderNumber(order)}</p>
            <p>Delivered on: ${formatDate(order?.delivered_at || order?.updated_at || new Date())}</p>
        </div>
        ${invoiceUrl ? buildActionButton('Download invoice', invoiceUrl) : ''}
    `;

    return {
        subject: `Order delivered - #${getOrderNumber(order)}`,
        html: wrapInTemplate(content, { title: 'Order delivered', preheader: `Order #${getOrderNumber(order)} has been delivered.` })
    };
}

function getOrderCancellationEmail({ order, customerName, refundAmount }) {
    const resolvedRefund = refundAmount ?? order?.refund_amount ?? order?.total_amount;
    const content = `
        <h2>Order cancelled</h2>
        <p>${buildGreeting(customerName, 'customer')}</p>
        <p>Your order <strong>#${getOrderNumber(order)}</strong> has been cancelled.</p>
        <div class="panel panel-warning">
            <p><strong>Cancellation details</strong></p>
            <p>Order number: ${getOrderNumber(order)}</p>
            ${resolvedRefund !== undefined && resolvedRefund !== null ? `<p>Refund amount: ${formatCurrency(resolvedRefund)}</p>` : ''}
        </div>
        <p class="muted">If a refund applies, it will be credited back to the original payment method according to your payment provider timeline.</p>
    `;

    return {
        subject: `Order cancelled - #${getOrderNumber(order)}`,
        html: wrapInTemplate(content, { title: 'Order cancelled', preheader: `Order #${getOrderNumber(order)} has been cancelled.` })
    };
}

function getOrderReturnedEmail({ order, customerName }) {
    const content = `
        <h2>Return completed</h2>
        <p>${buildGreeting(customerName, 'customer')}</p>
        <p>Your returned items for order <strong>#${getOrderNumber(order)}</strong> have been received and processed.</p>
        <div class="panel">
            <p><strong>Return details</strong></p>
            <p>Order number: ${getOrderNumber(order)}</p>
            <p>Status: Returned</p>
        </div>
        <p class="muted">If a refund applies, it will continue through the normal refund process.</p>
    `;

    return {
        subject: `Return completed - #${getOrderNumber(order)}`,
        html: wrapInTemplate(content, { title: 'Return completed', preheader: `Your return for order #${getOrderNumber(order)} has been processed.` })
    };
}

module.exports = {
    getOrderPlacedEmail,
    getOrderConfirmedEmail,
    getOrderShippedEmail,
    getOrderDeliveredEmail,
    getOrderCancellationEmail,
    getOrderReturnedEmail
};
