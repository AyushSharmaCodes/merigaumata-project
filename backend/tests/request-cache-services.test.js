const { runWithContext } = require('../utils/async-context');

const mockCartSingle = jest.fn();
const mockCartSelect = jest.fn(() => ({
    eq: jest.fn(() => ({
        single: mockCartSingle
    }))
}));

const mockAddressSingle = jest.fn();
const mockAddressEqUser = jest.fn(() => ({
    single: mockAddressSingle
}));
const mockAddressEqId = jest.fn(() => ({
    eq: mockAddressEqUser
}));
const mockAddressSelect = jest.fn(() => ({
    eq: mockAddressEqId
}));

jest.mock('../lib/supabase', () => ({
    from: jest.fn((table) => {
        if (table === 'carts') {
            return { select: mockCartSelect };
        }
        if (table === 'addresses') {
            return { select: mockAddressSelect };
        }
        throw new Error(`Unexpected table: ${table}`);
    })
}));

jest.mock('../services/settings.service', () => ({
    getDeliverySettings: jest.fn()
}));

jest.mock('../services/coupon.service', () => ({
    validateCoupon: jest.fn(),
    calculateCouponDiscount: jest.fn(),
    getCachedCoupon: jest.fn()
}));

jest.mock('../services/delivery-charge.service', () => ({
    DeliveryChargeService: {}
}));

jest.mock('../services/pricing-calculator.service', () => ({
    PricingCalculator: {
        calculateCheckoutTotals: jest.fn()
    }
}));

const CartService = require('../services/cart.service');
const AddressService = require('../services/address.service');

describe('request-scoped service caching', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.reqLanguage = 'en';
    });

    test('getUserCart reuses the same cart read within one request context', async () => {
        mockCartSingle.mockResolvedValue({
            data: { id: 'cart-1', user_id: 'user-1', guest_id: null, cart_items: [] },
            error: null
        });

        await runWithContext({}, async () => {
            await CartService.getUserCart('user-1', null, { createIfMissing: false });
            await CartService.getUserCart('user-1', null, { createIfMissing: false });
        });

        expect(mockCartSelect).toHaveBeenCalledTimes(1);
        expect(mockCartSingle).toHaveBeenCalledTimes(1);
    });

    test('getAddressById reuses the same address read within one request context', async () => {
        mockAddressSingle.mockResolvedValue({
            data: {
                id: 'addr-1',
                user_id: 'user-1',
                street_address: 'Street 1',
                city: 'City',
                state: 'State',
                postal_code: '123456',
                country: 'India',
                type: 'home',
                is_primary: true,
                phone_numbers: { phone_number: '9999999999' }
            },
            error: null
        });

        await runWithContext({}, async () => {
            await AddressService.getAddressById('addr-1', 'user-1');
            await AddressService.getAddressById('addr-1', 'user-1');
        });

        expect(mockAddressSelect).toHaveBeenCalledTimes(1);
        expect(mockAddressSingle).toHaveBeenCalledTimes(1);
    });
});
