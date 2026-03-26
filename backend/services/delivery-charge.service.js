/**
 * Delivery Charge Service
 * Handles dynamic delivery charge calculations based on configured rules
 * Supports multiple calculation types: PER_PACKAGE, WEIGHT_BASED, FLAT_PER_ORDER, PER_ITEM
 * 
 * IMPORTANT: All calculations are backend-driven and deterministic
 * Delivery charges must include GST as per requirements
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const settingsService = require('./settings.service');
const { LOGS } = require('../constants/messages');

const log = createModuleLogger('DeliveryChargeService');

// Batch cache for delivery configs to avoid redundant DB calls on rapid updates
const deliveryConfigCache = new Map();
// Cache for final calculation results to avoid redundant math and logging
const deliveryResultCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

function clearExpiredEntries(cache) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (!value || value.expiry <= now) {
            cache.delete(key);
        }
    }
}

// Calculation type constants
const CALCULATION_TYPES = {
    FLAT_PER_ORDER: 'FLAT_PER_ORDER',
    PER_PACKAGE: 'PER_PACKAGE',
    WEIGHT_BASED: 'WEIGHT_BASED',
    PER_ITEM: 'PER_ITEM'
};

// Default delivery config (if none exists)
const DEFAULT_CONFIG = {
    calculation_type: CALCULATION_TYPES.FLAT_PER_ORDER,
    base_delivery_charge: 0,
    max_items_per_package: 3,
    unit_weight: 0,
    gst_percentage: 18,
    is_taxable: true,
    gst_mode: 'inclusive',
    delivery_refund_policy: 'REFUNDABLE' // Reverted to Refundable for generic defaults
};

class DeliveryChargeService {
    static invalidateCaches() {
        deliveryConfigCache.clear();
        deliveryResultCache.clear();
    }

    /**
     * Get delivery configurations for multiple items in batch
     * Optimized to reduce DB roundtrips (N+1 problem fix)
     * 
     * @param {Array} items - Array of {productId, variantId}
     * @param {Array|null} prefetchedItems - Optional pre-fetched product/variant data to avoid DB query
     * @returns {Promise<Map>} Map of key `${productId}-${variantId}` -> config
     */
    static async getDeliveryConfigsBatch(items, prefetchedItems = null) {
        try {
            if (!items || items.length === 0) return new Map();

            const configMap = new Map();
            const now = Date.now();
            
            // 1. Check Cache first and filter out items that need fetching
            const itemsToFetch = items.filter(item => {
                const key = `${item.product_id || item.productId}-${item.variant_id || item.variantId || 'null'}`;
                const cached = deliveryConfigCache.get(key);
                if (cached && (now < cached.expiry)) {
                    configMap.set(key, cached.config);
                    return false;
                }
                return true;
            });

            if (itemsToFetch.length === 0) return configMap;

            const productIds = [...new Set(itemsToFetch.map(i => i.product_id || i.productId).filter(id => id))];
            const variantIds = [...new Set(itemsToFetch.map(i => i.variant_id || i.variantId).filter(id => id))];

            // Parallel fetch for Configs and Global Settings
            // Only fetch from 'products' if prefetchedItems are not provided
            const [variantConfigsResult, productConfigsResult, legacyItemsResult, globalSettings] = await Promise.all([
                variantIds.length > 0 ? supabase
                    .from('delivery_configs')
                    .select('*')
                    .eq('scope', 'VARIANT')
                    .in('variant_id', variantIds)
                    .eq('is_active', true)
                    : Promise.resolve({ data: [] }),
                productIds.length > 0 ? supabase
                    .from('delivery_configs')
                    .select('*')
                    .eq('scope', 'PRODUCT')
                    .in('product_id', productIds)
                    .eq('is_active', true)
                    : Promise.resolve({ data: [] }),
                (productIds.length > 0 && !prefetchedItems) ? supabase
                    .from('products')
                    .select('id, delivery_charge, product_variants(id, delivery_charge)')
                    .in('id', productIds)
                    : Promise.resolve({ data: [] }),
                settingsService.getDeliverySettings()
            ]);

            const variantConfigs = variantConfigsResult.data || [];
            const productConfigs = productConfigsResult.data || [];
            
            // Build Legacy Map from prefetchedItems OR legacyItemsResult
            const legacyMap = new Map();
            if (prefetchedItems) {
                prefetchedItems.forEach(item => {
                    const product = item.product || item.products || {};
                    const variant = item.variant || item.product_variants || {};
                    const pId = item.product_id || item.productId;
                    
                    if (!legacyMap.has(pId)) {
                        legacyMap.set(pId, {
                            productCharge: product.delivery_charge,
                            variants: new Map()
                        });
                    }
                    if (variant.id) {
                        legacyMap.get(pId).variants.set(variant.id, variant.delivery_charge);
                    }
                });
            } else {
                const legacyProducts = legacyItemsResult.data || [];
                legacyProducts.forEach(p => {
                    legacyMap.set(p.id, {
                        productCharge: p.delivery_charge,
                        variants: new Map((p.product_variants || []).map(v => [v.id, v.delivery_charge]))
                    });
                });
            }

            // Build Global Default Config
            const globalConfig = {
                ...DEFAULT_CONFIG,
                base_delivery_charge: globalSettings.delivery_charge,
                gst_percentage: globalSettings.delivery_gst,
                is_taxable: (globalSettings.delivery_gst > 0),
                gst_mode: globalSettings.delivery_gst_mode || 'inclusive',
                source: 'global',
                delivery_refund_policy: 'NON_REFUNDABLE'
            };

            // Map configs to items and Update Cache
            items.forEach(item => {
                const productId = item.product_id || item.productId;
                const variantId = item.variant_id || item.variantId;
                const key = `${productId}-${variantId || 'null'}`;
                
                let finalConfig = null;

                // 1. Variant Level (Highest Priority)
                if (variantId) {
                    const vConfig = variantConfigs.find(c => c.variant_id === variantId);
                    if (vConfig) {
                        finalConfig = { ...vConfig, source: 'variant', delivery_refund_policy: vConfig.delivery_refund_policy || 'REFUNDABLE' };
                    }
                }

                // 2. Product Level
                if (!finalConfig && productId) {
                    const pConfig = productConfigs.find(c => c.product_id === productId);
                    if (pConfig) {
                        finalConfig = { ...pConfig, source: 'product', delivery_refund_policy: pConfig.delivery_refund_policy || 'REFUNDABLE' };
                    }
                }

                // 3. Legacy Fallback (Batch Optimized)
                if (!finalConfig) {
                    const legacy = legacyMap.get(productId);
                    if (legacy) {
                        const variantCharge = variantId ? legacy.variants.get(variantId) : null;
                        const productCharge = legacy.productCharge;
                        
                        let legacyCharge = null;
                        if (variantCharge !== undefined && variantCharge !== null) {
                            legacyCharge = parseFloat(variantCharge);
                        } else if (productCharge !== undefined && productCharge !== null) {
                            legacyCharge = parseFloat(productCharge);
                        }

                        if (legacyCharge !== null && legacyCharge > 0) {
                            finalConfig = {
                                ...DEFAULT_CONFIG,
                                source: 'product_legacy',
                                calculation_type: CALCULATION_TYPES.PER_ITEM,
                                base_delivery_charge: legacyCharge,
                                is_taxable: true,
                                gst_percentage: 18,
                                gst_mode: 'inclusive',
                                delivery_refund_policy: 'REFUNDABLE'
                            };
                        }
                    }
                }

                // 4. Global Level (Default)
                if (!finalConfig) {
                    finalConfig = globalConfig;
                }

                configMap.set(key, finalConfig);
                
                // Update Cache with TTL
                deliveryConfigCache.set(key, {
                    config: finalConfig,
                    expiry: Date.now() + CACHE_TTL
                });
            });

            return configMap;

        } catch (error) {
            log.operationError('BATCH_DELIVERY_CONFIG', error);
            return new Map();
        }
    }

    /**
     * Get delivery configuration for a product/variant
     * Variant config overrides product config if present
     * 
     * @param {string} productId - Product UUID
     * @param {string|null} variantId - Variant UUID (optional)
     * @returns {Promise<object>} Delivery configuration
     */
    static async getDeliveryConfig(productId, variantId = null) {
        // Reuse batch logic for single item for consistency
        const map = await this.getDeliveryConfigsBatch([{ productId, variantId }]);
        const key = `${productId}-${variantId || 'null'}`;
        // If map fails or empty, use fallback within getDeliveryConfigsBatch logic or re-implement simple fetch?
        // Actually the batch function handles the global fallback logic internally.
        // It returns a Map with the config.
        return map.get(key) || { ...DEFAULT_CONFIG, source: 'default' };
    }

    /**
     * Determine if the delivery is inter-state (outside seller's state)
     * Used for GST type determination (IGST vs CGST/SGST)
     * 
     * @param {Object} shippingAddress - Customer shipping address
     * @returns {Promise<boolean>} True if inter-state
     */
    static async isInterStateDelivery(shippingAddress) {
        if (!shippingAddress) return false; // Default to intra-state (safer for estimates)
        const { TaxEngine, TAX_TYPE } = require('./tax-engine.service');
        const sellerCode = TaxEngine.getSellerStateCode();
        const buyerCode = TaxEngine.extractStateCodeFromAddress(shippingAddress);
        return TaxEngine.determineTaxType(sellerCode, buyerCode) === TAX_TYPE.INTER_STATE;
    }

    /**
     * Calculate delivery charge for a single product/variant
     * 
     * @param {string} productId - Product UUID
     * @param {string|null} variantId - Variant UUID (optional)
     * @param {number} quantity - Quantity ordered
     * @param {object|null} prefetchedConfig - Pre-fetched config
     * @param {boolean} silent - If true, suppresses logs (useful for batch operations)
     * @returns {Promise<object>} { deliveryCharge, deliveryGST, totalDelivery, snapshot }
     */
    static async calculateDeliveryCharge(productId, variantId, quantity, isFreeDelivery = false, prefetchedConfig = null, silent = false) {
        const configSignature = [
            prefetchedConfig?.id || 'no-id',
            prefetchedConfig?.source || 'no-source',
            prefetchedConfig?.calculation_type || 'no-type',
            prefetchedConfig?.base_delivery_charge ?? 'no-charge',
            prefetchedConfig?.gst_percentage ?? 'no-gst',
            prefetchedConfig?.is_taxable ?? 'no-tax-flag',
            prefetchedConfig?.max_items_per_package ?? 'no-max-items',
            prefetchedConfig?.unit_weight ?? 'no-unit-weight'
        ].join(':');
        const resultKey = `${productId}-${variantId}-${quantity}-${isFreeDelivery}-${configSignature}`;
        const now = Date.now();

        clearExpiredEntries(deliveryResultCache);
        
        // 1. Check Result Cache (Deterministic Memoization)
        const cachedResult = deliveryResultCache.get(resultKey);
        if (cachedResult && (now < cachedResult.expiry)) {
            return cachedResult.result;
        }

        if (!silent) log.operationStart(LOGS.DELIVERY_CALC_START, { productId, variantId, quantity, isFreeDelivery, hasPrefetched: !!prefetchedConfig });
        const startTime = now;

        try {
            // Get delivery config - Use prefetched or fetch from DB
            let config = prefetchedConfig || await this.getDeliveryConfig(productId, variantId);

            // FALLBACK FOR LEGACY DATA (Consistency with Batch Logic)
            // Note: getDeliveryConfigsBatch / getDeliveryConfig already handles product_legacy source.
            // No additional database lookup needed here.

            let deliveryCharge = 0;
            let calculationDetails = {
                calculation_type: config.calculation_type,
                quantity,
                source: config.source // Audit source
            };

            // Apply calculation logic based on type
            switch (config.calculation_type) {
                case CALCULATION_TYPES.PER_PACKAGE:
                    const packages = Math.ceil(quantity / config.max_items_per_package);
                    deliveryCharge = packages * config.base_delivery_charge;
                    calculationDetails.max_items_per_package = config.max_items_per_package;
                    calculationDetails.packages = packages;
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                case CALCULATION_TYPES.WEIGHT_BASED:
                    const totalWeight = config.unit_weight * quantity;
                    // Weight-based pricing uses admin-configured base_delivery_charge per kg.
                    // No courier API slab logic — delivery charges are set manually per product.
                    deliveryCharge = config.base_delivery_charge * Math.ceil(totalWeight);
                    calculationDetails.unit_weight = config.unit_weight;
                    calculationDetails.total_weight = totalWeight;
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                case CALCULATION_TYPES.FLAT_PER_ORDER:
                    // If free delivery applies, standard flat rate is 0
                    if (isFreeDelivery && config.source === 'global') {
                        deliveryCharge = 0;
                        calculationDetails.is_free_delivery_applied = true;
                    } else {
                        deliveryCharge = config.base_delivery_charge;
                    }
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                case CALCULATION_TYPES.PER_ITEM:
                    deliveryCharge = quantity * config.base_delivery_charge;
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                default:
                    log.warn(LOGS.DELIVERY_UNKNOWN_TYPE, `Unknown calculation type: ${config.calculation_type}`);
                    deliveryCharge = 0;
            }

            // Calculate GST based on INCLUSIVE logic
            // User requirement: Surcharges and Standard Delivery are tax-inclusive
            let deliveryGST = 0;

            if (config.is_taxable && config.gst_percentage > 0) {
                const gstMode = config.gst_mode || 'inclusive';
                const gstMultiplier = config.gst_percentage / 100;

                if (gstMode === 'exclusive') {
                    deliveryGST = deliveryCharge * gstMultiplier;
                } else {
                    // Inclusive logic: configured amount already contains GST.
                    const totalAmount = deliveryCharge;
                    const baseAmount = totalAmount / (1 + gstMultiplier);
                    deliveryGST = totalAmount - baseAmount;
                    deliveryCharge = baseAmount;
                }
            }

            const totalDelivery = deliveryCharge + deliveryGST; // Sums back to the original configured amount

            // Create snapshot for audit trail
            const snapshot = {
                ...calculationDetails,
                delivery_charge: deliveryCharge,
                gst_rate: config.gst_percentage,
                gst_mode: config.gst_mode || 'inclusive',
                delivery_gst: deliveryGST,
                is_taxable: config.is_taxable,
                total_delivery: totalDelivery,
                config_id: config.id || null,
                delivery_refund_policy: config.delivery_refund_policy || 'REFUNDABLE'
            };

            if (!silent) {
                log.operationSuccess(LOGS.DELIVERY_CALC_SUCCESS, {
                    deliveryCharge: Math.round(deliveryCharge * 100) / 100,
                    deliveryGST: Math.round(deliveryGST * 100) / 100,
                    totalDelivery: Math.round(totalDelivery * 100) / 100
                }, Date.now() - startTime);
            }

            const result = {
                deliveryCharge: Math.round(deliveryCharge * 100) / 100,
                deliveryGST: Math.round(deliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100,
                snapshot
            };

            // 2. Update Result Cache
            deliveryResultCache.set(resultKey, {
                result,
                expiry: now + CACHE_TTL
            });

            return result;

        } catch (error) {
            log.operationError(LOGS.DELIVERY_CALC_FAIL, error, { productId, variantId, quantity });
            throw error;
        }
    }

    /**
     * Calculate delivery charges for cart items
     * Aggregates delivery for all items in cart
     * 
     * @param {Array} cartItems - Cart items with product/variant data
     * @param {number} cartSubtotal - Total price of items (for threshold check)
     * @param {object} options - Calculation options
     * @param {boolean} options.forceFreeStandard - If true, waives standard delivery regardless of threshold
     * @returns {Promise<object>} { totalDeliveryCharge, totalDeliveryGST, totalDelivery, items }
     */
    static async calculateCartDelivery(cartItems, cartSubtotal = 0, shippingAddress = null, { forceFreeStandard = false } = {}) {
        log.operationStart(LOGS.DELIVERY_CART_START, { itemCount: cartItems.length, cartSubtotal, forceFreeStandard });
        const startTime = Date.now();

        try {
            clearExpiredEntries(deliveryConfigCache);
            clearExpiredEntries(deliveryResultCache);

            // Determine if interstate based on address
            const isInterState = await this.isInterStateDelivery(shippingAddress);

            // Fetch global settings for threshold
            const globalSettings = await settingsService.getDeliverySettings();
            const threshold = globalSettings.delivery_threshold || 0;

            // Determine if free delivery applies (either via threshold or coupon force)
            const isFreeDelivery = forceFreeStandard || (cartSubtotal >= threshold);

            let totalDeliveryCharge = 0;
            let totalDeliveryGST = 0;
            const itemDeliveries = [];

            let globalChargeApplied = false;

            // BATCH FETCH OPTIMIZATION - Pass prefetched items to avoid DB query
            const batchItems = cartItems.map(item => ({
                productId: item.product_id || item.productId,
                variantId: item.variant_id || item.variantId
            }));
            const configMap = await this.getDeliveryConfigsBatch(batchItems, cartItems);

            // 1. Prepare all calculation promises for parallel execution
            const calculationPromises = cartItems.map(async (item) => {
                const productId = item.product_id || item.productId;
                const variantId = item.variant_id || item.variantId;
                const quantity = item.quantity || 1;

                const key = `${productId}-${variantId || 'null'}`;
                let config = configMap.get(key);

                // Fallback logic (already handled in getDeliveryConfigsBatch but kept for robustness)
                if (!config || config.source === 'global') {
                    const variantCharge = item.variant?.delivery_charge;
                    const productCharge = item.product?.delivery_charge;
                    
                    let legacyCharge = null;
                    if (variantCharge !== undefined && variantCharge !== null) {
                        legacyCharge = parseFloat(variantCharge);
                    } else if (productCharge !== undefined && productCharge !== null) {
                        legacyCharge = parseFloat(productCharge);
                    }

                    if (legacyCharge !== null && legacyCharge > 0) {
                        config = {
                            ...DEFAULT_CONFIG,
                            source: 'product_legacy',
                            calculation_type: CALCULATION_TYPES.PER_ITEM,
                            base_delivery_charge: legacyCharge,
                            is_taxable: true,
                            gst_percentage: 18,
                            gst_mode: 'inclusive',
                            delivery_refund_policy: 'REFUNDABLE'
                        };
                    }
                }

                // If it's NOT a global config, it's a specific product charge (Surcharge/Override)
                if (config && config.source !== 'global') {
                    // FIX: correctly pass isInterState and isFreeDelivery (which is false for overrides/surcharges usually)
                    // SET silent: true to prevent per-item log flooding
                    const result = await this.calculateDeliveryCharge(productId, variantId, quantity, false, config, true);
                    return {
                        type: 'PRODUCT',
                        productId,
                        variantId,
                        quantity,
                        ...result
                    };
                } else {
                    return {
                        type: 'GLOBAL_POOL',
                        productId,
                        variantId,
                        quantity,
                        deliveryCharge: 0,
                        deliveryGST: 0,
                        totalDelivery: 0,
                        snapshot: { ...globalSettings, source: 'global', base_delivery_charge: 0, applied_via_global_pool: true }
                    };
                }
            });

            // 2. Resolve calculation promises in parallel
            const results = await Promise.all(calculationPromises);

            results.forEach(res => {
                totalDeliveryCharge += res.deliveryCharge;
                totalDeliveryGST += res.deliveryGST;
                if (res.type === 'PRODUCT') globalChargeApplied = true;

                itemDeliveries.push({
                    product_id: res.productId,
                    variant_id: res.variantId,
                    quantity: res.quantity,
                    deliveryCharge: res.deliveryCharge,
                    deliveryGST: res.deliveryGST,
                    totalDelivery: res.totalDelivery,
                    snapshot: res.snapshot
                });
            });

            // GLOBAL STANDARD DELIVERY (THRESHOLD BASED)
            // Always apply if order is below threshold, even if product surcharges exist.
            if (!isFreeDelivery) {
                const globalConfig = {
                    ...DEFAULT_CONFIG,
                    base_delivery_charge: globalSettings.delivery_charge,
                    gst_percentage: globalSettings.delivery_gst,
                    is_taxable: (globalSettings.delivery_gst > 0),
                    gst_mode: globalSettings.delivery_gst_mode || 'inclusive',
                    source: 'global',
                    delivery_refund_policy: 'NON_REFUNDABLE'
                };

                // The 4th parameter is isFreeDelivery (waives standard charge).
                // Standard delivery is NEVER inter-state at this level (inter-state handled in GST logic inside calculateDeliveryCharge)
                const globalResult = await this.calculateDeliveryCharge(null, null, 1, isFreeDelivery, globalConfig);
                totalDeliveryCharge += globalResult.deliveryCharge;
                totalDeliveryGST += globalResult.deliveryGST;
                globalChargeApplied = true;

                // Push to itemDeliveries for UI visibility in PricingCalculator
                itemDeliveries.push({
                    product_id: null,
                    variant_id: null,
                    quantity: 1,
                    deliveryCharge: globalResult.deliveryCharge,
                    deliveryGST: globalResult.deliveryGST,
                    totalDelivery: globalResult.totalDelivery,
                    snapshot: globalResult.snapshot
                });
            }

            const totalDelivery = totalDeliveryCharge + totalDeliveryGST;

            log.operationSuccess(LOGS.DELIVERY_CART_SUCCESS, {
                totalDeliveryCharge: Math.round(totalDeliveryCharge * 100) / 100,
                totalDeliveryGST: Math.round(totalDeliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100,
                isFreeDelivery
            }, Date.now() - startTime);

            return {
                totalDeliveryCharge: Math.round(totalDeliveryCharge * 100) / 100,
                totalDeliveryGST: Math.round(totalDeliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100,
                items: itemDeliveries
            };

        } catch (error) {
            log.operationError(LOGS.DELIVERY_CART_FAIL, error, { itemCount: cartItems.length });
            throw error;
        }
    }

    /**
     * Calculate delivery charge refund for partial returns
     * ENFORCES delivery_refund_policy: Only refunds delivery if policy is REFUNDABLE
     * Backend is the single source of truth for refund policy enforcement
     * 
     * @param {Array} originalItems - Original order items
     * @param {Array} returnedItems - Items being returned
     * @returns {Promise<object>} { refundDeliveryCharge, refundDeliveryGST, totalRefund, policyDetails, isRefundable }
     */
    static async calculateRefundDelivery(originalItems, returnedItems) {
        log.operationStart(LOGS.DELIVERY_REFUND_START, {
            originalCount: originalItems.length,
            returnCount: returnedItems.length
        });

        try {
            let refundDeliveryCharge = 0;
            let refundDeliveryGST = 0;
            const policyDetails = [];

            for (const returnItem of returnedItems) {
                const orderItem = originalItems.find(oi => oi.id === returnItem.orderItemId);
                if (!orderItem) continue;

                const snapshot = orderItem.delivery_calculation_snapshot || {};
                const policy = snapshot.delivery_refund_policy || 'REFUNDABLE';

                const originalQty = orderItem.quantity || 1;
                const returnedQty = returnItem.quantity || 0;
                
                // Protect against division by zero or invalid ratio
                const ratio = originalQty > 0 ? (returnedQty / originalQty) : 0;

                let refundableCharge = 0;
                let refundableGST = 0;

                if (policy === 'REFUNDABLE') {
                    refundableCharge = orderItem.delivery_charge || 0;
                    refundableGST = orderItem.delivery_gst || 0;
                } else if (policy === 'PARTIAL') {
                    const nonRefCharge = snapshot.non_refundable_delivery_charge || 0;
                    const nonRefGST = snapshot.non_refundable_delivery_gst || 0;
                    refundableCharge = Math.max(0, (orderItem.delivery_charge || 0) - nonRefCharge);
                    refundableGST = Math.max(0, (orderItem.delivery_gst || 0) - nonRefGST);
                } else if (policy === 'NON_REFUNDABLE') {
                    refundableCharge = 0;
                    refundableGST = 0;
                }

                const itemRefundCharge = refundableCharge * ratio;
                const itemRefundGST = refundableGST * ratio;

                refundDeliveryCharge += itemRefundCharge;
                refundDeliveryGST += itemRefundGST;

                policyDetails.push({
                    product_id: orderItem.product_id,
                    variant_id: orderItem.variant_id,
                    order_item_id: orderItem.id,
                    policy: policy,
                    original_delivery_charge: orderItem.delivery_charge,
                    original_delivery_gst: orderItem.delivery_gst,
                    refundable_portion: refundableCharge,
                    returned_quantity: returnedQty,
                    refunded_charge: itemRefundCharge,
                    refunded_gst: itemRefundGST
                });
            }

            const totalRefund = refundDeliveryCharge + refundDeliveryGST;

            log.operationSuccess(LOGS.DELIVERY_REFUND_SUCCESS, {
                refundDeliveryCharge: Math.round(refundDeliveryCharge * 100) / 100,
                refundDeliveryGST: Math.round(refundDeliveryGST * 100) / 100,
                policiesApplied: policyDetails.length,
                nonRefundableCount: policyDetails.filter(p => p.policy === 'NON_REFUNDABLE').length
            });

            return {
                refundDeliveryCharge: Math.round(refundDeliveryCharge * 100) / 100,
                refundDeliveryGST: Math.round(refundDeliveryGST * 100) / 100,
                totalRefund: Math.round(totalRefund * 100) / 100,
                policyDetails: policyDetails,  // Audit trail showing which policies were applied
                isRefundable: refundDeliveryCharge > 0  // Quick boolean check
            };

        } catch (error) {
            log.operationError(LOGS.DELIVERY_REFUND_FAIL, error);
            throw error;
        }
    }
}

module.exports = { DeliveryChargeService, CALCULATION_TYPES };
