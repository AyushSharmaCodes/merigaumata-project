const { z } = require('zod');

/**
 * Product Variant Validation Schemas
 * Uses Zod for strict type validation with descriptive error messages
 */

// Valid unit types for variants
const VARIANT_UNITS = ['kg', 'gm', 'ltr', 'ml', 'pcs'];
const VARIANT_MODES = ['UNIT', 'SIZE'];

/**
 * Base variant schema without refine chains (for use in arrays to avoid Zod v4 bug)
 */
const baseVariantSchema = z.object({
    size_label: z
        .string()
        .min(1, 'errors.inventory.sizeLabelRequired')
        .max(50, 'errors.inventory.sizeLabelLong'),
    size_label_i18n: z.record(z.string()).optional(),
    size_value: z
        .number()
        .positive('errors.inventory.sizeValuePositive')
        .optional()
        .nullable(),
    unit: z
        .string()
        .optional()
        .nullable()
        .default('kg'),
    description: z.string().optional().nullable(),
    description_i18n: z.record(z.string()).optional(),
    mrp: z
        .number()
        .positive('errors.inventory.mrpPositive'),
    selling_price: z
        .number()
        .positive('errors.inventory.pricePositive'),
    stock_quantity: z
        .number()
        .int('errors.inventory.stockInt')
        .min(0, 'errors.inventory.stockNonNegative')
        .default(0),
    variant_image_url: z
        .string()
        .url('errors.inventory.invalidImageUrl')
        .optional()
        .nullable(),
    is_default: z
        .boolean()
        .default(false),
    // GST/Tax Fields
    hsn_code: z
        .string()
        .optional()
        .nullable(),
    gst_rate: z
        .number()
        .optional()
        .nullable(),
    tax_applicable: z
        .boolean()
        .default(false),
    price_includes_tax: z
        .boolean()
        .default(true),
    razorpay_item_id: z
        .string()
        .optional()
        .nullable(),
    delivery_charge: z
        .number()
        .min(0, 'errors.inventory.deliveryChargeNonNegative')
        .optional()
        .nullable(),
    // Per-variant delivery configuration (saved to delivery_configs table)
    delivery_config: z.any().optional().nullable()
});

/**
 * Schema for creating a single variant (with validation refinements)
 */
const createVariantSchema = baseVariantSchema.refine(
    (data) => data.selling_price <= data.mrp,
    {
        message: 'errors.inventory.priceMrpLogic',
        path: ['selling_price']
    }
).refine(
    (data) => {
        // If tax_applicable is true, gst_rate should be provided
        if (data.tax_applicable && (data.gst_rate === null || data.gst_rate === undefined)) {
            return false;
        }
        return true;
    },
    {
        message: 'errors.inventory.gstRequired',
        path: ['gst_rate']
    }
);

/**
 * Schema for updating a variant
 */
const updateVariantSchema = z.object({
    id: z
        .string()
        .uuid('errors.inventory.invalidVariantId'),
    razorpay_item_id: z
        .string()
        .optional()
        .nullable(),
    size_label: z
        .string()
        .min(1)
        .max(50)
        .optional(),
    size_label_i18n: z.record(z.string()).optional(),
    size_value: z
        .number()
        .positive()
        .optional()
        .nullable(),
    unit: z
        .enum(VARIANT_UNITS)
        .optional()
        .nullable(),
    description: z.string().optional().nullable(),
    description_i18n: z.record(z.string()).optional(),
    mrp: z
        .number()
        .positive()
        .optional(),
    selling_price: z
        .number()
        .positive()
        .optional(),
    stock_quantity: z
        .number()
        .int()
        .min(0)
        .optional(),
    variant_image_url: z
        .string()
        .url()
        .optional()
        .nullable(),
    is_default: z
        .boolean()
        .optional(),
    // GST/Tax Fields
    hsn_code: z
        .string()
        .max(8)
        .regex(/^\d{4,8}$/)
        .or(z.literal(''))
        .optional()
        .nullable(),
    gst_rate: z
        .number()
        .refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val), {
            message: 'errors.inventory.gstInvalid'
        })
        .optional()
        .nullable(),
    tax_applicable: z
        .boolean()
        .optional(),
    price_includes_tax: z
        .boolean()
        .optional(),
    delivery_charge: z
        .number()
        .min(0)
        .optional()
        .nullable(),
    // Per-variant delivery configuration (saved to delivery_configs table)
    delivery_config: z.any().optional().nullable()
}).refine(
    (data) => {
        if (data.selling_price !== undefined && data.mrp !== undefined) {
            return data.selling_price <= data.mrp;
        }
        return true;
    },
    {
        message: 'errors.inventory.priceMrpLogic',
        path: ['selling_price']
    }
);

/**
 * Schema for creating a product with variants
 */
const createProductWithVariantsSchema = z.object({
    product: z.object({
        title: z.string().min(1, 'errors.inventory.titleRequired'),
        description: z.string().min(1, 'errors.inventory.descRequired'),
        category: z.string().min(1, 'errors.inventory.categoryRequired'),
        category_id: z.string().uuid().optional().nullable(),
        variant_mode: z.enum(VARIANT_MODES).default('UNIT').optional(),
        price: z.number().min(0, 'errors.inventory.priceNonNegative').optional(),
        mrp: z.number().min(0, 'errors.inventory.mrpNonNegative').optional(),
        inventory: z.number().int().min(0).optional().default(0),
        images: z.array(z.string().url()).min(1, 'errors.inventory.imageRequired'),
        tags: z.array(z.string()).optional().default([]),
        benefits: z.array(z.string()).optional().default([]),
        isReturnable: z.boolean().optional(),
        is_returnable: z.boolean().optional(),
        returnDays: z.number().int().min(0).optional(),
        return_days: z.number().int().min(0).optional(),
        default_hsn_code: z.string().max(8).regex(/^\d{4,8}$/).or(z.literal('')).optional().nullable(),
        default_gst_rate: z.number().refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val)).optional().nullable(),
        default_tax_applicable: z.boolean().default(false).optional(),
        default_price_includes_tax: z.boolean().default(true).optional(),
        delivery_charge: z.number().min(0).optional().nullable(),
        createdAt: z.string().optional(),
        title_i18n: z.record(z.string()).optional(),
        description_i18n: z.record(z.string()).optional(),
        benefits_i18n: z.record(z.array(z.string())).optional(),
        tags_i18n: z.record(z.array(z.string())).optional(),
        delivery_config: z.any().optional().nullable()
    }),
    variants: z
        .array(baseVariantSchema)
        .optional()
        .default([])
}).superRefine((data, ctx) => {
    // 1. Validate Price/MRP existence
    const hasVariants = data.variants && data.variants.length > 0;
    const hasPrice = data.product.price !== undefined && data.product.price > 0; // Handle 0 as missing
    const hasMrp = data.product.mrp !== undefined && data.product.mrp > 0;

    if (!hasVariants) {
        if (!hasPrice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'errors.inventory.priceRequiredNoVariants',
                path: ['product', 'price']
            });
        }
        if (!hasMrp) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'errors.inventory.mrpRequiredNoVariants',
                path: ['product', 'mrp']
            });
        }
    } else {
        // Variant Validation Check based on Variant Mode
        const mode = data.product.variant_mode || 'UNIT';

        data.variants.forEach((variant, index) => {
            // Validate variant mode requirements
            if (mode === 'SIZE') {
                if (!variant.description || variant.description.trim() === '') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'errors.inventory.descRequiredSizeVariants',
                        path: ['variants', index, 'description']
                    });
                }
            } else {
                // UNIT mode
                if (!variant.size_value) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'errors.inventory.sizeValueRequiredUnitVariants',
                        path: ['variants', index, 'size_value']
                    });
                }
            }

            // Validate selling_price <= mrp for each variant
            if (variant.selling_price > variant.mrp) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'errors.inventory.priceMrpLogic',
                    path: ['variants', index, 'selling_price']
                });
            }

            // Validate gst_rate required when tax_applicable is true
            if (variant.tax_applicable && (variant.gst_rate === null || variant.gst_rate === undefined)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'errors.inventory.gstRequired',
                    path: ['variants', index, 'gst_rate']
                });
            }

            // Validate gst_rate is one of the allowed values
            if (variant.gst_rate !== null && variant.gst_rate !== undefined) {
                if (![0, 5, 12, 18, 28].includes(variant.gst_rate)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'errors.inventory.gstInvalid',
                        path: ['variants', index, 'gst_rate']
                    });
                }
            }

            // Validate unit is one of the allowed values
            if (variant.unit && !VARIANT_UNITS.includes(variant.unit)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'errors.inventory.unitInvalid',
                    path: ['variants', index, 'unit']
                });
            }

            // Validate HSN code format
            if (variant.hsn_code && variant.hsn_code !== '') {
                if (variant.hsn_code.length > 8 || !/^\d{4,8}$/.test(variant.hsn_code)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'errors.inventory.hsnFormat',
                        path: ['variants', index, 'hsn_code']
                    });
                }
            }
        });
    }

    // 2. Validate Price <= MRP logic (only if both exist)
    if (hasPrice && hasMrp && data.product.price > data.product.mrp) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'errors.inventory.priceMrpLogic',
            path: ['product', 'price']
        });
    }

    // 3. Validate at least one default variant (only if variants exist)
    if (hasVariants) {
        const hasDefault = data.variants.some(v => v.is_default);
        if (!hasDefault && data.variants.length > 1) {
            if (data.variants.length > 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'errors.inventory.defaultVariantRequired',
                    path: ['variants']
                });
            }
        }
    }
});

/**
 * Schema for updating a product with variants
 */
const updateProductWithVariantsSchema = z.object({
    product: z.object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        brand: z.string().min(1).optional(),
        category_id: z.string().uuid().optional().nullable(),
        variant_mode: z.enum(VARIANT_MODES).optional(),
        price: z.number().min(0).optional(),
        mrp: z.number().min(0).optional(),
        inventory: z.number().int().min(0).optional(),
        images: z.array(z.string().url()).optional(),
        tags: z.array(z.string()).optional(),
        benefits: z.array(z.string()).optional(),
        isReturnable: z.boolean().optional(),
        is_returnable: z.boolean().optional(),
        returnDays: z.number().int().min(0).optional(),
        return_days: z.number().int().min(0).optional(),
        default_hsn_code: z.string().max(8).regex(/^\d{4,8}$/).or(z.literal('')).optional().nullable(),
        default_gst_rate: z.number().refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val)).optional().nullable(),
        default_tax_applicable: z.boolean().optional(),
        default_price_includes_tax: z.boolean().optional(),
        delivery_charge: z.number().min(0).optional().nullable(),
        createdAt: z.string().optional(),
        title_i18n: z.record(z.string()).optional(),
        description_i18n: z.record(z.string()).optional(),
        benefits_i18n: z.record(z.array(z.string())).optional(),
        tags_i18n: z.record(z.array(z.string())).optional(),
        delivery_config: z.any().optional().nullable()
    }).optional(),
    variants: z
        .array(
            z.union([
                updateVariantSchema,
                baseVariantSchema
            ])
        )
        .optional()
});

/**
 * Schema for adding to cart with variant
 */
const addToCartWithVariantSchema = z.object({
    product_id: z.string().uuid('errors.cart.invalidProductId'),
    variant_id: z.string().uuid('errors.cart.invalidVariantId').optional().nullable(),
    quantity: z.number().int().min(1, 'errors.cart.quantityMin').default(1)
});

module.exports = {
    createVariantSchema,
    updateVariantSchema,
    createProductWithVariantsSchema,
    updateProductWithVariantsSchema,
    addToCartWithVariantSchema,
    VARIANT_UNITS,
    VARIANT_MODES
};
