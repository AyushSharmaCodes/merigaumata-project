const { getOrderConfirmedEmail } = require('../services/email/templates/order.template');
const { getEventRegistrationEmail } = require('../services/email/templates/event.template');
const { getDonationReceiptEmail } = require('../services/email/templates/donation.template');
const { getEmailConfirmationEmail } = require('../services/email/templates/registration.template');
const { APP_NAME } = require('../services/email/templates/base.template');

describe('Custom email templates', () => {
    it('renders order confirmation with normalized order data and no Hindi copy', () => {
        const email = getOrderConfirmedEmail({
            customerName: 'Ayush Sharma',
            order: {
                id: 'order-1',
                order_number: 'ORD-1001',
                items: [
                    {
                        quantity: 2,
                        price_per_unit: 199,
                        product: { title: 'Organic Ghee' },
                        variant_snapshot: { size_label: '500ml' }
                    }
                ],
                shipping_address: {
                    full_name: 'Ayush Sharma',
                    street_address: '123 Temple Road',
                    city: 'Jaipur',
                    state: 'Rajasthan',
                    postal_code: '302001',
                    phone: '9999999999'
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

        expect(email.subject).toBe('Order confirmed - #ORD-1001');
        expect(email.html).toContain('Order confirmed');
        expect(email.html).toContain('Organic Ghee');
        expect(email.html).toContain('500ml');
        expect(email.html).toContain('Temple Road');
        expect(email.html).not.toContain('ऑर्डर');
    });

    it('renders event registration with payment details from common event data shapes', () => {
        const email = getEventRegistrationEmail({
            attendeeName: 'Test User',
            event: {
                id: 'event-1',
                title: 'Cow Care Workshop',
                start_date: '2026-04-12T10:30:00.000Z',
                location: {
                    venue: 'Main Hall',
                    city: 'Delhi'
                }
            },
            registration: {
                registration_number: 'REG-42'
            },
            isPaid: true,
            paymentDetails: {
                amount: 499,
                transactionId: 'txn_123',
                paidAt: '2026-04-01T09:00:00.000Z'
            }
        });

        expect(email.subject).toBe('Registration confirmed - Cow Care Workshop');
        expect(email.html).toContain('Cow Care Workshop');
        expect(email.html).toContain('REG-42');
        expect(email.html).toContain('txn_123');
        expect(email.html).toContain('Main Hall, Delhi');
    });

    it('renders donation receipt with campaign and amount', () => {
        const email = getDonationReceiptEmail({
            donorName: 'Riya Sharma',
            donation: {
                id: 'don-1',
                amount: 2500,
                created_at: '2026-04-01T09:00:00.000Z',
                campaign_name: 'Medical Support'
            }
        });

        expect(email.subject).toBe(`Donation receipt don-1 - ${APP_NAME}`);
        expect(email.html).toContain('Medical Support');
        expect(email.html).toContain('2,500.00');
    });

    it('renders email confirmation using the supplied verification link', () => {
        const email = getEmailConfirmationEmail({
            name: 'Ayush Sharma',
            verificationLink: 'https://example.com/verify?token=123'
        });

        expect(email.subject).toBe(`Confirm your email for ${APP_NAME}`);
        expect(email.html).toContain('https://example.com/verify?token=123');
        expect(email.html).toContain('Confirm Email');
    });
});
