const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

function getPaymentConfirmationEmail({ customerName, order, paymentId, amount, method, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Payment Received! ✅',
            received: 'We\'ve successfully received your payment for Order <strong>#{{orderNumber}}</strong>.',
            transactionId: 'Transaction ID',
            method: 'Method',
            onlinePayment: 'Online Payment',
            processed: 'Your order is now being processed. We will notify you once it\'s shipped.',
            viewButton: 'View Order Details',
            thanks: 'Thank you for shopping with us!',
            subject: 'Payment Receipt - Order #',
            templateTitle: 'Payment Confirmed'
        },
        hi: {
            title: 'भुगतान प्राप्त हुआ! ✅',
            received: 'हमने आपके ऑर्डर <strong>#{{orderNumber}}</strong> के लिए भुगतान सफलतापूर्वक प्राप्त कर लिया है।',
            transactionId: 'लेनदेन आईडी',
            method: 'तरीका',
            onlinePayment: 'ऑनलाइन भुगतान',
            processed: 'आपका ऑर्डर अब संसाधित किया जा रहा है। शिप किए जाने पर हम आपको सूचित करेंगे।',
            viewButton: 'ऑर्डर विवरण देखें',
            thanks: 'हमारे साथ खरीदारी करने के लिए धन्यवाद!',
            subject: 'भुगतान रसीद - ऑर्डर #',
            templateTitle: 'भुगतान की पुष्टि हुई'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const orderNumber = order.order_number || order.id;

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.received.replace('{{orderNumber}}', orderNumber)}</p>
        
        <div class="success-box">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">₹${parseFloat(amount).toFixed(2)}</div>
            <div style="color: #666; font-size: 14px;">${s.transactionId}: ${paymentId}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">${s.method}: ${method ? method.toUpperCase() : s.onlinePayment}</div>
        </div>

        <div style="margin: 20px 0;">
            <p>${s.processed}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${FRONTEND_URL}/orders/${order.id}" class="button">
                ${s.viewButton}
            </a>
        </div>
        
        <p class="text-muted">${s.thanks}<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject}${orderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

module.exports = {
    getPaymentConfirmationEmail
};
