const { z } = require('zod');

const updateProfileSchema = z.object({
    firstName: z.string().min(1, 'errors.validation.firstNameRequired').max(100),
    lastName: z.string().max(100).optional().nullable(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    language: z.string().max(10).optional().nullable()
}).strict();

const updatePreferencesSchema = z.object({
    language: z.string().max(10).optional(),
    currency: z.string().length(3).optional()
}).strict();

module.exports = {
    updateProfileSchema,
    updatePreferencesSchema
};
