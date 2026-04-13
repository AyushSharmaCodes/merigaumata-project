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

const mockRpc = jest.fn();
const mockCartSingle = jest.fn();
const mockCartEq = jest.fn(() => ({ single: mockCartSingle }));
const mockCartSelect = jest.fn(() => ({ eq: mockCartEq }));

jest.mock('../lib/supabase', () => ({
    from: jest.fn((table) => {
        if (table === 'carts') {
            return { select: mockCartSelect };
        }
        throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: mockRpc
}));

const CartService = require('../services/cart.service');

describe('cart merge RPC optimization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.reqLanguage = 'en';
    });

    afterEach(() => {
        delete global.reqLanguage;
    });

    test('mergeGuestCart uses consolidated RPC when available', async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                status: 'merged',
                user_cart_id: 'cart-user-1',
                merged_item_count: 2
            },
            error: null
        });

        mockCartSingle.mockResolvedValueOnce({
            data: {
                id: 'cart-user-1',
                user_id: 'user-1',
                guest_id: null,
                applied_coupon_code: null,
                cart_items: []
            },
            error: null
        });

        await CartService.mergeGuestCart('user-1', 'guest-1');

        expect(mockRpc).toHaveBeenCalledWith('merge_guest_cart_v1', {
            p_user_id: 'user-1',
            p_guest_id: 'guest-1'
        });
        expect(mockCartSelect).toHaveBeenCalled();
    });
});
