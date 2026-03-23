const { z } = require('zod');

const createPaymentOrderSchema = z.object({
    amount: z.number().positive('errors.checkout.amountPositive').optional(), // Optional: Backend calculates this securely
    address_id: z.string().uuid('errors.checkout.invalidAddressId').optional(),
    user_profile: z.any().optional() // Allow profile pass-through
});

const verifyPaymentSchema = z.object({
    razorpay_order_id: z.string().nullish(),
    razorpay_payment_id: z.string().min(1, 'errors.checkout.paymentIdRequired'),
    razorpay_signature: z.string().nullish(),
    payment_id: z.string().nullish(),
    shipping_address_id: z.string().nullish(),
    billing_address_id: z.string().nullish(),
    notes: z.string().nullish()
});

module.exports = {
    createPaymentOrderSchema,
    verifyPaymentSchema
};
