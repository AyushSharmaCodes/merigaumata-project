const { wrapInTemplate, APP_NAME } = require('./base.template');
const { getCommonStrings } = require('./i18n-helper');

/**
 * Donation receipt/thank you email (One-Time)
 */
function getDonationReceiptEmail({ donation, donorName, isAnonymous = false, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Thank You for Your Donation! 🙏',
            gratitude: 'We are deeply grateful for your generous contribution to our cause. Your support makes a real difference.',
            detailsTitle: 'Donation Details',
            amount: 'Amount',
            date: 'Date',
            receiptId: 'Receipt ID',
            campaign: 'Campaign',
            mission: 'Your contribution helps us continue our mission and create positive impact in our community.',
            taxNote: 'This receipt can be used for tax purposes. Please retain it for your records.',
            subject: 'Thank You for Your Donation - Receipt',
            receiptTitle: 'Donation Receipt'
        },
        hi: {
            title: 'आपके दान के लिए धन्यवाद! 🙏',
            gratitude: 'हम आपके उदार योगदान के लिए गहराई से आभारी हैं। आपका समर्थन एक वास्तविक बदलाव लाता है।',
            detailsTitle: 'दान विवरण',
            amount: 'राशि',
            date: 'दिनांक',
            receiptId: 'रसीद आईडी',
            campaign: 'अभियान',
            mission: 'आपका योगदान हमें अपने मिशन को जारी रखने और हमारे समुदाय में सकारात्मक प्रभाव डालने में मदद करता है।',
            taxNote: 'इस रसीद का उपयोग कर उद्देश्यों के लिए किया जा सकता है। कृपया इसे अपने रिकॉर्ड के लिए सुरक्षित रखें।',
            subject: 'आपके दान के लिए धन्यवाद - रसीद',
            receiptTitle: 'दान रसीद'
        }
    };

    const strings = i18n[lang] || i18n.en;
    const displayName = isAnonymous ? common.generousDonor : (donorName || common.valuedDonor);
    const firstName = displayName.split(' ')[0];

    const content = `
        <h2>${strings.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${strings.gratitude}</p>
        
        <div class="success-box">
            <strong>${strings.detailsTitle}</strong><br>
            💰 ${strings.amount}: ₹${(donation.amount || 0).toFixed(2)}<br>
            📅 ${strings.date}: ${new Date(donation.createdAt || Date.now()).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}<br>
            🧾 ${strings.receiptId}: ${donation.id}
            ${donation.campaign ? `<br>🎯 ${strings.campaign}: ${donation.campaign}` : ''}
        </div>
        
        <p>${strings.mission}</p>
        
        <div class="info-box">
            <strong>${common.taxInfo}:</strong><br>
            ${strings.taxNote}
        </div>
        
        <p>${strings.title}</p>
        <p class="text-muted">${common.withGratitude},<br>${common.team}</p>
    `;

    return {
        subject: `${strings.subject} #${donation.id}`,
        html: wrapInTemplate(content, { title: strings.receiptTitle, lang })
    };
}

/**
 * Subscription confirmation email (Monthly/Recurring Donations)
 */
function getSubscriptionConfirmationEmail({ subscription, donorName, isAnonymous = false, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Welcome to Our Monthly Giving Family! 🐄💚',
            gratitude: 'Thank you for joining our community of monthly supporters! Your recurring contribution creates a lasting impact for the cows in our care.',
            activated: 'Monthly Donation Activated',
            monthlyAmount: 'Monthly Amount',
            started: 'Started',
            nextNext: 'Next Contribution',
            reference: 'Reference',
            providesTitle: 'What Your Monthly Donation Provides:',
            fodder: 'Nutritious Fodder',
            vet: 'Regular Veterinary Care',
            shelter: 'Clean Shelter',
            daily: 'Daily Love & Care',
            manageTitle: 'Managing Your Subscription',
            manageDesc: 'You can view, pause, or cancel your monthly donation anytime from your profile dashboard. All tax receipts will be sent automatically after each monthly payment.',
            together: "Together, we're making a difference every single month! 🌟",
            subject: 'Welcome to Monthly Giving',
            templateTitle: 'Monthly Donation Started'
        },
        hi: {
            title: 'हमारे मासिक दान परिवार में आपका स्वागत है! 🐄💚',
            gratitude: 'हमारे मासिक समर्थकों के समुदाय में शामिल होने के लिए धन्यवाद! आपका आवर्ती योगदान हमारी देखभाल में गायों के लिए एक स्थायी प्रभाव डालता है।',
            activated: 'मासिक दान सक्रिय हुआ',
            monthlyAmount: 'मासिक राशि',
            started: 'शुरू हुआ',
            nextNext: 'अगला योगदान',
            reference: 'संदर्भ',
            providesTitle: 'आपका मासिक दान क्या प्रदान करता है:',
            fodder: 'पौष्टिक चारा',
            vet: 'नियमित पशु चिकित्सा देखभाल',
            shelter: 'स्वच्छ आश्रय',
            daily: 'दैनिक प्यार और देखभाल',
            manageTitle: 'अपनी सदस्यता का प्रबंधन',
            manageDesc: 'आप अपने प्रोफाइल डैशबोर्ड से कभी भी अपना मासिक दान देख, रोक या रद्द कर सकते हैं। सभी कर रसीदें प्रत्येक मासिक भुगतान के बाद स्वचालित रूप से भेजी जाएंगी।',
            together: 'एक साथ, हम हर महीने एक बदलाव ला रहे हैं! 🌟',
            subject: 'मासिक दान में आपका स्वागत है',
            templateTitle: 'मासिक दान शुरू हुआ'
        }
    };

    const strings = i18n[lang] || i18n.en;
    const displayName = isAnonymous ? common.generousDonor : (donorName || common.valuedDonor);
    const firstName = displayName.split(' ')[0];
    const amount = subscription.amount || 0;

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const content = `
        <h2>${strings.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${strings.gratitude}</p>
        
        <div class="success-box" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e;">
            <strong style="font-size: 18px;">🎉 ${strings.activated}</strong><br><br>
            💰 <strong>${strings.monthlyAmount}:</strong> ₹${amount.toFixed(2)}<br>
            📅 <strong>${strings.started}:</strong> ${new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'long' })}<br>
            🔄 <strong>${strings.nextNext}:</strong> ${nextBillingDate.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'long' })}<br>
            ${subscription.donationRef ? `🧾 <strong>${strings.reference}:</strong> ${subscription.donationRef}` : ''}
        </div>
        
        <h3 style="color: #16a34a;">${strings.providesTitle}</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">🌾 <strong>${strings.fodder}</strong></td>
                <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">🏥 <strong>${strings.vet}</strong></td>
            </tr>
            <tr>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 0 8px;">🏠 <strong>${strings.shelter}</strong></td>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 8px 0;">💚 <strong>${strings.daily}</strong></td>
            </tr>
        </table>
        
        <div class="info-box" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong>📋 ${strings.manageTitle}</strong><br>
            ${strings.manageDesc}
        </div>
        
        <p style="text-align: center; margin-top: 24px;">
            <strong style="font-size: 16px; color: #16a34a;">${strings.together}</strong>
        </p>
        
        <p class="text-muted">${common.withGratitude},<br>${common.team}</p>
    `;

    return {
        subject: `🐄 ${strings.subject} - ${firstName}!`,
        html: wrapInTemplate(content, { title: strings.templateTitle, lang })
    };
}

/**
 * Subscription cancellation email (Recurring Donation Stopped)
 */
function getSubscriptionCancellationEmail({ subscription, donorName, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'Monthly Giving Update',
            update: `As per your request, we have cancelled your recurring monthly donation for <strong>${APP_NAME}</strong>.`,
            cancelledTitle: 'Recurring Donation Auto-Pay Cancelled',
            monthlyAmount: 'Monthly Amount',
            cancelDate: 'Cancellation Date',
            reference: 'Reference',
            stopped: 'Your auto-pay has been stopped, and no further contributions will be processed automatically. We are deeply grateful for the support you have provided to our cows.',
            impact: 'Impact Made',
            care: 'Care Provided',
            shelter: 'Shelter Supported',
            lives: 'Lives Touched',
            everyBit: 'Every Bit Counts',
            bitDesc: 'While your monthly commitment has ended, you can still support us through one-time donations whenever you wish. Your kindness remains the foundation of our sanctuary.',
            button: 'Continue Your Support',
            questions: 'If you have any questions or would like to reactivate your recurring support in the future, we are always here for you.',
            subject: 'Confirmation: Your recurring donation auto-pay has been cancelled',
            templateTitle: 'Recurring Donation Cancelled'
        },
        hi: {
            title: 'मासिक दान अपडेट',
            update: `आपके अनुरोध के अनुसार, हमने <strong>${APP_NAME}</strong> के लिए आपके आवर्ती मासिक दान को रद्द कर दिया है।`,
            cancelledTitle: 'आवर्ती दान ऑटो-पे रद्द कर दिया गया',
            monthlyAmount: 'मासिक राशि',
            cancelDate: 'रद्द करने की तिथि',
            reference: 'संदर्भ',
            stopped: 'आपका ऑटो-पे रोक दिया गया है, और अब कोई और योगदान स्वचालित रूप से संसाधित नहीं किया जाएगा। हमने अपनी गायों को आपके द्वारा प्रदान किए गए समर्थन के लिए हम गहराई से आभारी हैं।',
            impact: 'प्रभाव डाला',
            care: 'देखभाल प्रदान की गई',
            shelter: 'आश्रय का समर्थन',
            lives: 'जीवन को छुआ',
            everyBit: 'हर छोटा योगदान मायने रखता है',
            bitDesc: 'हालाँकि आपकी मासिक प्रतिबद्धता समाप्त हो गई है, फिर भी आप जब चाहें एकमुश्त दान के माध्यम से हमारा समर्थन कर सकते हैं। आपकी दयालुता हमारे अभयारण्य की आधारशिला बनी हुई है।',
            button: 'अपना समर्थन जारी रखें',
            questions: 'यदि आपके कोई प्रश्न हैं या भविष्य में अपने आवर्ती समर्थन को फिर से सक्रिय करना चाहते हैं, तो हम हमेशा आपके लिए यहां हैं।',
            subject: 'पुष्टि: आपका आवर्ती दान ऑटो-पे रद्द कर दिया गया है',
            templateTitle: 'आवर्ती दान रद्द'
        }
    };

    const strings = i18n[lang] || i18n.en;
    const firstName = donorName ? donorName.split(' ')[0] : (lang === 'hi' ? common.valuedDonor : 'Valued Donor');
    const amount = subscription.amount || 0;

    const content = `
        <h2>${strings.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${strings.update}</p>
        
        <div class="warning-box" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid #64748b; padding: 20px;">
            <strong style="font-size: 18px;">🛑 ${strings.cancelledTitle}</strong><br><br>
            💰 <strong>${strings.monthlyAmount}:</strong> ₹${amount.toFixed(2)}<br>
            📅 <strong>${strings.cancelDate}:</strong> ${new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'long' })}<br>
            ${subscription.donationRef ? `🧾 <strong>${strings.reference}:</strong> ${subscription.donationRef}` : ''}
        </div>
        
        <p>${strings.stopped}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">🌾 <strong>${strings.impact}</strong></td>
                <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">🏥 <strong>${strings.care}</strong></td>
            </tr>
            <tr>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 0 8px;">🏠 <strong>${strings.shelter}</strong></td>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 8px 0;">💚 <strong>${strings.lives}</strong></td>
            </tr>
        </table>

        <div class="info-box" style="background: #f0f9ff; border-left: 4px solid #0ea5e9;">
            <strong>💖 ${strings.everyBit}</strong><br>
            ${strings.bitDesc}
        </div>
        
        <p style="text-align: center; margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL}/donations" class="button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">${strings.button}</a>
        </p>
        
        <p>${strings.questions}</p>
        
        <p class="text-muted">${common.withGratitude},<br>${common.team}</p>
    `;

    return {
        subject: strings.subject,
        html: wrapInTemplate(content, { title: strings.templateTitle, lang })
    };
}

module.exports = {
    getDonationReceiptEmail,
    getSubscriptionConfirmationEmail,
    getSubscriptionCancellationEmail
};

