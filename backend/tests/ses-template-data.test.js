const { buildSesTemplateData } = require('../services/email/ses-template-data');
const { EmailEventTypes } = require('../services/email/types');

describe('SES template data builder', () => {
    it('builds order confirmation payloads from nested order data', () => {
        const { templateData, missingFields } = buildSesTemplateData(EmailEventTypes.ORDER_CONFIRMED, {
            customerName: 'Ayush Sharma',
            order: {
                id: 'order-1',
                order_number: 'ORD-1001',
                created_at: '2026-03-30T10:00:00.000Z',
                items: [
                    {
                        quantity: 2,
                        price_per_unit: 199,
                        product: { title: 'Organic Ghee' }
                    }
                ],
                shipping_address: {
                    full_name: 'Ayush Sharma',
                    street_address: '123 Temple Road',
                    city: 'Jaipur',
                    state: 'Rajasthan',
                    postal_code: '302001'
                },
                billing_address: {
                    full_name: 'Ayush Sharma',
                    street_address: '123 Temple Road',
                    city: 'Jaipur',
                    state: 'Rajasthan',
                    postal_code: '302001'
                }
            }
        });

        expect(missingFields).toEqual([]);
        expect(templateData.firstName).toBe('Ayush');
        expect(templateData.orderNumber).toBe('ORD-1001');
        expect(templateData.itemsTableHtml).toContain('Organic Ghee');
        expect(templateData.shippingAddressHtml).toContain('Temple Road');
        expect(templateData.billingAddressHtml).toContain('Temple Road');
    });

    it('reports missing required SES fields before send', () => {
        const { templateData, missingFields } = buildSesTemplateData(EmailEventTypes.EMAIL_CONFIRMATION, {
            name: 'Ayush Sharma'
        });

        expect(templateData.firstName).toBe('Ayush');
        expect(missingFields).toEqual(['verificationLink']);
    });

    it('maps contact notification payloads to SES field names', () => {
        const { templateData, missingFields } = buildSesTemplateData(EmailEventTypes.CONTACT_NOTIFICATION, {
            name: 'Test User',
            email: 'test@example.com',
            phone: '+91 9999999999',
            subject: 'Need help',
            message: 'Please call me back.'
        });

        expect(missingFields).toEqual([]);
        expect(templateData.contactName).toBe('Test User');
        expect(templateData.contactEmail).toBe('test@example.com');
        expect(templateData.contactSubjectLine).toBe('Need help');
        expect(templateData.contactMessage).toBe('Please call me back.');
    });

    it('converts SES monetary fields to the preferred display currency when rate is available', () => {
        const { templateData, missingFields } = buildSesTemplateData(EmailEventTypes.ORDER_CONFIRMED, {
            customerName: 'Ayush Sharma',
            preferred_currency: 'USD',
            currencyRate: 0.012,
            order: {
                id: 'order-1',
                order_number: 'ORD-1001',
                currency: 'INR',
                created_at: '2026-03-30T10:00:00.000Z',
                items: [
                    {
                        quantity: 2,
                        price_per_unit: 199,
                        product: { title: 'Organic Ghee' }
                    }
                ],
                shipping_address: {
                    full_name: 'Ayush Sharma',
                    street_address: '123 Temple Road',
                    city: 'Jaipur',
                    state: 'Rajasthan',
                    postal_code: '302001'
                },
                billing_address: {
                    full_name: 'Ayush Sharma',
                    street_address: '123 Temple Road',
                    city: 'Jaipur',
                    state: 'Rajasthan',
                    postal_code: '302001'
                }
            }
        });

        expect(missingFields).toEqual([]);
        expect(templateData.currency).toBe('USD');
        expect(templateData.currencyRate).toBe('0.012');
        expect(templateData.itemsTableHtml).toContain('$2.39');
        expect(templateData.itemsTableHtml).toContain('$4.78');
    });
});
