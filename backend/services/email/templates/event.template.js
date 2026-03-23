const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

/**
 * Helper to extract location string from location
 */
function getLocationString(location, lang = 'en') {
    if (!location) return lang === 'hi' ? 'घोषणा की जाएगी' : 'TBA';
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
        const parts = [];
        if (location.venue) parts.push(location.venue);
        if (location.address) parts.push(location.address);
        if (location.city) parts.push(location.city);
        if (location.name) parts.push(location.name);
        return parts.length > 0 ? parts.join(', ') : JSON.stringify(location);
    }
    return String(location);
}

/**
 * Event registration confirmation email
 */
function getEventRegistrationEmail({ event, registration, attendeeName, isPaid = false, paymentDetails = null, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: "You're Registered! 🎟️",
            confirmed: "Your registration for <strong>{{eventTitle}}</strong> has been confirmed.",
            detailsTitle: 'Event Details:',
            date: 'Date',
            time: 'Time',
            location: 'Location',
            registrationId: 'Registration ID',
            eventId: 'Event ID',
            viewButton: 'View Event Details',
            seeYou: 'We look forward to seeing you there!',
            paymentTitle: 'Payment Details (Inclusive of all taxes):',
            basePrice: 'Base Price',
            gst: 'GST',
            totalAmount: 'Total Amount Paid',
            transactionId: 'Transaction ID',
            paymentDate: 'Payment Date',
            downloadReceipt: 'Download Receipt',
            downloadPaymentReceipt: 'Download Payment Receipt',
            freeTitle: '🎉 This is a FREE event!',
            noPayment: 'No payment required.',
            subject: 'Registration Confirmed',
            templateTitle: 'Event Registration Confirmed'
        },
        hi: {
            title: 'आपका पंजीकरण हो गया है! 🎟️',
            confirmed: '<strong>{{eventTitle}}</strong> के लिए आपके पंजीकरण की पुष्टि हो गई है।',
            detailsTitle: 'ईवेंट विवरण:',
            date: 'दिनांक',
            time: 'समय',
            location: 'स्थान',
            registrationId: 'पंजीकरण आईडी',
            eventId: 'ईवेंट आईडी',
            viewButton: 'ईवेंट विवरण देखें',
            seeYou: 'हमें वहां आपसे मिलने का इंतजार रहेगा!',
            paymentTitle: 'भुगतान विवरण (सभी करों सहित):',
            basePrice: 'मूल मूल्य',
            gst: 'जीएसटी',
            totalAmount: 'कुल भुगतान की गई राशि',
            transactionId: 'लेनदेन आईडी',
            paymentDate: 'भुगतान की तारीख',
            downloadReceipt: 'रसीद डाउनलोड करें',
            downloadPaymentReceipt: 'भुगतान रसीद डाउनलोड करें',
            freeTitle: '🎉 यह एक मुफ़्त ईवेंट है!',
            noPayment: 'किसी भुगतान की आवश्यकता नहीं है।',
            subject: 'पंजीकरण की पुष्टि हुई',
            templateTitle: 'ईवेंट पंजीकरण की पुष्टि'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = attendeeName ? attendeeName.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');
    const startDate = new Date(event.startDate || event.date);
    const endDate = event.endDate ? new Date(event.endDate) : null;

    const formatDate = (d) => d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formatTime = (d) => d.toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' });

    let dateStr = formatDate(startDate);
    if (endDate && endDate.toDateString() !== startDate.toDateString()) {
        dateStr += ` - ${formatDate(endDate)}`;
    }

    let timeStr = event.startTime || formatTime(startDate);
    if (event.endTime) {
        timeStr += ` - ${event.endTime}`;
    }

    const locationStr = getLocationString(event.location, lang);

    let paymentSection = '';
    if (isPaid && paymentDetails) {
        paymentSection = `
            <div class="info-box">
                <strong>${s.paymentTitle}</strong><br>
                💵 ${s.basePrice}: ₹${paymentDetails.basePrice?.toFixed(2) || '0.00'}<br>
                🧾 ${s.gst} (${paymentDetails.gstRate || 0}%): ₹${paymentDetails.gstAmount?.toFixed(2) || '0.00'}<br>
                💰 ${s.totalAmount}: ₹${paymentDetails.amount?.toFixed(2) || '0.00'}<br>
                🔗 ${s.transactionId}: ${paymentDetails.transactionId || paymentDetails.razorpayPaymentId || 'N/A'}<br>
                📅 ${s.paymentDate}: ${new Date(paymentDetails.paidAt || Date.now()).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
                ${paymentDetails.invoiceUrl ? `<br><br><a href="${paymentDetails.invoiceUrl}" style="color: #667eea; text-decoration: underline;">📄 ${s.downloadReceipt}</a>` : ''}
                ${paymentDetails.receiptUrl ? `<br><a href="${paymentDetails.receiptUrl}" style="color: #667eea; text-decoration: underline;">🧾 ${s.downloadPaymentReceipt}</a>` : ''}
            </div>
        `;
    } else if (!isPaid || (event.fee === 0)) {
        paymentSection = `
            <div class="info-box">
                <strong>${s.freeTitle}</strong><br>
                ${s.noPayment}
            </div>
        `;
    }

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.confirmed.replace('{{eventTitle}}', event.title)}</p>
        
        <div class="success-box">
            <strong>${s.detailsTitle}</strong><br>
            📅 ${s.date}: ${dateStr}<br>
            🕐 ${s.time}: ${timeStr}<br>
            📍 ${s.location}: ${locationStr}<br>
            🎫 ${s.registrationId}: ${registration.registrationNumber || registration.id}<br>
            ${event.eventCode ? `🆔 ${s.eventId}: ${event.eventCode}` : ''}
        </div>
        
        ${paymentSection}
        
        ${event.description ? `<p style="color: #666;">${event.description.substring(0, 300)}${event.description.length > 300 ? '...' : ''}</p>` : ''}
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/event/${event.id}" class="button">${s.viewButton}</a>
        </p>
        
        <p>${s.seeYou}</p>
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - ${event.title}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * Event cancellation email
 */
function getEventCancellationEmail({ event, registration, attendeeName, refundDetails = null, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Registration Cancelled',
            info: 'This is to inform you that your registration for <strong>{{eventTitle}}</strong> has been cancelled.',
            reasonTitle: 'Reason for Cancellation:',
            detailsTitle: 'Cancelled Registration Details:',
            date: 'Event Date',
            location: 'Location',
            registrationId: 'Registration ID',
            cancelledOn: 'Cancelled On',
            refundProcessed: 'Refund Processed:',
            refundAmount: 'Refund Amount',
            refundId: 'Refund ID',
            expectedCredit: 'Expected Credit: 5-7 business days',
            refundStatusTitle: 'Refund Status: Initiated',
            refundInitDesc: 'Your refund of ₹{{amount}} has been initiated.',
            refundTimeline: 'It will be credited to your original payment method within 5-7 business days.',
            reference: 'Reference',
            sorryNotify: "We're sorry for any inconvenience caused. If you have any questions or would like to browse other events, please visit our website.",
            browseButton: 'Browse Other Events',
            supportNotify: 'For support, please contact us at support@{{appNameLowercase}}.com',
            subject: 'Registration Cancelled',
            templateTitle: 'Event Cancellation'
        },
        hi: {
            title: 'पंजीकरण रद्द कर दिया गया',
            info: 'यह आपको सूचित करने के लिए है कि <strong>{{eventTitle}}</strong> के लिए आपका पंजीकरण रद्द कर दिया गया है।',
            reasonTitle: 'रद्द करने का कारण:',
            detailsTitle: 'रद्द किए गए पंजीकरण का विवरण:',
            date: 'ईवेंट की तारीख',
            location: 'स्थान',
            registrationId: 'पंजीकरण आईडी',
            cancelledOn: 'रद्द किया गया',
            refundProcessed: 'रिफंड संसाधित:',
            refundAmount: 'रिफंड राशि',
            refundId: 'रिफंड आईडी',
            expectedCredit: 'अपेक्षित क्रेडिट: 5-7 कार्य दिवस',
            refundStatusTitle: 'रिफंड की स्थिति: शुरू की गई',
            refundInitDesc: 'आपका ₹{{amount}} का रिफंड शुरू कर दिया गया है।',
            refundTimeline: 'यह 5-7 कार्य दिवसों के भीतर आपके मूल भुगतान विधि में जमा कर दिया जाएगा।',
            reference: 'संदर्भ',
            sorryNotify: 'हुई किसी भी असुविधा के लिए हमें खेद है। यदि आपके कोई प्रश्न हैं या अन्य ईवेंट देखना चाहते हैं, तो कृपया हमारी वेबसाइट पर जाएं।',
            browseButton: 'अन्य ईवेंट देखें',
            supportNotify: 'सहायता के लिए, कृपया हमसे support@{{appNameLowercase}}.com पर संपर्क करें',
            subject: 'पंजीकरण रद्द हुआ',
            templateTitle: 'ईवेंट रद्द'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = attendeeName ? attendeeName.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');
    const eventDate = new Date(event.startDate || event.date);
    const locationStr = getLocationString(event.location, lang);

    let refundSection = '';
    if (refundDetails) {
        if (refundDetails.isRefunded) {
            refundSection = `
                <div class="success-box">
                    <strong>${s.refundProcessed}</strong><br>
                    💰 ${s.refundAmount}: ₹${refundDetails.amount?.toFixed(2) || '0.00'}<br>
                    🏦 ${s.refundId}: ${refundDetails.refundId || 'N/A'}<br>
                    📅 ${s.expectedCredit}
                </div>
            `;
        } else if (refundDetails.amount > 0) {
            refundSection = `
                <div class="info-box">
                    <strong>${s.refundStatusTitle}</strong><br>
                    ${s.refundInitDesc.replace('{{amount}}', refundDetails.amount?.toFixed(2))}<br>
                    ${s.refundTimeline}<br>
                    ${refundDetails.refundId ? `<small style="color: #666;">${s.reference}: ${refundDetails.refundId}</small>` : ''}
                </div>
            `;
        }
    }

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.info.replace('{{eventTitle}}', event.title)}</p>
        
        ${event.cancellationReason ? `
        <div class="warning-box">
            <strong>${s.reasonTitle}</strong><br>
            ${event.cancellationReason}
        </div>` : ''}

        <div class="info-box">
            <strong>${s.detailsTitle}</strong><br>
            📅 ${s.date}: ${eventDate.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br>
            📍 ${s.location}: ${locationStr}<br>
            🎫 ${s.registrationId}: ${registration.registrationNumber || registration.registration_number || registration.id}<br>
            ❌ ${s.cancelledOn}: ${new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
        </div>
        
        ${refundSection}
        
        <p>${s.sorryNotify}</p>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/events" class="button">${s.browseButton}</a>
        </p>
        
        <p class="text-muted">${s.supportNotify.replace('{{appNameLowercase}}', APP_NAME.toLowerCase().replace(/\s/g, ''))}</p>
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - ${event.title}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * Event schedule update email
 */
function getEventUpdateEmail({ event, attendeeName, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Event Schedule Updated',
            info: 'This is to inform you that the schedule for <strong>{{eventTitle}}</strong> has been updated.',
            reasonTitle: 'Update Reason:',
            newSchedule: 'New Event Schedule:',
            newDate: 'New Date',
            newLocation: 'Location',
            newTime: 'Time',
            sameAsBefore: 'Same as before',
            validNotify: 'Your current registration is still valid for the new date. No action is required from your side.',
            unableNotify: 'If you are unable to attend on the new date, please contact us for assistance.',
            viewButton: 'View Updated Event',
            subject: 'Update: Schedule Changed for',
            templateTitle: 'Event Update'
        },
        hi: {
            title: 'ईवेंट शेड्यूल अपडेट किया गया',
            info: 'यह आपको सूचित करने के लिए है कि <strong>{{eventTitle}}</strong> के लिए शेड्यूल अपडेट कर दिया गया है।',
            reasonTitle: 'अपडेट का कारण:',
            newSchedule: 'नया ईवेंट शेड्यूल:',
            newDate: 'नई तारीख',
            newLocation: 'स्थान',
            newTime: 'समय',
            sameAsBefore: 'पहले जैसा ही',
            validNotify: 'आपका वर्तमान पंजीकरण नई तारीख के लिए अभी भी मान्य है। आपकी ओर से किसी कार्रवाई की आवश्यकता नहीं है।',
            unableNotify: 'यदि आप नई तारीख पर उपस्थित होने में असमर्थ हैं, तो कृपया सहायता के लिए हमसे संपर्क करें।',
            viewButton: 'अपडेट किया गया ईवेंट देखें',
            subject: 'अपडेट: शेड्यूल बदल गया है',
            templateTitle: 'ईवेंट अपडेट'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = attendeeName ? attendeeName.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');
    const eventDate = new Date(event.startDate || event.date);
    const dateStr = eventDate.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const locationStr = getLocationString(event.location, lang);

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.info.replace('{{eventTitle}}', event.title)}</p>
        
        ${event.updateReason ? `
        <div class="info-box">
            <strong>${s.reasonTitle}</strong><br>
            ${event.updateReason}
        </div>` : ''}

        <div class="success-box">
            <strong>${s.newSchedule}</strong><br>
            📅 ${s.newDate}: ${dateStr}<br>
            📍 ${s.newLocation}: ${locationStr}<br>
            🕒 ${s.newTime}: ${event.startTime || s.sameAsBefore}
        </div>
        
        <p>${s.validNotify}</p>
        
        <p>${s.unableNotify}</p>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/event/${event.id || ''}" class="button">${s.viewButton}</a>
        </p>
        
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} ${event.title}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

module.exports = {
    getEventRegistrationEmail,
    getEventCancellationEmail,
    getEventUpdateEmail
};
