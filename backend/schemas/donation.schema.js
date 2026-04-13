const { z } = require('zod');

const createOneTimeOrderSchema = z.object({
    amount: z.number().positive(),
    donorName: z.string().max(100).optional(),
    donorEmail: z.string().email().max(150).optional(),
    donorPhone: z.string().max(20).optional(),
    isAnonymous: z.boolean().optional(),
    is80GRequired: z.boolean().optional(),
    panNumber: z.string().max(15).optional().nullable(),
    address: z.string().max(300).optional().nullable()
}).strict();

const createSubscriptionSchema = z.object({
    planId: z.string(),
    donorName: z.string().max(100).optional(),
    donorEmail: z.string().email().max(150).optional(),
    donorPhone: z.string().max(20).optional(),
    isAnonymous: z.boolean().optional(),
    is80GRequired: z.boolean().optional(),
    panNumber: z.string().max(15).optional().nullable(),
    address: z.string().max(300).optional().nullable()
}).strict();

const verifyDonationSchema = z.object({
    razorpay_order_id: z.string().optional(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string().optional(),
    razorpay_subscription_id: z.string().optional(),
    isSubscription: z.boolean().optional()
}).strict();

const subscriptionActionSchema = z.object({
    subscriptionId: z.string()
}).strict();

module.exports = {
    createOneTimeOrderSchema,
    createSubscriptionSchema,
    verifyDonationSchema,
    subscriptionActionSchema
};
