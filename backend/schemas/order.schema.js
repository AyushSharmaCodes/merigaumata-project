const { z } = require('zod');

const ORDER_STATUSES = [
    'pending', 'confirmed', 'processing', 'packed', 'shipped', 
    'out_for_delivery', 'delivered', 'delivery_unsuccessful', 
    'cancelled', 'return_requested', 'return_approved', 
    'returned', 'partially_returned', 'refunded', 'partially_refunded'
];

const createOrderSchema = z.object({
    shipping_address_id: z.string().uuid().optional(),
    billing_address_id: z.string().uuid().optional(),
    items: z.array(z.any()).optional(), // Detailed structure left relaxed but array enforced
    payment_method: z.string().optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().optional(),
    notes: z.string().max(1000).optional(),
    display_currency: z.string().length(3).optional()
}).nonstrict(); // Some routes pass down large raw cart objects

const updateOrderStatusSchema = z.object({
    status: z.enum(ORDER_STATUSES, {
        required_error: 'errors.order.statusRequired',
        invalid_type_error: 'errors.order.invalidStatus'
    }),
    notes: z.string().max(1000).optional()
}).strict();

module.exports = {
    createOrderSchema,
    updateOrderStatusSchema
};
