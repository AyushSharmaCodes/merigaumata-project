const { z } = require('zod');

const addToCartSchema = z.object({
    product_id: z.string().uuid('errors.cart.invalidProductId'),
    quantity: z.number().int().min(1, 'errors.cart.quantityMin').default(1),
    variant_id: z.string().uuid('errors.cart.invalidVariantId').optional().nullable()
});

const updateCartSchema = z.object({
    quantity: z.number().int().min(1, 'errors.cart.quantityMin')
});

const applyCouponSchema = z.object({
    code: z.string().min(1, 'errors.cart.couponRequired')
});

module.exports = {
    addToCartSchema,
    updateCartSchema,
    applyCouponSchema
};
