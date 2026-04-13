const supabase = require('../lib/supabase');
const logger = require('../utils/logger');
const { deletePhotosByUrls } = require('./photo.service');
const RazorpaySyncService = require('./razorpay-sync.service');
const { LOGS, INVENTORY } = require('../constants/messages');
const { applyTranslations } = require('../utils/i18n.util');
const CacheService = require('../lib/store/cache.service');

/**
 * Product Service
 * Handles product retrieval, rating processing, and product lifecycle management.
 */

class ProductService {
    static listCache = CacheService.getInstance();
    static pendingListRequests = new Map();
    static listCacheVersion = 1;
    static LIST_CACHE_TTL_MS = parseInt(process.env.PRODUCT_LIST_CACHE_TTL_MS || '30000', 10);
    static schemaColumnCache = new Map();

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

    static async getTableColumns(tableName) {
        if (ProductService.schemaColumnCache.has(tableName)) {
            return ProductService.schemaColumnCache.get(tableName);
        }

        try {
            const { data, error } = await supabase.rpc('get_table_columns_info', { t_name: tableName });

            if (error) throw error;

            const columnSet = new Set((data || []).map((column) => column.column_name));
            ProductService.schemaColumnCache.set(tableName, columnSet);
            return columnSet;
        } catch (error) {
            logger.warn({ err: error, tableName }, 'Falling back to static product schema assumptions');
            return null;
        }
    }

    static hasColumn(columnSet, columnName) {
        return !columnSet || columnSet.has(columnName);
    }

    static buildProductListSelect(lang = 'en', schemaColumns = {}) {
        const includeI18n = lang && lang !== 'en';
        const productColumns = schemaColumns.products;
        const categoryColumns = schemaColumns.categories;
        const categoryFields = ['id', 'name'];

        if (includeI18n && ProductService.hasColumn(categoryColumns, 'name_i18n')) {
            categoryFields.push('name_i18n');
        }

        const selectFields = [
            'id',
            'title',
            ...(includeI18n ? ['title_i18n'] : []),
            'description',
            ...(includeI18n ? ['description_i18n'] : []),
            'price',
            'mrp',
            'images',
            'category',
            'category_id',
            'inventory',
            'created_at',
            'rating',
            ...(ProductService.hasColumn(productColumns, 'ratingCount') ? ['ratingCount'] : []),
            ...(ProductService.hasColumn(productColumns, 'reviewCount') ? ['reviewCount'] : []),
            'is_new',
            'tags',
            ...(includeI18n ? ['tags_i18n'] : []),
            'benefits',
            ...(includeI18n && ProductService.hasColumn(productColumns, 'benefits_i18n') ? ['benefits_i18n'] : []),
            'variant_mode',
            'default_hsn_code',
            'default_gst_rate',
            'default_tax_applicable',
            'default_price_includes_tax',
            'is_returnable',
            'return_days',
            `variants:product_variants(
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
            )`,
            `category_data:categories(
                ${categoryFields.join(', ')}
            )`
        ];

        return selectFields.join(', ').replace(/\s+/g, ' ').trim();
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

    /**
     * Get all products with dynamic ratings and pagination
     */
    static async getAllProducts({ page = 1, limit = 15, search = '', category = 'all', sortBy = 'newest', lang = 'en', includeStats = false } = {}) {
        const offset = (page - 1) * limit;
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
            const [productColumns, categoryColumns] = await Promise.all([
                ProductService.getTableColumns('products'),
                ProductService.getTableColumns('categories')
            ]);

            const applyBaseFilters = (queryBuilder) => {
                let nextQuery = queryBuilder;

                if (search) {
                    nextQuery = nextQuery.ilike('title', `%${search}%`);
                }

                if (category && category !== 'all') {
                    nextQuery = nextQuery.eq('category', category);
                }

                return nextQuery;
            };

            let dataQuery = applyBaseFilters(
                supabase
                    .from('products')
                    .select(ProductService.buildProductListSelect(lang, {
                        products: productColumns,
                        categories: categoryColumns
                    }))
            );

            let countQuery = applyBaseFilters(
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
            );

            switch (sortBy) {
                case 'priceLowHigh':
                    dataQuery = dataQuery.order('price', { ascending: true });
                    break;
                case 'priceHighLow':
                    dataQuery = dataQuery.order('price', { ascending: false });
                    break;
                case 'newest':
                default:
                    dataQuery = dataQuery.order('created_at', { ascending: false });
                    break;
            }

            const queries = [
                dataQuery.range(offset, offset + limit - 1),
                countQuery
            ];

            if (includeStats) {
                queries.push(supabase.rpc('get_product_inventory_stats_v1'));
            }

            const results = await Promise.all(queries);
            const [{ data: products, error }, { count }] = results;

            if (error) throw error;

            const stats = includeStats ? (results[2]?.data?.[0] || {}) : {};
            const outOfStockCount = parseInt(stats.out_of_stock_count || '0');
            const criticalStockCount = parseInt(stats.critical_stock_count || '0');
            const lowStockCount = parseInt(stats.low_stock_count || '0');

            if (!products || products.length === 0) {
                return {
                    products: [],
                    total: 0,
                    stats: { outOfStockCount, criticalStockCount, lowStockCount }
                };
            }

            // Calculate isNew
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            products.forEach(product => {
                const createdDateStr = product.createdAt || product.created_at;
                product.isNew = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;
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

            // Language processing and removing bulky i18n JSONs
            const localizedProducts = products.map((product) =>
                ProductService.localizeProductPayload(product, lang)
            );

            const response = {
                products: localizedProducts,
                total: count,
                stats: { outOfStockCount, criticalStockCount, lowStockCount }
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
        const { data, error } = await supabase
            .from('products')
            .select('*, variants:product_variants(*), category_data:categories(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        // data already contains variants from the joined select above
        if (data.variants) {
            // Re-sort in-memory to ensure size order if required
            data.variants.sort((a, b) => (a.size_value || 0) - (b.size_value || 0));
            // Find default variant
            const defaultVariant = data.variants.find(v => v.is_default) || data.variants[0];
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
            .or(`product_id.eq.${id},variant_id.in.(${data.variants && data.variants.length > 0 ? data.variants.map(v => v.id).join(',') : '00000000-0000-0000-0000-000000000000'})`);

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

        return ProductService.localizeProductPayload(data, lang);
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

        ProductService.invalidateListCache();
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
        const BATCH_SIZE = 100;
        let page = 0;
        let allProducts = [];
        let hasMore = true;

        const { flattenObject } = require('../utils/object.utils');
        
        // Fetch ALL Delivery Configs once (usually small enough)
        const { data: deliveryConfigs } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('is_active', true);

        const exportDataHeaders = new Set();
        let csvContent = '';
        let headersWritten = false;

        while (hasMore) {
            const from = page * BATCH_SIZE;
            const to = from + BATCH_SIZE - 1;

            const { data: products, error } = await supabase
                .from('products')
                .select('*, variants:product_variants(*), category_data:categories(*)')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            if (!products || products.length === 0) {
                hasMore = false;
                break;
            }

            const batchRows = [];
            products.forEach((product) => {
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
                    title_i18n: JSON.stringify(product.title_i18n || {}),
                    description_i18n: JSON.stringify(product.description_i18n || {}),
                    tags_i18n: JSON.stringify(product.tags_i18n || {}),
                    benefits_i18n: JSON.stringify(product.benefits_i18n || {}),
                    delivery_refund_policy: product.delivery_refund_policy,
                    delivery_config: productConfig ? JSON.stringify(productConfig) : ''
                };

                if (product.variants && product.variants.length > 0) {
                    product.variants.forEach((variant) => {
                        const variantConfig = deliveryConfigs?.find(c => c.scope === 'VARIANT' && c.variant_id === variant.id);
                        batchRows.push(flattenObject({
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
                    batchRows.push(flattenObject(baseProduct));
                }
            });

            if (batchRows.length > 0) {
                // Collect headers from first batch
                if (!headersWritten) {
                    batchRows.flatMap(row => Object.keys(row)).forEach(k => exportDataHeaders.add(k));
                    const headersArray = Array.from(exportDataHeaders);
                    csvContent += headersArray.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
                    headersWritten = true;
                }

                const headersArray = Array.from(exportDataHeaders);
                csvContent += batchRows.map(row =>
                    headersArray.map(header => {
                        const value = row[header];
                        if (value === null || value === undefined) return '';
                        const stringValue = String(value);
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }).join(',')
                ).join('\n') + '\n';
            }

            if (products.length < BATCH_SIZE) {
                hasMore = false;
            } else {
                page++;
            }
        }

        return csvContent;
    }
}

module.exports = ProductService;
