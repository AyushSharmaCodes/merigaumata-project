/**
 * SES Templates: Events
 * Templates: mgm_event_registration, mgm_event_cancellation, mgm_event_update
 */

const { wrapInSesTemplate, stripToText } = require('./_base');

// ─── mgm_event_registration ─────────────────────────────────────────────────

const eventRegistrationHtml = wrapInSesTemplate(`
    <h2>You're Registered! 🎟️</h2>
    <p>Dear {{firstName}},</p>
    <p>Your registration for <strong>{{eventTitle}}</strong> has been confirmed.</p>

    <div class="success-box">
        <strong>Event Details:</strong><br>
        📅 Date: {{dateStr}}<br>
        🕐 Time: {{timeStr}}<br>
        📍 Location: {{locationStr}}<br>
        🎫 Registration ID: {{registrationId}}
        {{#if eventCode}}<br>🆔 Event ID: {{eventCode}}{{/if}}
    </div>

    {{#if isPaid}}
        {{#if hasPaymentDetails}}
        <div class="info-box">
            <strong>Payment Details (Inclusive of all taxes):</strong><br>
            💵 Base Price: {{currencySymbol}}{{basePrice}}<br>
            🧾 GST ({{gstRate}}%): {{currencySymbol}}{{gstAmount}}<br>
            💰 Total Amount Paid: {{currencySymbol}}{{totalAmount}}<br>
            🔗 Transaction ID: {{transactionId}}<br>
            📅 Payment Date: {{paymentDate}}
            {{#if invoiceUrl}}<br><br><a href="{{invoiceUrl}}" style="color: #667eea; text-decoration: underline;">📄 Download Receipt</a>{{/if}}
            {{#if receiptUrl}}<br><a href="{{receiptUrl}}" style="color: #667eea; text-decoration: underline;">🧾 Download Payment Receipt</a>{{/if}}
        </div>
        {{/if}}
    {{else}}
        <div class="info-box">
            <strong>🎉 This is a FREE event!</strong><br>
            No payment required.
        </div>
    {{/if}}

    {{#if hasDescription}}
    <p style="color: #666;">{{description}}</p>
    {{/if}}

    <p style="text-align: center;">
        <a href="{{frontendUrl}}/event/{{eventId}}" class="button">View Event Details</a>
    </p>

    <p>We look forward to seeing you there!</p>
    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Event Registration Confirmed' });

const mgm_event_registration = {
    TemplateName: 'mgm_event_registration',
    SubjectPart: 'Registration Confirmed - {{eventTitle}}',
    HtmlPart: eventRegistrationHtml,
    TextPart: stripToText(eventRegistrationHtml)
};

// ─── mgm_event_cancellation ─────────────────────────────────────────────────

const eventCancellationHtml = wrapInSesTemplate(`
    <h2>Registration Cancelled</h2>
    <p>Dear {{firstName}},</p>
    <p>This is to inform you that your registration for <strong>{{eventTitle}}</strong> has been cancelled.</p>

    {{#if hasCancellationReason}}
    <div class="warning-box">
        <strong>Reason for Cancellation:</strong><br>
        {{cancellationReason}}
    </div>
    {{/if}}

    <div class="info-box">
        <strong>Cancelled Registration Details:</strong><br>
        📅 Event Date: {{eventDate}}<br>
        📍 Location: {{locationStr}}<br>
        🎫 Registration ID: {{registrationId}}<br>
        ❌ Cancelled On: {{cancelledDate}}
    </div>

    {{#if hasRefundProcessed}}
    <div class="success-box">
        <strong>Refund Processed:</strong><br>
        💰 Refund Amount: {{currencySymbol}}{{refundAmount}}<br>
        🏦 Refund ID: {{refundId}}<br>
        📅 Expected Credit: 5-7 business days
    </div>
    {{/if}}

    {{#if hasRefundInitiated}}
    <div class="info-box">
        <strong>Refund Status: Initiated</strong><br>
        Your refund of {{currencySymbol}}{{initRefundAmount}} has been initiated.<br>
        It will be credited to your original payment method within 5-7 business days.
        {{#if refundReference}}<br><small style="color: #666;">Reference: {{refundReference}}</small>{{/if}}
    </div>
    {{/if}}

    <p>We're sorry for any inconvenience caused. If you have any questions or would like to browse other events, please visit our website.</p>

    <p style="text-align: center;">
        <a href="{{frontendUrl}}/events" class="button">Browse Other Events</a>
    </p>

    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Event Cancellation' });

const mgm_event_cancellation = {
    TemplateName: 'mgm_event_cancellation',
    SubjectPart: 'Registration Cancelled - {{eventTitle}}',
    HtmlPart: eventCancellationHtml,
    TextPart: stripToText(eventCancellationHtml)
};

// ─── mgm_event_update ────────────────────────────────────────────────────────

const eventUpdateHtml = wrapInSesTemplate(`
    <h2>Event Schedule Updated</h2>
    <p>Dear {{firstName}},</p>
    <p>This is to inform you that the schedule for <strong>{{eventTitle}}</strong> has been updated.</p>

    {{#if hasUpdateReason}}
    <div class="info-box">
        <strong>Update Reason:</strong><br>
        {{updateReason}}
    </div>
    {{/if}}

    <div class="success-box">
        <strong>New Event Schedule:</strong><br>
        📅 New Date: {{dateStr}}<br>
        📍 Location: {{locationStr}}<br>
        🕒 Time: {{timeStr}}
    </div>

    <p>Your current registration is still valid for the new date. No action is required from your side.</p>
    <p>If you are unable to attend on the new date, please contact us for assistance.</p>

    <p style="text-align: center;">
        <a href="{{frontendUrl}}/event/{{eventId}}" class="button">View Updated Event</a>
    </p>

    <p class="text-muted">With regards,<br>The {{appName}} Team</p>
`, { title: 'Event Update' });

const mgm_event_update = {
    TemplateName: 'mgm_event_update',
    SubjectPart: 'Update: Schedule Changed for {{eventTitle}}',
    HtmlPart: eventUpdateHtml,
    TextPart: stripToText(eventUpdateHtml)
};

module.exports = [
    mgm_event_registration,
    mgm_event_cancellation,
    mgm_event_update
];
