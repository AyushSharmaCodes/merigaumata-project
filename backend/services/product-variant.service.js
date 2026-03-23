const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const RazorpaySyncService = require('./razorpay-sync.service');
const { LOGS, INVENTORY } = require('../constants/messages');
const { applyTranslations } = require('../utils/i18n.util');

const log = createModuleLogger('ProductVariantService');

/**
 * Helper to delete image from Supabase Storage by URL
 * @param {string} url - Full public URL of the image
 */
async function deleteImageFromStorage(url) {
    if (!url) return;

    try {
        // Extract path from URL
        // URL format: https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
        const urlParts = url.split('/storage/v1/object/public/');
        if (urlParts.length < 2) return;

        const pathWithBucket = urlParts[1];
        const firstSlashIndex = pathWithBucket.indexOf('/');
        const bucketName = pathWithBucket.substring(0, firstSlashIndex);
        const imagePath = pathWithBucket.substring(firstSlashIndex + 1);

        log.debug(LOGS.LOG_DELETE_IMAGE_STORAGE, LOGS.LOG_DELETE_IMAGE_STORAGE, { bucketName, imagePath });

        const { error } = await supabase.storage
            .from(bucketName)
            .remove([imagePath]);

        if (error) {
            log.operationError(LOGS.LOG_DELETE_IMAGE_STORAGE_FAIL, error, { url });
        }
    } catch (err) {
        log.operationError(LOGS.LOG_DELETE_IMAGE_STORAGE_FAIL, err, { url });
    }
}

/**
 * Product Variant Service
 * Handles CRUD operations for product size variants with proper logging
 */

/**
 * @typedef {Object} ProductVariant
 * @property {string} id
 * @property {string} product_id
 * @property {string} size_label
 * @property {number} size_value
 * @property {string} unit
 * @property {number} mrp
 * @property {number} selling_price
 * @property {number} stock_quantity
 * @property {string|null} variant_image_url
 * @property {boolean} is_default
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number|null} delivery_charge
 */

/**
 * @typedef {Object} VariantCreateData
 * @property {string} size_label
 * @property {number} size_value
 * @property {string} unit
 * @property {string} [description]
 * @property {number} mrp
 * @property {number} selling_price
 * @property {number} stock_quantity
 * @property {string} [variant_image_url]
 * @property {boolean} [is_default]
 * @property {number} [delivery_charge]
 */

/**
 * Get all variants for a product
 * @param {string} productId - Product UUID
 * @returns {Promise<ProductVariant[]>}
 */
async function getVariantsByProductId(productId) {
    log.operationStart(LOGS.LOG_GET_VARIANTS_BY_PRODUCT, { productId });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('size_value', { ascending: true });

    if (error) {
        log.operationError(LOGS.LOG_GET_VARIANTS_BY_PRODUCT, error, { productId });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_GET_VARIANTS_BY_PRODUCT, {
        productId,
        variantCount: data?.length || 0
    }, Date.now() - startTime);

    // Dynamic Data i18n
    const lang = global.reqLanguage || 'en';
    return applyTranslations(data || [], lang);
}

/**
 * Get a single variant by ID
 * @param {string} variantId - Variant UUID
 * @returns {Promise<ProductVariant|null>}
 */
async function getVariantById(variantId) {
    log.operationStart(LOGS.LOG_GET_VARIANT_BY_ID, { variantId });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('id', variantId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            log.debug(LOGS.LOG_GET_VARIANT_BY_ID, LOGS.INV_PRODUCT_NOT_FOUND, { variantId });
            return null;
        }
        log.operationError(LOGS.LOG_GET_VARIANT_BY_ID, error, { variantId });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_GET_VARIANT_BY_ID, { variantId }, Date.now() - startTime);
    return data;
}

/**
 * Get the default variant for a product
 * @param {string} productId - Product UUID
 * @returns {Promise<ProductVariant|null>}
 */
async function getDefaultVariant(productId) {
    log.operationStart(LOGS.LOG_GET_DEFAULT_VARIANT, { productId });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_default', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            log.debug(LOGS.LOG_GET_DEFAULT_VARIANT, LOGS.LOG_GET_DEFAULT_VARIANT, { productId });
            return null;
        }
        log.operationError(LOGS.LOG_GET_DEFAULT_VARIANT, error, { productId });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_GET_DEFAULT_VARIANT, { productId, variantId: data?.id }, Date.now() - startTime);
    return data;
}

/**
 * Create a new variant for a product
 * @param {string} productId - Product UUID
 * @param {VariantCreateData} variantData - Variant data
 * @returns {Promise<ProductVariant>}
 */
async function createVariant(productId, variantData) {
    log.operationStart(LOGS.LOG_CREATE_VARIANT, {
        productId,
        sizeLabel: variantData.size_label,
        isDefault: variantData.is_default
    });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .insert({
            product_id: productId,
            size_label: variantData.size_label,
            size_label_i18n: variantData.size_label_i18n || { en: variantData.size_label },
            size_value: variantData.size_value,
            unit: variantData.unit || 'kg',
            description: variantData.description || null,
            mrp: variantData.mrp,
            selling_price: variantData.selling_price,
            stock_quantity: variantData.stock_quantity || 0,
            variant_image_url: variantData.variant_image_url || null,
            is_default: variantData.is_default || false,
            delivery_charge: variantData.delivery_charge !== undefined ? variantData.delivery_charge : null,
            // GST Fields
            hsn_code: variantData.hsn_code || null,
            gst_rate: variantData.gst_rate !== undefined ? variantData.gst_rate : 0,
            tax_applicable: variantData.tax_applicable !== undefined ? variantData.tax_applicable : true,
            price_includes_tax: variantData.price_includes_tax !== undefined ? variantData.price_includes_tax : true
        })
        .select()
        .single();

    if (error) {
        log.operationError(LOGS.LOG_CREATE_VARIANT, error, { productId, sizeLabel: variantData.size_label });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_CREATE_VARIANT, {
        variantId: data.id,
        productId,
        sizeLabel: data.size_label
    }, Date.now() - startTime);

    // --- RAZORPAY SYNC START ---
    try {
        const { data: product } = await supabase.from('products').select('title').eq('id', productId).single();
        const productName = product?.title || INVENTORY.DEFAULT_PRODUCT_TITLE;

        await RazorpaySyncService.createItem({
            name: `${productName} - ${data.size_label}`,
            description: data.description || `${INVENTORY.VARIANT_LABEL}: ${data.size_label}`,
            amount: data.selling_price * 100,
            currency: 'INR',
            hsn_code: data.hsn_code,
            tax_rate: data.gst_rate,
            tax_inclusive: data.price_includes_tax
        }).then(async (item) => {
            if (item?.id) {
                await supabase.from('product_variants').update({ razorpay_item_id: item.id }).eq('id', data.id);
                data.razorpay_item_id = item.id;
            }
        });
    } catch (err) {
        log.operationError(LOGS.LOG_RAZORPAY_SYNC_FAIL, err, { productId });
    }
    // --- RAZORPAY SYNC END ---

    return data;
}

/**
 * Update an existing variant
 * @param {string} variantId - Variant UUID
 * @param {Partial<VariantCreateData>} updates - Fields to update
 * @returns {Promise<ProductVariant>}
 */
async function updateVariant(variantId, updates) {
    log.operationStart(LOGS.LOG_UPDATE_VARIANT, { variantId, updateFields: Object.keys(updates) });
    const startTime = Date.now();

    // Fetch existing for image cleanup check
    const existingVariant = await getVariantById(variantId);

    // Check if image is being replaced
    if (existingVariant?.variant_image_url && updates.variant_image_url &&
        existingVariant.variant_image_url !== updates.variant_image_url) {
        // Run asynchronously
        deleteImageFromStorage(existingVariant.variant_image_url).catch(err =>
            log.operationError(LOGS.LOG_IMG_CLEANUP_FAIL, err, { variantId })
        );
    }

    const { data, error } = await supabase
        .from('product_variants')
        .update({
            ...updates,
            size_label_i18n: updates.size_label_i18n || existingVariant.size_label_i18n,
            updated_at: new Date().toISOString()
        })
        .eq('id', variantId)
        .select()
        .single();

    if (error) {
        log.operationError(LOGS.LOG_UPDATE_VARIANT, error, { variantId });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_UPDATE_VARIANT, { variantId, sizeLabel: data.size_label }, Date.now() - startTime);

    // --- RAZORPAY SYNC UPDATE ---
    if (data.razorpay_item_id) {
        RazorpaySyncService.updateItem(data.razorpay_item_id, {
            amount: data.selling_price * 100,
            description: data.description
        }).catch(err => log.operationError(LOGS.LOG_RAZORPAY_UPDATE_FAIL, err));
    }
    // ---------------------------

    return data;
}

/**
 * Delete a variant
 * @param {string} variantId - Variant UUID
 * @returns {Promise<void>}
 */
async function deleteVariant(variantId) {
    log.operationStart(LOGS.LOG_DELETE_VARIANT, { variantId });
    const startTime = Date.now();

    // Get variant info for logging before deletion
    const variant = await getVariantById(variantId);

    // Delete image from storage if exists
    if (variant?.variant_image_url) {
        deleteImageFromStorage(variant.variant_image_url).catch(err =>
            log.operationError(LOGS.LOG_IMG_CLEANUP_FAIL, err, { variantId })
        );
    }

    const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

    if (error) {
        log.operationError(LOGS.LOG_DELETE_VARIANT, error, { variantId });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_DELETE_VARIANT, {
        variantId,
        productId: variant?.product_id,
        sizeLabel: variant?.size_label
    }, Date.now() - startTime);

    // --- RAZORPAY SYNC DELETE ---
    if (variant?.razorpay_item_id) {
        RazorpaySyncService.deleteItem(variant.razorpay_item_id).catch(err =>
            log.operationError(LOGS.LOG_RAZORPAY_DELETE_FAIL, err, { itemId: variant.razorpay_item_id })
        );
    }
    // ---------------------------
}

/**
 * Set a variant as the default for its product
 * @param {string} productId - Product UUID
 * @param {string} variantId - Variant UUID to set as default
 * @returns {Promise<ProductVariant>}
 */
async function setDefaultVariant(productId, variantId) {
    log.operationStart(LOGS.LOG_SET_DEFAULT_VARIANT, { productId, variantId });
    const startTime = Date.now();

    // The trigger in the database handles unsetting other defaults
    const { data, error } = await supabase
        .from('product_variants')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', variantId)
        .eq('product_id', productId)
        .select()
        .single();

    if (error) {
        log.operationError(LOGS.LOG_SET_DEFAULT_VARIANT, error, { productId, variantId });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_SET_DEFAULT_VARIANT, {
        productId,
        variantId,
        sizeLabel: data.size_label
    }, Date.now() - startTime);

    return data;
}

/**
 * Create a product with variants atomically using RPC
 * @param {Object} productData - Product data
 * @param {VariantCreateData[]} variants - Array of variant data
 * @returns {Promise<{id: string, variant_ids: string[]}>}
 */
async function createProductWithVariants(productData, variants) {
    log.operationStart(LOGS.LOG_CREATE_PRODUCT_VARIANTS, {
        title: productData.title,
        variantCount: variants.length
    });
    const startTime = Date.now();

    // Constraint: Inventory must match sum of variant stocks if variants exist
    if (variants && variants.length > 0) {
        const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        productData.inventory = totalStock;
        log.info(LOGS.LOG_CREATE_PRODUCT_VARIANTS, `Calculated total inventory from ${variants.length} variants: ${totalStock}`);

        // Logic: If Price/MRP are missing, calculate from variants (Lowest Selling Price Strategy)
        if (!productData.price || !productData.mrp) {
            // Find variant with lowest selling price to represent "Starting from"
            const cheapestVariant = variants.reduce((min, curr) =>
                (curr.selling_price < min.selling_price) ? curr : min
                , variants[0]);

            if (!productData.price) {
                productData.price = cheapestVariant.selling_price;
                log.info(LOGS.LOG_CREATE_PRODUCT_VARIANTS, `Auto-setting product price to ${cheapestVariant.selling_price} from variant ${cheapestVariant.size_label}`);
            }

            if (!productData.mrp) {
                // Ideally use the MRP of the cheapest variant to keep discount scaling consistent
                productData.mrp = cheapestVariant.mrp;
                log.info(LOGS.LOG_CREATE_PRODUCT_VARIANTS, `Auto-setting product MRP to ${cheapestVariant.mrp} from variant ${cheapestVariant.size_label}`);
            }
        }
    }

    // Normalize product data fields for RPC
    // We provide both versions to be compatible with old and new RPC definitions
    const { delivery_config, ...normalizedProduct } = productData;

    if (normalizedProduct.isReturnable !== undefined) {
        normalizedProduct.is_returnable = normalizedProduct.isReturnable;
        delete normalizedProduct.isReturnable;
    }
    if (normalizedProduct.returnDays !== undefined) {
        normalizedProduct.return_days = normalizedProduct.returnDays;
        delete normalizedProduct.returnDays;
    }
    if (normalizedProduct.deliveryCharge !== undefined) {
        delete normalizedProduct.deliveryCharge;
    }
    if (normalizedProduct.isNew !== undefined) {
        normalizedProduct.is_new = normalizedProduct.isNew;
        delete normalizedProduct.isNew;
    }
    if (normalizedProduct.createdAt !== undefined) {
        normalizedProduct.created_at = normalizedProduct.createdAt;
        delete normalizedProduct.createdAt;
    }
    if (normalizedProduct.updatedAt !== undefined) {
        normalizedProduct.updated_at = normalizedProduct.updatedAt;
        delete normalizedProduct.updatedAt;
    }

    const { data, error } = await supabase.rpc('create_product_with_variants', {
        p_product_data: normalizedProduct,
        p_variants: variants
    });

    if (error) {
        log.operationError(LOGS.LOG_CREATE_PRODUCT_VARIANTS, error, { title: productData.title });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_CREATE_PRODUCT_VARIANTS, {
        productId: data?.id,
        variantIds: data?.variant_ids,
        variantCount: data?.variant_ids?.length || 0
    }, Date.now() - startTime);

    // --- HANDLE DELIVERY CONFIGS ---
    if (variants && variants.length > 0) {
        (async () => {
            try {
                // Map created variant IDs using size_label as key
                const { data: createdVariants } = await supabase
                    .from('product_variants')
                    .select('id, size_label')
                    .in('id', data.variant_ids);

                if (createdVariants) {
                    const variantMap = new Map(createdVariants.map(v => [v.size_label, v.id]));
                    const configInserts = [];

                    if (productData.delivery_config) {
                        configInserts.push({
                            ...productData.delivery_config,
                            product_id: data.id,
                            variant_id: null,
                            scope: 'PRODUCT'
                        });
                    }

                    for (const v of variants) {
                        if (v.delivery_config && variantMap.has(v.size_label)) {
                            configInserts.push({
                                ...v.delivery_config,
                                product_id: null,
                                variant_id: variantMap.get(v.size_label),
                                scope: 'VARIANT'
                            });
                        }
                    }

                    if (configInserts.length > 0) {
                        const { error: configError } = await supabase
                            .from('delivery_configs')
                            .insert(configInserts);
                        if (configError) log.operationError(LOGS.LOG_CREATE_VARIANT_CONFIG_FAIL, configError);
                    }
                }
            } catch (err) {
                log.operationError(LOGS.LOG_CREATE_VARIANT_CONFIG_FAIL, err);
            }
        })();
    }

    // --- POST-TRANSACTION RAZORPAY SYNC ---
    // User Requirement: Sync only AFTER successful creation
    if (data.variant_ids && data.variant_ids.length > 0) {
        // Run asynchronously to not block response
        (async () => {
            try {
                // Fetch the created variants to get price/tax details
                const { data: createdVariants } = await supabase
                    .from('product_variants')
                    .select('*')
                    .in('id', data.variant_ids);

                if (createdVariants) {
                    for (const variant of createdVariants) {
                        try {
                            // Reuse logic via service call wrapper or direct sync
                            // Using direct sync here to avoid redundant fetch in createVariant (though createVariant has it too, this path bypasses createVariant)

                            // Re-fetch product title if needed, or use productData.title
                            const itemName = `${productData.title} - ${variant.size_label}`;

                            const rzpItem = await RazorpaySyncService.createItem({
                                name: itemName,
                                description: variant.description || `Variant: ${variant.size_label}`,
                                amount: variant.selling_price * 100,
                                currency: 'INR',
                                hsn_code: variant.hsn_code,
                                tax_rate: variant.gst_rate,
                                tax_inclusive: variant.price_includes_tax
                            });

                            if (rzpItem?.id) {
                                await supabase.from('product_variants')
                                    .update({ razorpay_item_id: rzpItem.id })
                                    .eq('id', variant.id);
                            }
                        } catch (itemSyncErr) {
                            log.operationError(LOGS.LOG_SYNC_VARIANT_FAIL, itemSyncErr, { variantId: variant.id });
                        }
                    }
                }
            } catch (err) {
                log.operationError(LOGS.LOG_POST_CREATE_SYNC_FAIL, err);
            }
        })();
    }
    // -------------------------------------

    return data;
}

/**
 * Update a product with variants atomically using RPC
 * @param {string} productId - Product UUID
 * @param {Object} productData - Product data to update
 * @param {Array} variants - Array of variant data (with id for update, without for create)
 * @returns {Promise<{id: string, updated_variants: string[], new_variants: string[]}>}
 */
async function updateProductWithVariants(productId, productData, variants) {
    log.operationStart(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, {
        productId,
        variantCount: variants?.length || 0
    });
    const startTime = Date.now();

    // 1. Fetch CURRENT variants to detect deletions and replaced images
    // We do this BEFORE the RPC call which modifies the DB
    let existingVariants = [];
    try {
        const { data } = await supabase
            .from('product_variants')
            .select('id, variant_image_url')
            .eq('product_id', productId);
        existingVariants = data || [];
    } catch (err) {
        log.warn(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, 'Failed to fetch existing variants for cleanup', err);
    }

    // Constraint: Inventory must match sum of variant stocks if variants exist
    if (variants && variants.length > 0) {
        const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        // Ensure productData exists or create it
        productData = productData || {};
        productData.inventory = totalStock;

        // Logic: If Price/MRP are missing (and not deliberately set to null/0 by update), recalculate
        // Note: For updates, we usually only update what's passed. But if price is passed as 0 or undefined AND we have variants, we might want to recalc.
        // For safety in this "optional UI" context, let's say if the user saves with empty price, frontend sends 0 or null.
        // We re-evaluate if price is falsy.
        if (!productData.price || !productData.mrp) {
            const cheapestVariant = variants.reduce((min, curr) =>
                (curr.selling_price < min.selling_price) ? curr : min
                , variants[0]);

            if (!productData.price) {
                productData.price = cheapestVariant.selling_price;
                log.info(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, `Auto-setting product price to ${cheapestVariant.selling_price}`);
            }
            if (!productData.mrp) {
                productData.mrp = cheapestVariant.mrp;
                log.info(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, `Auto-setting product MRP to ${cheapestVariant.mrp}`);
            }
        }

        log.info(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, `Calculated total inventory from ${variants.length} variants: ${totalStock}`);
    }

    // Normalize product data fields for RPC
    // We provide both versions to be compatible with old and new RPC definitions
    const { delivery_config, ...normalizedProduct } = productData;

    if (normalizedProduct.isReturnable !== undefined) {
        normalizedProduct.is_returnable = normalizedProduct.isReturnable;
        delete normalizedProduct.isReturnable;
    }
    if (normalizedProduct.returnDays !== undefined) {
        normalizedProduct.return_days = normalizedProduct.returnDays;
        delete normalizedProduct.returnDays;
    }
    if (normalizedProduct.deliveryCharge !== undefined) {
        delete normalizedProduct.deliveryCharge;
    }
    if (normalizedProduct.isNew !== undefined) {
        normalizedProduct.is_new = normalizedProduct.isNew;
        delete normalizedProduct.isNew;
    }
    if (normalizedProduct.createdAt !== undefined) {
        normalizedProduct.created_at = normalizedProduct.createdAt;
        delete normalizedProduct.createdAt;
    }
    if (normalizedProduct.updatedAt !== undefined) {
        normalizedProduct.updated_at = normalizedProduct.updatedAt;
        delete normalizedProduct.updatedAt;
    }

    log.debug(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, 'Payload for RPC:', {
        productId,
        is_returnable: normalizedProduct.is_returnable,
        return_days: normalizedProduct.return_days
    });

    const { data, error } = await supabase.rpc('update_product_with_variants', {
        p_product_id: productId,
        p_product_data: normalizedProduct,
        p_variants: variants
    });

    if (error) {
        log.operationError(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, error, { productId });
        throw error;
    }

    // Image Cleanup Logic (Run asynchronously)
    (async () => {
        try {
            const incomingVariantIds = new Set(variants.filter(v => v.id).map(v => v.id));
            const incomingMap = new Map(variants.filter(v => v.id).map(v => [v.id, v]));

            // A. Detect Deleted Variants (Exist in DB but NOT in incoming)
            // Assumes RPC deletes missing variants (sync behavior)
            const deletedVariants = existingVariants.filter(v => !incomingVariantIds.has(v.id));

            for (const v of deletedVariants) {
                if (v.variant_image_url) {
                    await deleteImageFromStorage(v.variant_image_url);
                }
            }

            // B. Detect Updated Variants with Changed Images
            const updatedVariants = existingVariants.filter(v => incomingVariantIds.has(v.id));

            for (const oldVariant of updatedVariants) {
                const newVariant = incomingMap.get(oldVariant.id);
                // If old had image, and new has DIFFERENT image (including null)
                if (oldVariant.variant_image_url &&
                    oldVariant.variant_image_url !== newVariant.variant_image_url) {
                    await deleteImageFromStorage(oldVariant.variant_image_url);
                }
            }
        } catch (cleanupErr) {
            log.operationError(LOGS.LOG_VARIANT_IMG_CLEANUP_FAIL, cleanupErr);
        }
    })();

    log.operationSuccess(LOGS.LOG_UPDATE_PRODUCT_VARIANTS, {
        productId: data?.id,
        updatedVariants: data?.updated_variants?.length || 0,
        newVariants: data?.new_variants?.length || 0
    }, Date.now() - startTime);

    // --- HANDLE DELIVERY CONFIGS UPDATE ---
    if (variants && variants.length > 0) {
        (async () => {
            try {
                // For updates, we usually have IDs for existing. For new, we need to fetch.
                // We can fetch all current variants for this product to be safe
                const { data: currentVariants } = await supabase
                    .from('product_variants')
                    .select('id, size_label')
                    .eq('product_id', productId);

                if (currentVariants) {
                    const variantMap = new Map(currentVariants.map(v => [v.size_label, v.id]));
                    // Also map by ID if available in input, for simpler lookup
                    currentVariants.forEach(v => variantMap.set(v.id, v.id));

                    const configUpserts = [];

                    if (productData.delivery_config) {
                        await supabase
                            .from('delivery_configs')
                            .delete()
                            .eq('product_id', productId)
                            .eq('scope', 'PRODUCT');

                        configUpserts.push({
                            ...productData.delivery_config,
                            product_id: productId,
                            variant_id: null,
                            scope: 'PRODUCT',
                            updated_at: new Date().toISOString()
                        });
                    }

                    for (const v of variants) {
                        // v.id might be present (update) or missing (new)
                        // Try to find resolved ID
                        const resolvedId = v.id || variantMap.get(v.size_label);

                        if (resolvedId && v.delivery_config) {
                            await supabase
                                .from('delivery_configs')
                                .delete()
                                .eq('variant_id', resolvedId)
                                .eq('scope', 'VARIANT');

                            configUpserts.push({
                                ...v.delivery_config,
                                product_id: null,
                                variant_id: resolvedId,
                                scope: 'VARIANT',
                                updated_at: new Date().toISOString()
                            });
                        }
                    }

                    if (configUpserts.length > 0) {
                        // Delete then insert avoids unique constraint issues efficiently
                        const { error: configError } = await supabase
                            .from('delivery_configs')
                            .insert(configUpserts);

                        if (configError) log.operationError(LOGS.LOG_UPDATE_VARIANT_CONFIG_FAIL, configError);
                    }
                }
            } catch (err) {
                log.operationError(LOGS.LOG_UPDATE_VARIANT_CONFIG_FAIL, err);
            }
        })();
    }

    // --- POST-TRANSACTION RAZORPAY SYNC ---
    const allAffectedVariantIds = [
        ...(data.updated_variants || []),
        ...(data.new_variants || [])
    ];

    if (allAffectedVariantIds.length > 0) {
        (async () => {
            try {
                const { data: variants } = await supabase
                    .from('product_variants')
                    .select('*')
                    .in('id', allAffectedVariantIds);

                if (variants) {
                    // We need product title for creating new items name
                    const { data: product } = await supabase.from('products').select('title').eq('id', productId).single();
                    const productTitle = product?.title || INVENTORY.DEFAULT_PRODUCT_TITLE;

                    for (const variant of variants) {
                        try {
                            // If it already has an ID, update it. If not, create it.
                            // BUT, even "updated" variants might be new to Razorpay if they were made before this feature.
                            // Logic: If razorpay_item_id exists, UPDATE. Else CREATE.

                            const itemName = `${productTitle} - ${variant.size_label}`;
                            const itemPayload = {
                                name: itemName,
                                description: variant.description || `Variant: ${variant.size_label}`,
                                amount: variant.selling_price * 100,
                                currency: 'INR',
                                hsn_code: variant.hsn_code,
                                tax_rate: variant.gst_rate,
                                tax_inclusive: variant.price_includes_tax
                            };

                            if (variant.razorpay_item_id) {
                                // UPDATE
                                await RazorpaySyncService.updateItem(variant.razorpay_item_id, itemPayload);
                            } else {
                                // CREATE
                                const rzpItem = await RazorpaySyncService.createItem(itemPayload);
                                if (rzpItem?.id) {
                                    await supabase.from('product_variants')
                                        .update({ razorpay_item_id: rzpItem.id })
                                        .eq('id', variant.id);
                                }
                            }
                        } catch (err) {
                            log.operationError(LOGS.LOG_SYNC_UPDATE_VARIANT_FAIL, err, { variantId: variant.id });
                        }
                    }
                }
            } catch (err) {
                log.operationError(LOGS.LOG_POST_UPDATE_SYNC_FAIL, err);
            }
        })();
    }
    // -------------------------------------

    return data;
}

/**
 * Check stock availability for a variant
 * @param {string} variantId - Variant UUID
 * @param {number} requestedQuantity - Quantity to check
 * @returns {Promise<{available: boolean, currentStock: number}>}
 */
async function checkVariantStock(variantId, requestedQuantity) {
    log.debug(LOGS.LOG_CHECK_VARIANT_STOCK, 'Checking stock availability', { variantId, requestedQuantity });

    const variant = await getVariantById(variantId);

    if (!variant) {
        log.warn(LOGS.LOG_CHECK_VARIANT_STOCK, LOGS.INV_PRODUCT_NOT_FOUND, { variantId });
        return { available: false, currentStock: 0 };
    }

    const available = variant.stock_quantity >= requestedQuantity;

    log.debug(LOGS.LOG_CHECK_VARIANT_STOCK, 'Stock check result', {
        variantId,
        currentStock: variant.stock_quantity,
        requestedQuantity,
        available
    });

    return {
        available,
        currentStock: variant.stock_quantity
    };
}

/**
 * Decrease variant stock (for order placement)
 * @param {string} variantId - Variant UUID
 * @param {number} quantity - Quantity to decrease
 * @returns {Promise<ProductVariant>}
 */
async function decreaseVariantStock(variantId, quantity) {
    log.operationStart(LOGS.LOG_DECREASE_VARIANT_STOCK, { variantId, quantity });
    const startTime = Date.now();

    const { data, error } = await supabase.rpc('decrease_variant_stock', {
        p_variant_id: variantId,
        p_quantity: quantity
    });

    if (error) {
        log.operationError(LOGS.LOG_DECREASE_VARIANT_STOCK, error, { variantId, quantity });
        throw error;
    }

    log.operationSuccess(LOGS.LOG_DECREASE_VARIANT_STOCK, {
        variantId,
        decreasedBy: quantity,
        newStock: data?.stock_quantity
    }, Date.now() - startTime);

    return data;
}

module.exports = {
    getVariantsByProductId,
    getVariantById,
    getDefaultVariant,
    createVariant,
    updateVariant,
    deleteVariant,
    setDefaultVariant,
    createProductWithVariants,
    updateProductWithVariants,
    checkVariantStock,
    decreaseVariantStock
};
