/**
 * SES Templates: Orders
 * Templates: mgm_order_placed, mgm_order_confirmed, mgm_order_shipped,
 *            mgm_order_delivered, mgm_order_cancelled, mgm_order_returned
 *
 * Note: Complex dynamic sections (items table, addresses) are pre-rendered
 *       in the data builder and injected via {{{itemsTableHtml}}}, {{{shippingAddressHtml}}}, etc.
 *       Triple-brace {{{ }}} tells Handlebars NOT to escape the HTML.
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_order_placed ────────────────────────────────────────────────────────

const orderPlacedHtml = wrapInSesTemplate(`
    <h2>Order Received! 🛍️</h2>
    <p>Hi {{firstName}},</p>
    <p>Thank you for shopping with us! We have received your order <strong>#{{orderNumber}}</strong> and it is currently under review.</p>

    <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>Order Status:</strong> PENDING CONFIRMATION<br>
        <strong>Order Date:</strong> {{orderDate}}<br>
        {{#if paymentId}}<strong>Transaction ID:</strong> {{paymentId}}{{/if}}
    </div>

    {{#if receiptUrl}}
    <div style="margin: 30px 0; text-align: center;">
        <a href="{{receiptUrl}}" style="background-color: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
            📄 Download Payment Receipt
        </a>
        <p style="margin-top: 12px; font-size: 13px; color: #666;">Your payment receipt is ready for download.</p>
    </div>
    {{/if}}

    <p>Our team will verify the details and notify you once the order is confirmed.</p>
    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Order Received' });

const mgm_order_placed = {
    TemplateName: 'mgm_order_placed',
    SubjectPart: 'Order Placed - #{{orderNumber}}',
    HtmlPart: orderPlacedHtml,
    TextPart: stripToText(orderPlacedHtml)
};

// ─── mgm_order_confirmed ─────────────────────────────────────────────────────

const orderConfirmedHtml = wrapInSesTemplate(`
    <h2>Order Confirmed! 🎉</h2>
    <p>Great news {{firstName}}!</p>
    <p>Your order <strong>#{{orderNumber}}</strong> has been confirmed and is being prepared for shipping.</p>

    <div style="margin: 25px 0;">
        <div style="display: flex; gap: 20px;">
            <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="margin-top: 0; color: #4a5568;">Shipping Address</h4>
                <p style="font-size: 13px; color: #2d3748; margin-bottom: 0;">{{{shippingAddressHtml}}}</p>
            </div>
            <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="margin-top: 0; color: #4a5568;">Billing Address</h4>
                <p style="font-size: 13px; color: #2d3748; margin-bottom: 0;">{{{billingAddressHtml}}}</p>
            </div>
        </div>
    </div>

    <h3>Order Summary</h3>
    {{{itemsTableHtml}}}

    <p style="margin-top: 20px;">We will notify you as soon as your order leaves our warehouse.</p>
    <p class="text-muted">Thank you for your patience!<br>The {{appName}} Team</p>
`, { title: 'Order Confirmed' });

const mgm_order_confirmed = {
    TemplateName: 'mgm_order_confirmed',
    SubjectPart: 'Order Confirmed - #{{orderNumber}}',
    HtmlPart: orderConfirmedHtml,
    TextPart: stripToText(orderConfirmedHtml)
};

// ─── mgm_order_shipped ───────────────────────────────────────────────────────

const orderShippedHtml = wrapInSesTemplate(`
    <h2>Order Shipped! 🚚</h2>
    <p>Hi {{firstName}},</p>
    <p>Your order <strong>#{{orderNumber}}</strong> is on its way!</p>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
        <h3 style="margin: 0; color: #92400e;">Expected Delivery</h3>
        <p style="font-size: 18px; font-weight: bold; color: #b45309; margin: 10px 0;">1 - 2 Weeks</p>
        <p style="margin: 0; font-size: 13px; color: #d97706;">We're working hard to get your Gau Mata products to you as soon as possible.</p>
    </div>

    <p>You can track your order status anytime by visiting our website.</p>
    <p class="text-muted">Happy waiting!<br>The {{appName}} Team</p>
`, { title: 'Order Shipped' });

const mgm_order_shipped = {
    TemplateName: 'mgm_order_shipped',
    SubjectPart: 'Order Shipped - #{{orderNumber}}',
    HtmlPart: orderShippedHtml,
    TextPart: stripToText(orderShippedHtml)
};

// ─── mgm_order_delivered ─────────────────────────────────────────────────────

const orderDeliveredHtml = wrapInSesTemplate(`
    <h2>Order Delivered! 📦</h2>
    <p>Hi {{firstName}},</p>
    <p>Your order <strong>#{{orderNumber}}</strong> has been successfully delivered. We hope you love your products!</p>

    <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; color: #065f46;">
        <strong>Status:</strong> DELIVERED<br>
        <strong>Delivery Date:</strong> {{deliveryDate}}
    </div>

    {{#if invoiceUrl}}
    <div style="margin: 30px 0; text-align: center;">
        <a href="{{invoiceUrl}}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.25);">
            📄 Download Official GST Invoice
        </a>
        <p style="margin-top: 12px; font-size: 13px; color: #666;">Your tax invoice is now available for download.</p>
    </div>
    {{/if}}

    <p>We would love to hear your feedback. Feel free to reply to this email or leave a review on our website.</p>
    <p class="text-muted">Thank you for being a part of the {{appName}} family!<br>The {{appName}} Team</p>
`, { title: 'Order Delivered' });

const mgm_order_delivered = {
    TemplateName: 'mgm_order_delivered',
    SubjectPart: 'Order Delivered - #{{orderNumber}}',
    HtmlPart: orderDeliveredHtml,
    TextPart: stripToText(orderDeliveredHtml)
};

// ─── mgm_order_cancelled ─────────────────────────────────────────────────────

const orderCancelledHtml = wrapInSesTemplate(`
    <h2>Order Cancelled 🛑</h2>
    <p>Hi {{firstName}},</p>
    <p>As requested, your order <strong>#{{orderNumber}}</strong> has been cancelled.</p>

    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; color: #991b1b;">
        <strong>Status:</strong> CANCELLED
    </div>

    {{#if hasRefund}}
    <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="margin: 0; color: #374151; font-size: 14px;">
            <strong>Refund Information:</strong><br>
            A refund of <strong>{{currencySymbol}}{{refundAmount}}</strong> has been initiated to your original payment method. It usually takes 5-7 business days to reflect in your account.
        </p>
    </div>
    {{/if}}

    <p style="margin-top: 25px;">If you have any questions, please reach out to our support team.</p>
    <p class="text-muted">We hope to see you again soon.<br>The {{appName}} Team</p>
`, { title: 'Order Cancelled' });

const mgm_order_cancelled = {
    TemplateName: 'mgm_order_cancelled',
    SubjectPart: 'Order Cancelled - #{{orderNumber}}',
    HtmlPart: orderCancelledHtml,
    TextPart: stripToText(orderCancelledHtml)
};

// ─── mgm_order_returned ──────────────────────────────────────────────────────

const orderReturnedHtml = wrapInSesTemplate(`
    <h2>Return Completed 📦</h2>
    <p>Hi {{firstName}},</p>
    <p>Your returned items for order <strong>#{{orderNumber}}</strong> have been received and processed at our warehouse.</p>

    <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0; color: #374151;">
        <strong>Status:</strong> RETURNED
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="margin: 0; color: #374151; font-size: 14px;">
            <strong>Next Steps:</strong><br>
            Your refund (if applicable) is being processed. You can check the details on your order history page.
        </p>
    </div>

    <p class="text-muted" style="margin-top: 25px;">The {{appName}} Team</p>
`, { title: 'Return Processed' });

const mgm_order_returned = {
    TemplateName: 'mgm_order_returned',
    SubjectPart: 'Return Processed - #{{orderNumber}}',
    HtmlPart: orderReturnedHtml,
    TextPart: stripToText(orderReturnedHtml)
};

module.exports = [
    mgm_order_placed,
    mgm_order_confirmed,
    mgm_order_shipped,
    mgm_order_delivered,
    mgm_order_cancelled,
    mgm_order_returned
];
