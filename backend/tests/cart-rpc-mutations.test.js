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

const mockCartSingle = jest.fn();
const mockCartEqUser = jest.fn(() => ({ single: mockCartSingle }));
const mockCartSelect = jest.fn(() => ({ eq: mockCartEqUser }));

const mockProductSingle = jest.fn();
const mockProductEq = jest.fn(() => ({ single: mockProductSingle }));
const mockProductSelect = jest.fn(() => ({ eq: mockProductEq }));

const mockRpc = jest.fn();

jest.mock('../lib/supabase', () => ({
    from: jest.fn((table) => {
        if (table === 'carts') {
            return { select: mockCartSelect };
        }
        if (table === 'products') {
            return { select: mockProductSelect };
        }
        throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: mockRpc
}));

const CartService = require('../services/cart.service');

describe('cart RPC mutations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.reqLanguage = 'en';
    });

    test('addToCart uses stock-validating atomic RPC for authenticated carts', async () => {
        mockRpc.mockResolvedValue({ data: 'cart-1', error: null });

        mockCartSingle.mockResolvedValue({
            data: {
                id: 'cart-1',
                user_id: 'user-1',
                guest_id: null,
                applied_coupon_code: null,
                cart_items: []
            },
            error: null
        });

        await CartService.addToCart('user-1', null, 'product-1', 2, 'variant-1');

        expect(mockRpc).toHaveBeenCalledWith('add_to_cart_atomic_v2', {
            p_user_id: 'user-1',
            p_product_id: 'product-1',
            p_variant_id: 'variant-1',
            p_quantity: 2
        });
        expect(mockProductSelect).not.toHaveBeenCalled();
    });

    test('updateCartItem uses variant-aware atomic RPC for authenticated carts', async () => {
        mockProductSingle.mockResolvedValue({
            data: { inventory: 10, title: 'Product 1' },
            error: null
        });

        mockRpc.mockResolvedValue({ data: 'cart-1', error: null });

        mockCartSingle.mockResolvedValue({
            data: {
                id: 'cart-1',
                user_id: 'user-1',
                guest_id: null,
                applied_coupon_code: null,
                cart_items: []
            },
            error: null
        });

        await CartService.updateCartItem('user-1', null, 'product-1', 3, null);

        expect(mockRpc).toHaveBeenCalledWith('update_cart_item_atomic_v2', {
            p_user_id: 'user-1',
            p_product_id: 'product-1',
            p_variant_id: null,
            p_quantity: 3
        });
    });

    test('removeFromCart uses variant-aware atomic RPC for authenticated carts', async () => {
        mockRpc.mockResolvedValue({ data: 'cart-1', error: null });

        mockCartSingle.mockResolvedValue({
            data: {
                id: 'cart-1',
                user_id: 'user-1',
                guest_id: null,
                applied_coupon_code: null,
                cart_items: []
            },
            error: null
        });

        await CartService.removeFromCart('user-1', null, 'product-1', 'variant-1');

        expect(mockRpc).toHaveBeenCalledWith('update_cart_item_atomic_v2', {
            p_user_id: 'user-1',
            p_product_id: 'product-1',
            p_variant_id: 'variant-1',
            p_quantity: 0
        });
    });
});
