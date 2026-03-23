const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { deletePhotosByUrls } = require('./photo.service');
const RazorpaySyncService = require('./razorpay-sync.service');
const { LOGS, INVENTORY } = require('../constants/messages');
const { applyTranslations } = require('../utils/i18n.util');

/**
 * Product Service
 * Handles product retrieval, rating processing, and product lifecycle management.
 */

class ProductService {
    /**
     * Get all products with dynamic ratings and pagination
     */
    static async getAllProducts({ page = 1, limit = 15, search = '', category = 'all', sortBy = 'newest', lang = 'en' } = {}) {
        const offset = (page - 1) * limit;

        // Parallel requests: Products Query + Inventory Stats
        // 1. Build Products Query
        let query = supabase
            .from('products')
            .select('*, variants:product_variants(*), category_data:categories(*)', { count: 'exact' });

        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        switch (sortBy) {
            case 'priceLowHigh':
                query = query.order('price', { ascending: true });
                break;
            case 'priceHighLow':
                query = query.order('price', { ascending: false });
                break;
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        const productsPromise = query
            .range(offset, offset + limit - 1);

        // 2. Build Stats Queries (Global alerts across all inventory)
        // Note: These definitions use the user's criteria:
        // - Out of Stock: inventory == 0
        // - Critical: inventory < 15 (excluding 0 if we want distinct, but usually "below 15" implies 0-14)
        // - Low: inventory < 50 (usually 15-49 if distinct, but "below 50" covers all)
        // I will return raw counts of matching criteria, frontend handles overlap display logic.
        const statsPromise = Promise.all([
            supabase.from('products').select('id', { count: 'exact', head: true }).eq('inventory', 0),
            supabase.from('products').select('id', { count: 'exact', head: true }).gt('inventory', 0).lt('inventory', 15),
            supabase.from('products').select('id', { count: 'exact', head: true }).gte('inventory', 15).lt('inventory', 50)
        ]);

        const [{ data: products, error, count }, statsResults] = await Promise.all([
            productsPromise,
            statsPromise
        ]);

        if (error) throw error;

        const outOfStockCount = statsResults[0].count || 0;
        const criticalStockCount = statsResults[1].count || 0;
        const lowStockCount = statsResults[2].count || 0;

        if (!products || products.length === 0) {
            return {
                products: [],
                total: 0,
                stats: { outOfStockCount, criticalStockCount, lowStockCount }
            };
        }

        // Get IDs of fetched products to optimize review and config fetching
        const productIds = products.map(p => p.id);

        // Calculate isNew
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        products.forEach(product => {
            const createdDateStr = product.createdAt || product.created_at;
            product.isNew = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;
        });

        // Language processing and removing bulky i18n JSONs
        const localizedProducts = applyTranslations(products, lang);

        return {
            products: localizedProducts,
            total: count,
            stats: { outOfStockCount, criticalStockCount, lowStockCount }
        };
    }

    /**
     * Get single product by ID with variants
     */
    static async getProductById(id, lang = 'en') {
        const { data, error } = await supabase
            .from('products')
            .select('*, variants:product_variants(*), category_data:categories(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Fetch variants for this product
        const { data: variants, error: variantError } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', id)
            .order('size_value', { ascending: true });

        if (!variantError && variants) {
            data.variants = variants;
            // Find default variant
            const defaultVariant = variants.find(v => v.is_default) || variants[0];
            data.defaultVariant = defaultVariant || null;
        } else {
            data.variants = [];
            data.defaultVariant = null;
        }

        // rating, ratingCount and reviewCount are now part of the product record
        // No need to fetch and calculate on every request.
        if (!data.rating) data.rating = 0;
        if (!data.ratingCount) data.ratingCount = 0;
        if (!data.reviewCount) data.reviewCount = 0;

        // Fetch Delivery Configs (Product and Variant level)
        const { data: deliveryConfigs, error: configError } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('is_active', true)
            .or(`product_id.eq.${id},variant_id.in.(${variants && variants.length > 0 ? variants.map(v => v.id).join(',') : '00000000-0000-0000-0000-000000000000'})`);

        if (!configError && deliveryConfigs) {
            // Attach product-level config
            const productConfig = deliveryConfigs.find(c => c.scope === 'PRODUCT' && c.product_id === id);
            data.delivery_config = productConfig || null;

            // Attach variant-level configs to variants
            if (data.variants && data.variants.length > 0) {
                data.variants = data.variants.map(v => {
                    const variantConfig = deliveryConfigs.find(c => c.scope === 'VARIANT' && c.variant_id === v.id);
                    return { ...v, delivery_config: variantConfig || null };
                });
            }
        }


        // Calculate isNew
        const createdDateStr = data.createdAt || data.created_at;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        data.isNew = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;

        return applyTranslations(data, lang);
    }

    /**
     * Create product
     * @param {Object} productData - Product data including variant_mode
     */
    static async createProduct(productData) {
        // Extract delivery config if present
        let deliveryConfig = null;
        if (productData.delivery_config) {
            deliveryConfig = productData.delivery_config;
            delete productData.delivery_config;
        }

        // Normalize Return Policy fields for database
        if (productData.isReturnable !== undefined) {
            productData.is_returnable = productData.isReturnable;
            delete productData.isReturnable;
        }
        if (productData.returnDays !== undefined) {
            productData.return_days = productData.returnDays;
            delete productData.returnDays;
        }
        if (productData.isNew !== undefined) {
            productData.is_new = productData.isNew;
            delete productData.isNew;
        }
        if (productData.createdAt !== undefined) {
            productData.created_at = productData.createdAt;
            delete productData.createdAt;
        }
        if (productData.updatedAt !== undefined) {
            productData.updated_at = productData.updatedAt;
            delete productData.updatedAt;
        }

        // DEPRECATED: delivery_charge is no longer used directly on product
        // We ensure it's removed from payload to avoid schema errors if column remains
        if (productData.deliveryCharge !== undefined) {
            delete productData.deliveryCharge;
        }
        if (productData.delivery_charge !== undefined) {
            delete productData.delivery_charge;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) throw error;

        // Handle Delivery Config Creation
        if (deliveryConfig && data?.id) {
            try {
                const { error: configError } = await supabase
                    .from('delivery_configs')
                    .insert([{
                        ...deliveryConfig,
                        product_id: data.id,
                        scope: 'PRODUCT',
                        variant_id: null
                    }]);

                if (configError) {
                    logger.error({ err: configError }, LOGS.LOG_DELIVERY_CONFIG_CREATE_FAIL);
                    // We don't throw here to avoid failing entire product creation, but logging is critical
                }
            } catch (err) {
                logger.error({ err }, LOGS.LOG_DELIVERY_CONFIG_CREATE_FAIL);
            }
        }

        // Note: Variants are created separately via ProductVariantService
        // We only trigger sync when variants are added/updated

        return data;
    }

    /**
     * Update product
     */
    static async updateProduct(id, productData) {
        // Normalize Return Policy fields for database
        if (productData.isReturnable !== undefined) {
            productData.is_returnable = productData.isReturnable;
            delete productData.isReturnable;
        }
        if (productData.returnDays !== undefined) {
            productData.return_days = productData.returnDays;
            delete productData.returnDays;
        }
        if (productData.isNew !== undefined) {
            productData.is_new = productData.isNew;
            delete productData.isNew;
        }
        if (productData.createdAt !== undefined) {
            productData.created_at = productData.createdAt;
            delete productData.createdAt;
        }
        if (productData.updatedAt !== undefined) {
            productData.updated_at = productData.updatedAt;
            delete productData.updatedAt;
        }

        // DEPRECATED: delivery_charge is no longer used directly on product
        if (productData.deliveryCharge !== undefined) {
            delete productData.deliveryCharge;
        }
        if (productData.delivery_charge !== undefined) {
            delete productData.delivery_charge;
        }

        // Extract delivery config if present
        let deliveryConfig = null;
        if (productData.delivery_config) {
            deliveryConfig = productData.delivery_config;
            delete productData.delivery_config;
        }

        const { data, error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Handle Delivery Config Update
        if (deliveryConfig) {
            try {
                // Determine if we should update or delete (if explicitly null/empty?)
                // Usually payload contains the config to set.
                // We upsert based on product_id and scope
                const { error: configError } = await supabase
                    .from('delivery_configs')
                    .upsert({
                        ...deliveryConfig,
                        product_id: id,
                        scope: 'PRODUCT',
                        variant_id: null,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'product_id,scope,variant_id' }); // Assuming unique constraint exists

                if (configError) {
                    logger.error({ err: configError }, LOGS.LOG_DELIVERY_CONFIG_UPDATE_FAIL);
                }
            } catch (err) {
                logger.error({ err }, LOGS.LOG_DELIVERY_CONFIG_UPDATE_FAIL);
            }
        }

        return data;
    }

    /**
     * Delete product
     */
    static async deleteProduct(id) {
        // 1. Get product to find image URLs
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('images')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Get variants to find variant image URLs
        const { data: variants, error: variantError } = await supabase
            .from('product_variants')
            .select('variantImageUrl, RazorpayItemId')
            .eq('product_id', id);

        if (variantError) logger.error({ err: variantError }, LOGS.LOG_VARIANT_FETCH_FAIL);

        // 3. Delete product from database (cascade will remove variants data)
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 4. Collect all images to delete
        const imagesToDelete = [];

        // Add product images
        if (product && product.images && product.images.length > 0) {
            imagesToDelete.push(...product.images);
        }

        // Add variant images
        if (variants && variants.length > 0) {
            variants.forEach(v => {
                if (v.variant_image_url) {
                    imagesToDelete.push(v.variant_image_url);
                }
            });
        }

        // 5. Clean up all images from storage
        if (imagesToDelete.length > 0) {
            // Remove duplicates just in case
            const uniqueImages = [...new Set(imagesToDelete)];
            deletePhotosByUrls(uniqueImages).catch(err =>
                logger.error({ err }, LOGS.LOG_IMG_CLEANUP_FAIL)
            );
        }

        // 6. Cleanup Razorpay Items
        if (variants && variants.length > 0) {
            variants.forEach(v => {
                if (v.razorpay_item_id) {
                    RazorpaySyncService.deleteItem(v.razorpay_item_id).catch(err =>
                        logger.error({ err }, LOGS.LOG_RAZORPAY_ITEM_DELETE_FAIL, { itemId: v.razorpay_item_id })
                    );
                }
            });
        }

        return true;
    }
    /**
     * Export all products as CSV
     */
    static async exportAllProducts() {
        // Fetch ALL products with variants
        const { data: products, error } = await supabase
            .from('products')
            .select('*, variants:product_variants(*), category_data:categories(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!products || products.length === 0) {
            return '';
        }

        // Fetch Delivery Configs
        const { data: deliveryConfigs } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('is_active', true);

        const { flattenObject } = require('../utils/object.utils');
        const exportData = [];

        products.forEach((product) => {
            // Find product-level delivery config
            const productConfig = deliveryConfigs?.find(c => c.scope === 'PRODUCT' && c.product_id === product.id);

            const baseProduct = {
                id: product.id,
                title: product.title,
                description: product.description,
                price: product.price,
                mrp: product.mrp,
                category: product.category_data?.name || product.category,
                inventory: product.inventory,
                rating: product.rating,
                is_new: product.is_new,
                is_returnable: product.is_returnable,
                return_days: product.return_days,
                variant_mode: product.variant_mode,
                tags: product.tags ? product.tags.join('; ') : '',
                created_at: product.created_at,
                // Complex fields as JSON strings
                title_i18n: JSON.stringify(product.title_i18n || {}),
                description_i18n: JSON.stringify(product.description_i18n || {}),
                tags_i18n: JSON.stringify(product.tags_i18n || {}),
                benefits_i18n: JSON.stringify(product.benefits_i18n || {}),
                delivery_refund_policy: product.delivery_refund_policy,
                delivery_config: productConfig ? JSON.stringify(productConfig) : ''
            };

            if (product.variants && product.variants.length > 0) {
                product.variants.forEach((variant) => {
                    // Find variant-level delivery config
                    const variantConfig = deliveryConfigs?.find(c => c.scope === 'VARIANT' && c.variant_id === variant.id);

                    exportData.push(flattenObject({
                        ...baseProduct,
                        variant_id: variant.id,
                        size_label: variant.size_label,
                        size_value: variant.size_value,
                        unit: variant.unit,
                        variant_description: variant.variant_description,
                        variant_mrp: variant.mrp,
                        variant_selling_price: variant.selling_price,
                        variant_stock_quantity: variant.stock_quantity,
                        variant_image_url: variant.variant_image_url,
                        hsn_code: variant.hsn_code || product.default_hsn_code,
                        gst_rate: variant.gst_rate || product.default_gst_rate,
                        tax_applicable: variant.tax_applicable,
                        price_includes_tax: variant.price_includes_tax,
                        variant_delivery_config: variantConfig ? JSON.stringify(variantConfig) : ''
                    }));
                });
            } else {
                exportData.push(flattenObject(baseProduct));
            }
        });

        if (exportData.length === 0) return '';

        // Generate CSV String
        const headers = Array.from(new Set(exportData.flatMap(row => Object.keys(row))));

        const csvContent = [
            headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
            ...exportData.map(row =>
                headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    const stringValue = String(value);
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');

        return csvContent;
    }
}

module.exports = ProductService;
