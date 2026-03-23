const { wrapInTemplate, APP_NAME } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

/**
 * Helper to format items table
 */
function getItemsTableHtml(order, lang = 'en') {
    const i18n = {
        en: {
            item: 'Item',
            qty: 'Qty',
            price: 'Price',
            subtotal: 'Subtotal',
            delivery: 'Delivery',
            discount: 'Discount',
            tax: 'Tax',
            total: 'Total'
        },
        hi: {
            item: 'वस्तु',
            qty: 'मात्रा',
            price: 'कीमत',
            subtotal: 'उप-योग',
            delivery: 'डिलिवरी',
            discount: 'छूट',
            tax: 'कर',
            total: 'कुल'
        }
    };
    const s = i18n[lang] || i18n.en;

    const itemsHtml = order.items?.map(item => {
        const product = item.product || {};
        const variant = item.variant_snapshot || item.variant || {};
        const title = product.title || item.title || item.name || (lang === 'hi' ? 'उत्पाद' : 'Product');
        const variantLabel = variant.size_label ? ` <span style="color: #666; font-size: 12px;">(${variant.size_label})</span>` : '';
        const price = item.price_per_unit || item.price || variant.selling_price || 0;
        const quantity = item.quantity || 1;
        const itemTotal = item.total_amount || (price * quantity);

        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${title}</strong>${variantLabel}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                ${quantity}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                ₹${itemTotal.toFixed(2)}
            </td>
        </tr>
        `;
    }).join('') || '';

    return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
            <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: left;">${s.item}</th>
                <th style="padding: 10px; text-align: center;">${s.qty}</th>
                <th style="padding: 10px; text-align: right;">${s.price}</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHtml}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="2" style="padding: 10px; text-align: right; border-top: 1px solid #eee;">${s.subtotal}:</td>
                <td style="padding: 10px; text-align: right; border-top: 1px solid #eee;">₹${(order.subtotal || 0).toFixed(2)}</td>
            </tr>
            ${order.delivery_charge ? `
            <tr>
                <td colspan="2" style="padding: 10px; text-align: right;">${s.delivery}:</td>
                <td style="padding: 10px; text-align: right;">₹${((order.delivery_charge || 0) + (order.delivery_gst || 0)).toFixed(2)}</td>
            </tr>
            ` : ''}
            ${(order.coupon_discount || 0) > 0 ? `
            <tr>
                <td colspan="2" style="padding: 10px; text-align: right; color: green;">${s.discount}:</td>
                <td style="padding: 10px; text-align: right; color: green;">-₹${order.coupon_discount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${order.tax ? `
            <tr>
                <td colspan="2" style="padding: 10px; text-align: right; color: #666; font-size: 12px;">
                    ${s.tax} (${order.tax.tax_type === 'INTER' ? 'IGST' : 'CGST+SGST'}):
                </td>
                <td style="padding: 10px; text-align: right; color: #666; font-size: 12px;">
                    ₹${(order.tax.total_tax || 0).toFixed(2)}
                </td>
            </tr>
            ` : ''}
            <tr style="font-weight: bold; font-size: 16px;">
                <td colspan="2" style="padding: 15px; text-align: right; border-top: 2px solid #eee;">${s.total}:</td>
                <td style="padding: 15px; text-align: right; border-top: 2px solid #eee;">₹${(order.total_amount || 0).toFixed(2)}</td>
            </tr>
        </tfoot>
    </table>
    `;
}

/**
 * Helper to format address
 */
function formatAddr(addr, lang = 'en') {
    if (!addr) return 'N/A';
    const phoneLabel = lang === 'hi' ? 'फोन' : 'Phone';
    const countryName = addr.country || (lang === 'hi' ? 'भारत' : 'India');

    return `
        ${addr.full_name || addr.label || ''}<br>
        ${addr.street_address || addr.address_line1 || ''}, ${addr.apartment || addr.address_line2 || ''}<br>
        ${addr.city || ''}, ${addr.state || ''} - ${addr.postal_code || addr.postalCode || ''}<br>
        ${countryName}<br>
        ${phoneLabel}: ${addr.phone || addr.phone_number || 'N/A'}
    `;
}

/**
 * 1. Order Placed Email (Pending)
 */
function getOrderPlacedEmail({ order, customerName, receiptUrl, paymentId, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Order Received! 🛍️',
            received: 'Thank you for shopping with us! We have received your order <strong>#{{orderNumber}}</strong> and it is currently under review.',
            status: 'Order Status',
            pending: 'PENDING CONFIRMATION',
            date: 'Order Date',
            transaction: 'Transaction ID',
            downloadReceipt: 'Download Payment Receipt',
            receiptReady: 'Your payment receipt is ready for download.',
            teamNotify: 'Our team will verify the details and notify you once the order is confirmed.',
            subject: 'Order Placed',
            templateTitle: 'Order Received'
        },
        hi: {
            title: 'ऑर्डर प्राप्त हुआ! 🛍️',
            received: 'हमारे साथ खरीदारी करने के लिए धन्यवाद! हमें आपका ऑर्डर <strong>#{{orderNumber}}</strong> प्राप्त हो गया है और वर्तमान में इसकी समीक्षा की जा रही है।',
            status: 'ऑर्डर की स्थिति',
            pending: 'पुष्टि लंबित',
            date: 'ऑर्डर दिनांक',
            transaction: 'लेन-देन आईडी',
            downloadReceipt: 'भुगतान रसीद डाउनलोड करें',
            receiptReady: 'आपकी भुगतान रसीद डाउनलोड के लिए तैयार है।',
            teamNotify: 'हमारी टीम विवरणों को सत्यापित करेगी और ऑर्डर की पुष्टि होने के बाद आपको सूचित करेगी।',
            subject: 'ऑर्डर दे दिया गया',
            templateTitle: 'ऑर्डर प्राप्त हुआ'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const displayOrderNumber = order.order_number || order.id;

    const receiptSection = receiptUrl ? `
    <div style="margin: 30px 0; text-align: center;">
        <a href="${receiptUrl}" style="background-color: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
            📄 ${s.downloadReceipt}
        </a>
        <p style="margin-top: 12px; font-size: 13px; color: #666;">
            ${s.receiptReady}
        </p>
    </div>
    ` : '';

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear === 'प्रिय' ? 'प्रिया' : 'Hi'} ${firstName},</p>
        <p>${s.received.replace('{{orderNumber}}', displayOrderNumber)}</p>
        
        <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${s.status}:</strong> ${s.pending}<br>
            <strong>${s.date}:</strong> ${new Date(order.created_at || Date.now()).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}<br>
            ${paymentId ? `<strong>${s.transaction}:</strong> ${paymentId}` : ''}
        </div>

        ${receiptSection}

        <p>${s.teamNotify}</p>
        
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * 2. Order Confirmed Email
 */
function getOrderConfirmedEmail({ order, customerName, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Order Confirmed! 🎉',
            greet: 'Great news {{name}}!',
            confirmed: 'Your order <strong>#{{orderNumber}}</strong> has been confirmed and is being prepared for shipping.',
            shippingAddr: 'Shipping Address',
            billingAddr: 'Billing Address',
            summary: 'Order Summary',
            warehouseNotify: 'We will notify you as soon as your order leaves our warehouse.',
            thanksPatience: 'Thank you for your patience!',
            subject: 'Order Confirmed',
            templateTitle: 'Order Confirmed'
        },
        hi: {
            title: 'ऑर्डर की पुष्टि हो गई! 🎉',
            greet: 'अच्छी खबर {{name}}!',
            confirmed: 'आपके ऑर्डर <strong>#{{orderNumber}}</strong> की पुष्टि हो गई है और शिपिंग के लिए तैयार किया जा रहा है।',
            shippingAddr: 'शिपिंग का पता',
            billingAddr: 'बिलिंग का पता',
            summary: 'ऑर्डर का सारांश',
            warehouseNotify: 'जैसे ही आपका ऑर्डर हमारे वेयरहाउस से निकलेगा, हम आपको सूचित करेंगे।',
            thanksPatience: 'आपके धैर्य के लिए धन्यवाद!',
            subject: 'ऑर्डर की पुष्टि हुई',
            templateTitle: 'ऑर्डर की पुष्टि'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>${s.title}</h2>
        <p>${s.greet.replace('{{name}}', firstName)}</p>
        <p>${s.confirmed.replace('{{orderNumber}}', displayOrderNumber)}</p>
        
        <div style="margin: 25px 0;">
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #4a5568;">${s.shippingAddr}</h4>
                    <p style="font-size: 13px; color: #2d3748; margin-bottom: 0;">${formatAddr(order.shipping_address, lang)}</p>
                </div>
                <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #4a5568;">${s.billingAddr}</h4>
                    <p style="font-size: 13px; color: #2d3748; margin-bottom: 0;">${formatAddr(order.billing_address, lang)}</p>
                </div>
            </div>
        </div>

        <h3>${s.summary}</h3>
        ${getItemsTableHtml(order, lang)}
        
        <p style="margin-top: 20px;">${s.warehouseNotify}</p>
        
        <p class="text-muted">${s.thanksPatience}<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * 3. Order Shipped Email
 */
function getOrderShippedEmail({ order, customerName, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Order Shipped! 🚚',
            onWay: 'Your order <strong>#{{orderNumber}}</strong> is on its way!',
            expected: 'Expected Delivery',
            timeline: '1 - 2 Weeks',
            workingHard: "We're working hard to get your Gau Mata products to you as soon as possible.",
            trackNotify: 'You can track your order status anytime by visiting our website.',
            happyWaiting: 'Happy waiting!',
            subject: 'Order Shipped',
            templateTitle: 'Order Shipped'
        },
        hi: {
            title: 'ऑर्डर शिप कर दिया गया! 🚚',
            onWay: 'आपका ऑर्डर <strong>#{{orderNumber}}</strong> रास्ते में है!',
            expected: 'संभावित डिलिवरी',
            timeline: '1 - 2 सप्ताह',
            workingHard: 'हम आपके गौ माता उत्पादों को जल्द से जल्द आप तक पहुँचाने के लिए कड़ी मेहनत कर रहे हैं।',
            trackNotify: 'आप हमारी वेबसाइट पर जाकर कभी भी अपने ऑर्डर की स्थिति ट्रैक कर सकते हैं।',
            happyWaiting: 'प्रतीक्षा करें!',
            subject: 'ऑर्डर शिप किया गया',
            templateTitle: 'ऑर्डर शिप हुआ'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear === 'प्रिय' ? 'प्रिया' : 'Hi'} ${firstName},</p>
        <p>${s.onWay.replace('{{orderNumber}}', displayOrderNumber)}</p>
        
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin: 0; color: #92400e;">${s.expected}</h3>
            <p style="font-size: 18px; font-weight: bold; color: #b45309; margin: 10px 0;">${s.timeline}</p>
            <p style="margin: 0; font-size: 13px; color: #d97706;">${s.workingHard}</p>
        </div>

        <p>${s.trackNotify}</p>
        
        <p class="text-muted">${s.happyWaiting}<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * 4. Order Delivered Email
 */
function getOrderDeliveredEmail({ order, customerName, invoiceUrl, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Order Delivered! 📦',
            delivered: 'Your order <strong>#{{orderNumber}}</strong> has been successfully delivered. We hope you love your products!',
            status: 'Status',
            deliveredStatus: 'DELIVERED',
            date: 'Delivery Date',
            downloadInvoice: 'Download Official GST Invoice',
            invoiceReady: 'Your tax invoice is now available for download.',
            feedback: 'We would love to hear your feedback. Feel free to reply to this email or leave a review on our website.',
            memberNotify: `Thank you for being a part of the ${APP_NAME} family!`,
            subject: 'Order Delivered',
            templateTitle: 'Order Delivered'
        },
        hi: {
            title: 'ऑर्डर डिलीवर हो गया! 📦',
            delivered: 'आपका ऑर्डर <strong>#{{orderNumber}}</strong> सफलतापूर्वक डिलीवर हो गया है। हमें उम्मीद है कि आपको हमारे उत्पाद पसंद आएंगे!',
            status: 'स्थिति',
            deliveredStatus: 'डिलीवर हुआ',
            date: 'डिलीवरी की तारीख',
            downloadInvoice: 'आधिकारिक जीएसटी चालान डाउनलोड करें',
            invoiceReady: 'आपका टैक्स चालान अब डाउनलोड के लिए उपलब्ध है।',
            feedback: 'हमें आपकी प्रतिक्रिया सुनना अच्छा लगेगा। बेझिझक इस ईमेल का जवाब दें या हमारी वेबसाइट पर समीक्षा छोड़ें।',
            memberNotify: `${APP_NAME} परिवार का हिस्सा बनने के लिए धन्यवाद!`,
            subject: 'ऑर्डर डिलीवर हो गया',
            templateTitle: 'ऑर्डर डिलीवर हुआ'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const displayOrderNumber = order.order_number || order.id;

    const invoiceSection = invoiceUrl ? `
    <div style="margin: 30px 0; text-align: center;">
        <a href="${invoiceUrl}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.25);">
            📄 ${s.downloadInvoice}
        </a>
        <p style="margin-top: 12px; font-size: 13px; color: #666;">
            ${s.invoiceReady}
        </p>
    </div>
    ` : '';

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear === 'प्रिय' ? 'प्रिया' : 'Hi'} ${firstName},</p>
        <p>${s.delivered.replace('{{orderNumber}}', displayOrderNumber)}</p>
        
        <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; color: #065f46;">
            <strong>${s.status}:</strong> ${s.deliveredStatus}<br>
            <strong>${s.date}:</strong> ${new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
        </div>

        ${invoiceSection}

        <p>${s.feedback}</p>
        
        <p class="text-muted">${s.memberNotify}<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * 5. Order Cancellation Email
 */
function getOrderCancellationEmail({ order, customerName, refundAmount, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Order Cancelled 🛑',
            cancelled: 'As requested, your order <strong>#{{orderNumber}}</strong> has been cancelled.',
            status: 'Status',
            cancelledStatus: 'CANCELLED',
            refundTitle: 'Refund Information:',
            refundDesc: 'A refund of <strong>₹{{amount}}</strong> has been initiated to your original payment method. It usually takes 5-7 business days to reflect in your account.',
            questions: 'If you have any questions, please reach out to our support team.',
            hopeSeeSoon: 'We hope to see you again soon.',
            subject: 'Order Cancelled',
            templateTitle: 'Order Cancelled'
        },
        hi: {
            title: 'ऑर्डर रद्द कर दिया गया 🛑',
            cancelled: 'अनुरोध के अनुसार, आपका ऑर्डर <strong>#{{orderNumber}}</strong> रद्द कर दिया गया है।',
            status: 'स्थिति',
            cancelledStatus: 'रद्द हुआ',
            refundTitle: 'रिफंड की जानकारी:',
            refundDesc: 'आपके मूल भुगतान विधि में <strong>₹{{amount}}</strong> का रिफंड शुरू कर दिया गया है। इसे आपके खाते में प्रतिबिंबित होने में आमतौर पर 5-7 कार्य दिवस लगते हैं।',
            questions: 'यदि आपके कोई प्रश्न हैं, तो कृपया हमारी सहायता टीम से संपर्क करें।',
            hopeSeeSoon: 'हमें उम्मीद है कि आप जल्द ही फिर मिलेंगे।',
            subject: 'ऑर्डर रद्द हुआ',
            templateTitle: 'ऑर्डर रद्द'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear === 'प्रिय' ? 'प्रिया' : 'Hi'} ${firstName},</p>
        <p>${s.cancelled.replace('{{orderNumber}}', displayOrderNumber)}</p>
        
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; color: #991b1b;">
            <strong>${s.status}:</strong> ${s.cancelledStatus}
        </div>

        ${(order.payment_status === 'paid' || order.payment_status === 'refund_initiated' || order.payment_status === 'refunded') ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
                <strong>${s.refundTitle}</strong><br>
                ${s.refundDesc.replace('{{amount}}', (refundAmount !== undefined ? refundAmount : (order.total_amount || 0)).toFixed(2))}
            </p>
        </div>
        ` : ''}
        
        <p style="margin-top: 25px;">${s.questions}</p>
        <p class="text-muted">${s.hopeSeeSoon}<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * 6. Order Returned Email
 */
function getOrderReturnedEmail({ order, customerName, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Return Completed 📦',
            returned: 'Your returned items for order <strong>#{{orderNumber}}</strong> have been received and processed at our warehouse.',
            status: 'Status',
            returnedStatus: 'RETURNED',
            nextSteps: 'Next Steps:',
            nextStepsDesc: 'Your refund (if applicable) is being processed. You can check the details on your order history page.',
            subject: 'Return Processed',
            templateTitle: 'Return Processed'
        },
        hi: {
            title: 'वापसी पूरी हुई 📦',
            returned: 'ऑर्डर <strong>#{{orderNumber}}</strong> के लिए आपके लौटाए गए आइटम हमारे वेयरहाउस में प्राप्त और संसाधित किए गए हैं।',
            status: 'स्थिति',
            returnedStatus: 'वापस किया गया',
            nextSteps: 'अगले कदम:',
            nextStepsDesc: 'आपका रिफंड (यदि लागू हो) संसाधित किया जा रहा है। आप अपने ऑर्डर इतिहास पृष्ठ पर विवरण देख सकते हैं।',
            subject: 'वापसी संसाधित हुई',
            templateTitle: 'वापसी संसाधित'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = customerName ? customerName.split(' ')[0] : (lang === 'hi' ? 'ग्राहक' : 'Customer');
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear === 'प्रिय' ? 'प्रिया' : 'Hi'} ${firstName},</p>
        <p>${s.returned.replace('{{orderNumber}}', displayOrderNumber)}</p>
        
        <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0; color: #374151;">
            <strong>${s.status}:</strong> ${s.returnedStatus}
        </div>

        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
                <strong>${s.nextSteps}</strong><br>
                ${s.nextStepsDesc}
            </p>
        </div>
        
        <p class="text-muted" style="margin-top: 25px;">${common.team}</p>
    `;

    return {
        subject: `${s.subject} - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
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

