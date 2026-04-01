const { wrapInTemplate, FRONTEND_URL } = require('./base.template');
const {
    buildGreeting,
    firstNonEmpty,
    getCurrencyContext,
    formatCurrency,
    formatDate,
    formatTime,
    getLocationString,
    buildActionButton
} = require('./template.utils');

function getEventRegistrationEmail({ event, registration, attendeeName, isPaid = false, paymentDetails = null }) {
    const eventDate = event?.startDate || event?.start_date || event?.date;
    const paymentAmount = paymentDetails?.amount ?? paymentDetails?.totalAmount ?? registration?.amount;
    const registrationId = firstNonEmpty(registration?.registrationNumber, registration?.registration_number, registration?.id, 'Not available');
    const { currency, rate } = getCurrencyContext(arguments[0], event, registration, paymentDetails);

    const paymentSection = isPaid && paymentDetails ? `
        <div class="panel">
            <p><strong>Payment details</strong></p>
            <p>Amount paid: ${formatCurrency(paymentAmount, currency, rate)}</p>
            <p>Transaction ID: ${firstNonEmpty(paymentDetails.transactionId, paymentDetails.razorpayPaymentId, paymentDetails.paymentId, 'Not available')}</p>
            <p>Payment date: ${formatDate(paymentDetails.paidAt || paymentDetails.paymentDate || new Date())}</p>
        </div>
    ` : `
        <div class="panel panel-success">
            <p><strong>Registration type</strong></p>
            <p>This event does not require payment.</p>
        </div>
    `;

    const content = `
        <h2>Registration confirmed</h2>
        <p>${buildGreeting(attendeeName, 'there')}</p>
        <p>Your registration for <strong>${firstNonEmpty(event?.title, event?.name, 'this event')}</strong> has been confirmed.</p>
        <div class="panel panel-success">
            <p><strong>Event details</strong></p>
            <p>Date: ${formatDate(eventDate)}</p>
            <p>Time: ${firstNonEmpty(event?.startTime, event?.time, formatTime(eventDate))}</p>
            <p>Location: ${getLocationString(event?.location)}</p>
            <p>Registration ID: ${registrationId}</p>
            ${event?.eventCode ? `<p>Event code: ${event.eventCode}</p>` : ''}
        </div>
        ${paymentSection}
        ${event?.description ? `<p class="muted">${firstNonEmpty(event.description).slice(0, 300)}</p>` : ''}
        ${buildActionButton('View event', `${FRONTEND_URL}/event/${event?.id || ''}`)}
    `;

    return {
        subject: `Registration confirmed - ${firstNonEmpty(event?.title, event?.name, 'Event')}`,
        html: wrapInTemplate(content, { title: 'Registration confirmed', preheader: 'Your event registration is confirmed.' })
    };
}

function getEventCancellationEmail({ event, registration, attendeeName, refundDetails = null }) {
    const { currency, rate } = getCurrencyContext(arguments[0], event, registration, refundDetails);
    const refundSection = refundDetails ? `
        <div class="panel ${refundDetails.isRefunded ? 'panel-success' : 'panel'}">
            <p><strong>Refund details</strong></p>
            <p>Amount: ${formatCurrency(refundDetails.amount, currency, rate)}</p>
            <p>Reference: ${firstNonEmpty(refundDetails.refundId, refundDetails.id, 'Pending')}</p>
            <p>Status: ${refundDetails.isRefunded ? 'Processed' : 'Initiated'}</p>
        </div>
    ` : '';

    const content = `
        <h2>Registration cancelled</h2>
        <p>${buildGreeting(attendeeName, 'there')}</p>
        <p>Your registration for <strong>${firstNonEmpty(event?.title, event?.name, 'this event')}</strong> has been cancelled.</p>
        ${event?.cancellationReason ? `<div class="panel panel-warning"><p><strong>Reason</strong></p><p>${event.cancellationReason}</p></div>` : ''}
        <div class="panel">
            <p><strong>Cancelled registration</strong></p>
            <p>Date: ${formatDate(event?.startDate || event?.start_date || event?.date)}</p>
            <p>Location: ${getLocationString(event?.location)}</p>
            <p>Registration ID: ${firstNonEmpty(registration?.registrationNumber, registration?.registration_number, registration?.id, 'Not available')}</p>
        </div>
        ${refundSection}
        ${buildActionButton('Browse other events', `${FRONTEND_URL}/events`)}
    `;

    return {
        subject: `Registration cancelled - ${firstNonEmpty(event?.title, event?.name, 'Event')}`,
        html: wrapInTemplate(content, { title: 'Registration cancelled', preheader: 'Your event registration has been cancelled.' })
    };
}

function getEventUpdateEmail({ event, attendeeName }) {
    const eventDate = event?.startDate || event?.start_date || event?.date;
    const content = `
        <h2>Event schedule updated</h2>
        <p>${buildGreeting(attendeeName, 'there')}</p>
        <p>The schedule for <strong>${firstNonEmpty(event?.title, event?.name, 'this event')}</strong> has been updated.</p>
        ${event?.updateReason ? `<div class="panel"><p><strong>Update reason</strong></p><p>${event.updateReason}</p></div>` : ''}
        <div class="panel panel-success">
            <p><strong>Updated schedule</strong></p>
            <p>Date: ${formatDate(eventDate)}</p>
            <p>Time: ${firstNonEmpty(event?.startTime, event?.time, formatTime(eventDate))}</p>
            <p>Location: ${getLocationString(event?.location)}</p>
        </div>
        <p>Your registration remains valid unless our team informs you otherwise.</p>
        ${buildActionButton('View updated event', `${FRONTEND_URL}/event/${event?.id || ''}`)}
    `;

    return {
        subject: `Event update - ${firstNonEmpty(event?.title, event?.name, 'Event')}`,
        html: wrapInTemplate(content, { title: 'Event update', preheader: 'An event you registered for has been updated.' })
    };
}

module.exports = {
    getEventRegistrationEmail,
    getEventCancellationEmail,
    getEventUpdateEmail
};
