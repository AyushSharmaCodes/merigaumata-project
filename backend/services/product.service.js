const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { deletePhotosByUrls } = require('./photo.service');
const RazorpaySyncService = require('./razorpay-sync.service');
const { LOGS, INVENTORY } = require('../constants/messages');
const { applyTranslations } = require('../utils/i18n.util');
const MemoryStore = require('../lib/store/memory.store');

/**
 * Product Service
 * Handles product retrieval, rating processing, and product lifecycle management.
 */

class ProductService {
    static listCache = new MemoryStore();
    static pendingListRequests = new Map();
    static listCacheVersion = 1;
    static LIST_CACHE_TTL_MS = parseInt(process.env.PRODUCT_LIST_CACHE_TTL_MS || '30000', 10);

    static inferVariantDimensions(sizeLabel, explicitUnit) {
        if (explicitUnit) {
            return { size_value: null, unit: explicitUnit };
        }

        if (!sizeLabel || typeof sizeLabel !== 'string') {
            return { size_value: null, unit: null };
        }

        const match = sizeLabel.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|gm|ltr|ml|pcs)$/i);
        if (!match) {
            return { size_value: null, unit: null };
        }

        return {
            size_value: Number(match[1]),
            unit: match[2].toLowerCase()
        };
    }

    static inferVariantMode(product = {}, variants = []) {
        if (product.variant_mode === 'UNIT' || product.variant_mode === 'SIZE') {
            return product.variant_mode;
        }

        if (!Array.isArray(variants) || variants.length === 0) {
            return 'UNIT';
        }

        const hasMeasuredVariant = variants.some((variant) => {
            const inferred = ProductService.inferVariantDimensions(variant?.size_label, variant?.unit);
            return Boolean(variant?.unit && variant.unit !== 'pcs')
                || Number.isFinite(Number(variant?.size_value))
                || Boolean(inferred.unit && inferred.unit !== 'pcs');
        });

        return hasMeasuredVariant ? 'UNIT' : 'SIZE';
    }

    static normalizeVariantDetail(variant = {}, product = {}) {
        const inferred = ProductService.inferVariantDimensions(variant.size_label, variant.unit);
        const rawSizeValue = variant.size_value ?? inferred.size_value;
        const normalizedSizeValue = rawSizeValue !== null && rawSizeValue !== undefined
            ? Number(rawSizeValue)
            : (product.variant_mode === 'SIZE' ? 1 : 0);
        const fallbackUnit = product.variant_mode === 'SIZE' ? 'pcs' : 'kg';
        const normalizedSellingPrice = variant.selling_price ?? variant.price ?? 0;

        return {
            ...variant,
            size_label: variant.size_label || '',
            size_label_i18n: variant.size_label_i18n || {},
            size_value: product.variant_mode === 'SIZE'
                ? (normalizedSizeValue > 0 ? normalizedSizeValue : 1)
                : (normalizedSizeValue !== null && normalizedSizeValue !== undefined ? Number(normalizedSizeValue) : 0),
            unit: product.variant_mode === 'SIZE'
                ? 'pcs'
                : (variant.unit || inferred.unit || fallbackUnit),
            description: variant.description || '',
            description_i18n: variant.description_i18n || {},
            mrp: variant.mrp !== null && variant.mrp !== undefined ? Number(variant.mrp) : Number(normalizedSellingPrice || 0),
            selling_price: Number(normalizedSellingPrice || 0),
            stock_quantity: Number(variant.stock_quantity || 0),
            variant_image_url: variant.variant_image_url || null,
            is_default: Boolean(variant.is_default),
            hsn_code: variant.hsn_code || product.default_hsn_code || '',
            gst_rate: variant.gst_rate !== null && variant.gst_rate !== undefined
                ? Number(variant.gst_rate)
                : Number(product.default_gst_rate || 0),
            tax_applicable: variant.tax_applicable !== undefined
                ? Boolean(variant.tax_applicable)
                : product.default_tax_applicable !== false,
            price_includes_tax: variant.price_includes_tax !== undefined
                ? Boolean(variant.price_includes_tax)
                : product.default_price_includes_tax !== false,
            delivery_charge: variant.delivery_charge !== null && variant.delivery_charge !== undefined
                ? Number(variant.delivery_charge)
                : null
        };
    }

    static pickLatestDeliveryConfig(configs = [], predicate = () => true) {
        return (configs || [])
            .filter(predicate)
            .sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                return dateB - dateA;
            })[0] || null;
    }

    static hasMeaningfulDeliveryConfig(deliveryConfig) {
        if (!deliveryConfig || typeof deliveryConfig !== 'object') {
            return false;
        }

        if (deliveryConfig.is_active === true) {
            return true;
        }

        return (
            Number(deliveryConfig.base_delivery_charge ?? 0) > 0 ||
            (deliveryConfig.calculation_type && deliveryConfig.calculation_type !== 'FLAT_PER_ORDER') ||
            Number(deliveryConfig.max_items_per_package ?? 3) !== 3 ||
            Number(deliveryConfig.unit_weight ?? 0) > 0 ||
            Number(deliveryConfig.gst_percentage ?? 18) !== 18 ||
            (deliveryConfig.is_taxable !== undefined && Boolean(deliveryConfig.is_taxable) !== true) ||
            (deliveryConfig.delivery_refund_policy && deliveryConfig.delivery_refund_policy !== 'NON_REFUNDABLE')
        );
    }

    static buildScopedDeliveryConfig({ scope, productId = null, variantId = null, deliveryConfig }) {
        if (!scope || !deliveryConfig || !ProductService.hasMeaningfulDeliveryConfig(deliveryConfig)) {
            return null;
        }

        const calculationType = deliveryConfig.calculation_type || 'FLAT_PER_ORDER';

        return {
            scope,
            product_id: scope === 'PRODUCT' ? productId : null,
            variant_id: scope === 'VARIANT' ? variantId : null,
            calculation_type: calculationType,
            base_delivery_charge: Number(deliveryConfig.base_delivery_charge ?? 0),
            max_items_per_package: calculationType === 'PER_PACKAGE'
                ? (parseInt(deliveryConfig.max_items_per_package, 10) || 3)
                : 3,
            unit_weight: calculationType === 'WEIGHT_BASED'
                ? (Number(deliveryConfig.unit_weight) || 0)
                : null,
            gst_percentage: Number(deliveryConfig.gst_percentage ?? 18),
            is_taxable: deliveryConfig.is_taxable !== undefined ? Boolean(deliveryConfig.is_taxable) : true,
            delivery_refund_policy: deliveryConfig.delivery_refund_policy || 'NON_REFUNDABLE',
            is_active: deliveryConfig.is_active !== undefined ? Boolean(deliveryConfig.is_active) : true,
            updated_at: new Date().toISOString()
        };
    }

    static buildListCacheKey({ page, limit, search, category, sortBy, lang, includeStats }) {
        return JSON.stringify({
            version: ProductService.listCacheVersion,
            page,
            limit,
            search,
            category,
            sortBy,
            lang: lang || 'en',
            includeStats: Boolean(includeStats)
        });
    }

    static invalidateListCache() {
        ProductService.listCacheVersion += 1;
        ProductService.pendingListRequests.clear();
    }

    static buildProductListSelect(lang = 'en') {
        const includeI18n = lang && lang !== 'en';

        return `
            id,
            title,
            ${includeI18n ? 'title_i18n,' : ''}
            description,
            ${includeI18n ? 'description_i18n,' : ''}
            price,
            mrp,
            images,
            category,
            category_id,
            inventory,
            created_at,
            rating,
            ratingCount,
            reviewCount,
            is_new,
            tags,
            ${includeI18n ? 'tags_i18n,' : ''}
            benefits,
            ${includeI18n ? 'benefits_i18n,' : ''}
            variant_mode,
            default_hsn_code,
            default_gst_rate,
            default_tax_applicable,
            default_price_includes_tax,
            is_returnable,
            return_days,
            variants:product_variants(
                id,
                size_label,
                ${includeI18n ? 'size_label_i18n,' : ''}
                description,
                ${includeI18n ? 'description_i18n,' : ''}
                mrp,
                selling_price,
                stock_quantity,
                variant_image_url,
                is_default,
                hsn_code,
                gst_rate
            ),
            category_data:categories(
                id,
                name
                ${includeI18n ? ',name_i18n' : ''}
            )
        `.replace(/\s+/g, ' ').trim();
    }

    static localizeProductPayload(product, lang = 'en') {
        if (!product) return product;

        const sourceTags = Array.isArray(product.tags) ? [...product.tags] : [];
        const localizedProduct = lang && lang !== 'en'
            ? applyTranslations(product, lang, false)
            : { ...product };

        localizedProduct.en_tags = sourceTags;
        localizedProduct.tags = sourceTags;

        return localizedProduct;
    }

    static normalizeProductMutationData(productData = {}) {
        const normalizedProduct = { ...(productData || {}) };
        const deliveryConfig = normalizedProduct.delivery_config;

        delete normalizedProduct.delivery_config;
        delete normalizedProduct.id;
        delete normalizedProduct.imageFiles;
        delete normalizedProduct.variants;
        delete normalizedProduct.defaultVariant;
        delete normalizedProduct.category_data;
        delete normalizedProduct.rating;
        delete normalizedProduct.ratingCount;
        delete normalizedProduct.reviewCount;
        delete normalizedProduct.deliveryCharge;
        delete normalizedProduct.delivery_charge;

        if (normalizedProduct.isReturnable !== undefined) {
            normalizedProduct.is_returnable = normalizedProduct.isReturnable;
            delete normalizedProduct.isReturnable;
        }
        if (normalizedProduct.returnDays !== undefined) {
            normalizedProduct.return_days = normalizedProduct.returnDays;
            delete normalizedProduct.returnDays;
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

        if (normalizedProduct.title && (!normalizedProduct.title_i18n || typeof normalizedProduct.title_i18n !== 'object')) {
            normalizedProduct.title_i18n = { en: normalizedProduct.title };
        } else if (normalizedProduct.title && !normalizedProduct.title_i18n.en) {
            normalizedProduct.title_i18n = { ...normalizedProduct.title_i18n, en: normalizedProduct.title };
        }

        if (normalizedProduct.description && (!normalizedProduct.description_i18n || typeof normalizedProduct.description_i18n !== 'object')) {
            normalizedProduct.description_i18n = { en: normalizedProduct.description };
        } else if (normalizedProduct.description && !normalizedProduct.description_i18n.en) {
            normalizedProduct.description_i18n = { ...normalizedProduct.description_i18n, en: normalizedProduct.description };
        }

        if (!normalizedProduct.tags_i18n || typeof normalizedProduct.tags_i18n !== 'object') {
            normalizedProduct.tags_i18n = {};
        }
        if (!normalizedProduct.benefits_i18n || typeof normalizedProduct.benefits_i18n !== 'object') {
            normalizedProduct.benefits_i18n = {};
        }

        Object.keys(normalizedProduct).forEach((key) => {
            if (normalizedProduct[key] === undefined) {
                delete normalizedProduct[key];
            }
        });

        return {
            normalizedProduct,
            deliveryConfig
        };
    }

    static buildProductDeliveryConfig(productId, deliveryConfig) {
        if (!productId) {
            return null;
        }

        return ProductService.buildScopedDeliveryConfig({
            scope: 'PRODUCT',
            productId,
            deliveryConfig
        });
    }

    static async syncProductDeliveryConfig(productId, deliveryConfig, { replaceExisting = false } = {}) {
        if (!productId) return;

        try {
            if (replaceExisting) {
                const { error: deleteError } = await supabase
                    .from('delivery_configs')
                    .delete()
                    .eq('scope', 'PRODUCT')
                    .eq('product_id', productId);

                if (deleteError) throw deleteError;
            }

            const configRecord = ProductService.buildProductDeliveryConfig(productId, deliveryConfig);
            if (!configRecord) return;

            const { error: insertError } = await supabase
                .from('delivery_configs')
                .insert(configRecord);

            if (insertError) throw insertError;
        } catch (error) {
            logger.error({ err: error, productId }, 'PRODUCT_DELIVERY_CONFIG_SYNC_FAILED');
            throw error;
        }
    }

    /**
     * Get all products with dynamic ratings and pagination
     */
    static async getAllProducts({ page = 1, limit = 10, search = '', category = 'all', sortBy = 'newest', lang = 'en', includeStats = false } = {}) {
        const cacheKey = ProductService.buildListCacheKey({ page, limit, search, category, sortBy, lang, includeStats });
        const cachedResponse = await ProductService.listCache.get(cacheKey);

        if (cachedResponse) {
            return cachedResponse;
        }

        const pendingRequest = ProductService.pendingListRequests.get(cacheKey);
        if (pendingRequest) {
            return pendingRequest;
        }

        const requestPromise = (async () => {
            // THEORETICAL MINIMUM: Single RPC call for data + total count (Optimized v3)
            const { data, error } = await supabase.rpc('get_products_paginated_v3', {
                p_page: page,
                p_limit: limit,
                p_search: search,
                p_category: category,
                p_sort_by: sortBy,
                p_lang: lang
            });

            if (error) {
                logger.error({ err: error, page, search }, 'PRODUCTS_PAGINATED_RPC_FAILED');
                throw error;
            }

            // Supplemental stats for Admin Dashboard
            let stats = {};
            if (includeStats) {
                const [outOfStock, lowStock, healthyStock] = await Promise.all([
                    supabase.from('products').select('id', { count: 'exact', head: true }).eq('inventory', 0),
                    supabase.from('products').select('id', { count: 'exact', head: true }).gt('inventory', 0).lt('inventory', 15),
                    supabase.from('products').select('id', { count: 'exact', head: true }).gte('inventory', 15).lt('inventory', 50)
                ]);
                stats = {
                    outOfStockCount: outOfStock.count || 0,
                    criticalStockCount: lowStock.count || 0,
                    lowStockCount: healthyStock.count || 0
                };
            }

            const products = data.products || [];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            products.forEach(product => {
                const createdDateStr = product.createdAt || product.created_at;
                const isRecentlyCreated = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;
                
                // Priority: Direct DB flag > Date-based logic
                product.isNew = (product.is_new !== undefined) ? product.is_new : isRecentlyCreated;
                
                product.ratingCount = product.ratingCount ?? 0;
                product.reviewCount = product.reviewCount ?? 0;
                product.isReturnable = product.isReturnable ?? product.is_returnable ?? false;
                product.returnDays = product.returnDays ?? product.return_days ?? 0;

                if (Array.isArray(product.variants)) {
                    product.variants.sort((a, b) => {
                        if (a.is_default === b.is_default) return 0;
                        return a.is_default ? -1 : 1;
                    });
                }
            });

            const response = {
                products: products.map(p => ProductService.localizeProductPayload(p, lang)),
                total: data.total || 0,
                page: data.page,
                limit: data.limit,
                totalPages: data.totalPages,
                stats
            };

            await ProductService.listCache.set(cacheKey, response, ProductService.LIST_CACHE_TTL_MS);
            return response;
        })();

        ProductService.pendingListRequests.set(cacheKey, requestPromise);

        try {
            return await requestPromise;
        } finally {
            ProductService.pendingListRequests.delete(cacheKey);
        }
    }

    /**
     * Get single product by ID with variants
     */
    static async getProductById(id, lang = 'en') {
        const [{ data: product, error: productError }, { data: variants, error: variantsError }] = await Promise.all([
            supabase
                .from('products')
                .select('*, category_data:categories(*)')
                .eq('id', id)
                .maybeSingle(),
            supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', id)
        ]);

        if (productError) {
            logger.error({ err: productError, productId: id }, 'PRODUCT_DETAIL_FETCH_FAILED');
            throw productError;
        }

        if (variantsError) {
            logger.error({ err: variantsError, productId: id }, 'PRODUCT_VARIANTS_FETCH_FAILED');
            throw variantsError;
        }

        if (!product) {
            const err = new Error('Product not found');
            err.status = 404;
            throw err;
        }

        const variantIds = (variants || []).map((variant) => variant.id).filter(Boolean);
        const [productConfigResponse, variantConfigResponse] = await Promise.all([
            supabase
                .from('delivery_configs')
                .select('*')
                .eq('scope', 'PRODUCT')
                .eq('product_id', id),
            variantIds.length > 0
                ? supabase
                    .from('delivery_configs')
                    .select('*')
                    .eq('scope', 'VARIANT')
                    .in('variant_id', variantIds)
                : Promise.resolve({ data: [], error: null })
        ]);

        if (productConfigResponse.error) {
            logger.error({ err: productConfigResponse.error, productId: id }, 'PRODUCT_DELIVERY_CONFIG_FETCH_FAILED');
            throw productConfigResponse.error;
        }

        if (variantConfigResponse.error) {
            logger.error({ err: variantConfigResponse.error, productId: id }, 'VARIANT_DELIVERY_CONFIG_FETCH_FAILED');
            throw variantConfigResponse.error;
        }

        const deliveryConfigs = [
            ...(productConfigResponse.data || []),
            ...(variantConfigResponse.data || [])
        ];

        product.variant_mode = ProductService.inferVariantMode(product, variants);

        // Attach Variants (with delivery configs)
        product.variants = (variants || []).map(v => {
            const variantConfig = ProductService.pickLatestDeliveryConfig(
                deliveryConfigs,
                (config) => config.scope === 'VARIANT' && config.variant_id === v.id
            );
            return {
                ...ProductService.normalizeVariantDetail(v, product),
                delivery_config: variantConfig || null
            };
        });

        // Sort Variants
        product.variants.sort((a, b) => (a.size_value || 0) - (b.size_value || 0));

        // Find default variant
        product.defaultVariant = product.variants.find(v => v.is_default) || product.variants[0] || null;

        // Attach product-level config
        const productConfig = ProductService.pickLatestDeliveryConfig(
            deliveryConfigs,
            (config) => config.scope === 'PRODUCT' && config.product_id === id
        );
        product.delivery_config = productConfig || null;

        // Fallback for metadata
        if (product.rating === undefined) product.rating = 0;
        product.ratingCount = product.ratingCount ?? product.rating_count ?? 0;
        product.reviewCount = product.reviewCount ?? product.review_count ?? 0;

        // Calculate isNew (Consolidate DB flag and date logic)
        const createdDateStr = product.createdAt || product.created_at;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isRecentlyCreated = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;
        
        // Priority: Direct DB flag > Date-based logic
        product.isNew = (product.is_new !== undefined) ? product.is_new : isRecentlyCreated;

        // Ensure camelCase mappings for common fields
        product.isReturnable = (product.is_returnable !== undefined) ? product.is_returnable : (product.isReturnable ?? true);
        product.returnDays = (product.return_days !== undefined) ? product.return_days : (product.returnDays ?? 3);

        return ProductService.localizeProductPayload(product, lang);
    }

    /**
     * Create product
     * @param {Object} productData - Product data including variant_mode
     */
    static async createProduct(productData) {
        const { normalizedProduct, deliveryConfig } = ProductService.normalizeProductMutationData(productData);
        const { data, error } = await supabase
            .from('products')
            .insert(normalizedProduct)
            .select()
            .single();

        if (error) throw error;

        await ProductService.syncProductDeliveryConfig(data.id, deliveryConfig);

        ProductService.invalidateListCache();
        return data;
    }

    /**
     * Update product
     */
    static async updateProduct(id, productData) {
        const { normalizedProduct, deliveryConfig } = ProductService.normalizeProductMutationData(productData);
        const { data, error } = await supabase
            .from('products')
            .update(normalizedProduct)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (deliveryConfig !== undefined) {
            await ProductService.syncProductDeliveryConfig(id, deliveryConfig, { replaceExisting: true });
        }

        ProductService.invalidateListCache();
        return data;
    }

    /**
     * Delete product
     */
    static async deleteProduct(id) {
        // 1. Get product and variants together to find all image URLs and Razorpay IDs
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('images, variants:product_variants(variant_image_url, razorpay_item_id)')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        const variants = product.variants || [];

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

        ProductService.invalidateListCache();
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
