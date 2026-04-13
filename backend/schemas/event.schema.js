const { z } = require('zod');

// We use nonstrict() here as frontend translation models often inject 
// _i18n suffixed fields dynamically which vary.
const createEventSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().optional().nullable(),
    date: z.string().optional().nullable(), // Legacy support
    start_date: z.string().datetime().optional().nullable(),
    end_date: z.string().datetime().optional().nullable(),
    location: z.string().optional().nullable(),
    capacity: z.number().int().min(0).optional().nullable(),
    price: z.number().min(0).optional().nullable(),
    category: z.string().optional().nullable(),
    image: z.string().url().optional().nullable(),
    status: z.string().optional().nullable()
}).nonstrict();

const updateEventSchema = createEventSchema;

module.exports = {
    createEventSchema,
    updateEventSchema
};
