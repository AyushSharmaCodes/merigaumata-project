const { z } = require('zod');

const createAddressSchema = z.object({
    type: z.enum(['home', 'work', 'other', 'shipping', 'billing', 'both']),
    address_line1: z.string().min(5).max(255),
    address_line2: z.string().max(100).optional().nullable(),
    city: z.string().min(2).max(100),
    state: z.string().min(2).max(100),
    postal_code: z.string().min(4).max(20),
    country: z.string().min(2).max(100).optional(),
    is_primary: z.boolean().optional(),
    label: z.string().max(50).optional().nullable(),
    phone: z.string().min(5).max(20),
    full_name: z.string().max(100).optional().nullable()
}).strict();

const updateAddressSchema = z.object({
    type: z.enum(['home', 'work', 'other', 'shipping', 'billing', 'both']).optional(),
    address_line1: z.string().min(5).max(255).optional(),
    address_line2: z.string().max(100).optional().nullable(),
    city: z.string().min(2).max(100).optional(),
    state: z.string().min(2).max(100).optional(),
    postal_code: z.string().min(4).max(20).optional(),
    country: z.string().min(2).max(100).optional(),
    is_primary: z.boolean().optional(),
    label: z.string().max(50).optional().nullable(),
    phone: z.string().min(5).max(20).optional(),
    full_name: z.string().max(100).optional().nullable()
}).strict();

const setPrimaryAddressSchema = z.object({
    type: z.enum(['home', 'work', 'other', 'shipping', 'billing', 'both']).optional()
}).strict();

module.exports = {
    createAddressSchema,
    updateAddressSchema,
    setPrimaryAddressSchema
};
