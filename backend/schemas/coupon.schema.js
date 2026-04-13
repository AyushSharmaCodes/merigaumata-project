const { z } = require('zod');

const createCouponSchema = z.object({
    code: z.string().min(3).max(50),
    type: z.enum(['product', 'category', 'cart', 'variant', 'free_delivery']),
    discount_percentage: z.number().nonnegative().max(100).optional(),
    target_id: z.string().uuid().optional().nullable(),
    min_purchase_amount: z.number().nonnegative().optional(),
    max_discount_amount: z.number().nonnegative().optional().nullable(),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    usage_limit: z.number().int().positive().optional().nullable(),
    is_active: z.boolean().optional()
}).strict();

const updateCouponSchema = z.object({
    code: z.string().min(3).max(50).optional(),
    type: z.enum(['product', 'category', 'cart', 'variant', 'free_delivery']).optional(),
    discount_percentage: z.number().nonnegative().max(100).optional(),
    target_id: z.string().uuid().optional().nullable(),
    min_purchase_amount: z.number().nonnegative().optional(),
    max_discount_amount: z.number().nonnegative().optional().nullable(),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    usage_limit: z.number().int().positive().optional().nullable(),
    is_active: z.boolean().optional()
}).strict();

module.exports = {
    createCouponSchema,
    updateCouponSchema
};
