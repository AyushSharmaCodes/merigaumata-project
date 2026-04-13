import { z } from 'zod';

export const createAddressSchema = z.object({
    type: z.enum(['home', 'work', 'other', 'shipping', 'billing', 'both'], {
        required_error: "Address type is required"
    }),
    address_line1: z.string().min(5, "Street address must be at least 5 characters").max(255),
    address_line2: z.string().max(100).optional().nullable(),
    city: z.string().min(2, "City is required").max(100),
    state: z.string().min(2, "State is required").max(100),
    postal_code: z.string().min(4, "Invalid postal code").max(20),
    country: z.string().min(2).max(100).optional().default('India'),
    is_primary: z.boolean().optional().default(false),
    phone: z.string().min(10, "Phone number must be at least 10 digits").max(20),
    full_name: z.string().max(100, "Name is too long").optional(),
});

export type CreateAddressFormValues = z.infer<typeof createAddressSchema>;
