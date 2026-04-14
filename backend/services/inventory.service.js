const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const { INVENTORY, LOGS } = require('../constants/messages');

// Create module-specific logger
const log = createModuleLogger('InventoryService');

/**
 * Inventory Service
 * Handles thread-safe stock management for products using atomic PostgreSQL operations
 */

/**
 * Check if all items have sufficient stock (variant-aware)
 * @param {Array} items - Array of { product_id, variant_id, quantity } or cart items
 * @returns {Promise<{ available: boolean, insufficientItems: Array }>}
 */
const checkStockAvailability = async (items) => {
    log.operationStart(LOGS.LOG_CHECK_STOCK, { itemCount: items.length });
    const startTime = Date.now();
    const insufficientItems = [];

    if (!items || items.length === 0) return { available: true, insufficientItems: [] };

    // 1. Group unique Product and Variant IDs
    const productIds = new Set();
    const variantIds = new Set();
    const itemMap = new Map(); // Key: prod_var, Value: requested qty

    items.forEach(item => {
        const pId = item.product_id || item.product?.id;
        const vId = item.variant_id || item.variant?.id || null;
        const qty = item.quantity || 1;
        
        if (pId) {
            productIds.add(pId);
            if (vId) variantIds.add(vId);
            
            const key = `${pId}_${vId || 'base'}`;
            itemMap.set(key, (itemMap.get(key) || 0) + qty);
        }
    });

    // 2. Fetch all required data in parallel (Consolidated Roundtrips)
    const [productsResult, variantsResult] = await Promise.all([
        productIds.size > 0 
            ? supabase.from('products').select('id, title, inventory').in('id', Array.from(productIds))
            : Promise.resolve({ data: [] }),
        variantIds.size > 0
            ? supabase.from('product_variants').select('id, product_id, stock_quantity, size_label, products(title)').in('id', Array.from(variantIds))
            : Promise.resolve({ data: [] })
    ]);

    const productsData = new Map((productsResult.data || []).map(p => [p.id, p]));
    const variantsData = new Map((variantsResult.data || []).map(v => [v.id, v]));

    // 3. Validate In-Memory
    for (const [key, requestedQty] of itemMap.entries()) {
        const [pId, vIdPart] = key.split('_');
        const vId = vIdPart === 'base' ? null : vIdPart;

        let availableStock = 0;
        let itemTitle = INVENTORY.DEFAULT_PRODUCT_TITLE;
        let variantLabel = null;

        if (vId) {
            const variant = variantsData.get(vId);
            if (!variant) {
                insufficientItems.push({
                    product_id: pId,
                    variant_id: vId,
                    requested: requestedQty,
                    available: 0,
                    message: INVENTORY.VARIANT_NOT_FOUND
                });
                continue;
            }
            availableStock = variant.stock_quantity || 0;
            itemTitle = variant.products?.title || INVENTORY.DEFAULT_PRODUCT_TITLE;
            variantLabel = variant.size_label;
        } else {
            const product = productsData.get(pId);
            if (!product) {
                insufficientItems.push({
                    product_id: pId,
                    requested: requestedQty,
                    available: 0,
                    message: INVENTORY.PRODUCT_NOT_FOUND
                });
                continue;
            }
            availableStock = product.inventory || 0;
            itemTitle = product.title;
        }

        if (availableStock < requestedQty) {
            const label = variantLabel ? `${itemTitle} - ${variantLabel}` : itemTitle;
            insufficientItems.push({
                product_id: pId,
                variant_id: vId,
                title: label,
                requested: requestedQty,
                available: availableStock,
                message: INVENTORY.INSUFFICIENT_STOCK
            });
        }
    }

    const result = {
        available: insufficientItems.length === 0,
        insufficientItems
    };

    if (result.available) {
        log.operationSuccess(LOGS.LOG_CHECK_STOCK, { itemCount: items.length, allAvailable: true }, Date.now() - startTime);
    } else {
        log.warn(LOGS.LOG_CHECK_STOCK, LOGS.INV_INSUFFICIENT_STOCK, {
            insufficientCount: insufficientItems.length
        });
    }

    return result;
};

/**
 * Decrease inventory for ordered items
 * Uses batchDecreaseInventory for optimal performance (single RPC call)
 */
const decreaseInventory = async (items) => {
    // Standardize items for batch processor
    const normalizedItems = items.map(item => ({
        product_id: item.product_id || item.product?.id,
        variant_id: item.variant_id || item.variant?.id || null, // Ensure variant_id is passed
        quantity: item.quantity || 1
    })).filter(item => item.product_id);

    // Delegate to the optimized batch atomic logic
    return batchDecreaseInventory(normalizedItems);
};

/**
 * Restore inventory for cancelled/returned items using ATOMIC PostgreSQL function
 * 
 * @param {Array} items - Array of { product_id, quantity } or order items
 * @returns {Promise<{ success: boolean, results: Array }>}
 */
const restoreInventory = async (items) => {
    if (!items || items.length === 0) return { success: true, results: [] };
    
    const trace = getTraceContext();
    log.operationStart(LOGS.LOG_RESTORE_INVENTORY, { itemCount: items.length });
    const startTime = Date.now();

    // Standardize items for batch processor
    const normalizedItems = items.map(item => ({
        product_id: item.product_id || item.product?.id,
        variant_id: item.variant_id || item.variant?.id || item.variant_snapshot?.variant_id || null,
        quantity: item.quantity || 1
    })).filter(item => item.product_id);

    const { data: rpcResult, error: rpcError } = await supabase
        .rpc('batch_increment_inventory_atomic', {
            p_items: normalizedItems,
            p_trace_id: trace.traceId
        });

    if (rpcError) {
        log.operationError(LOGS.LOG_RESTORE_INVENTORY, rpcError, { itemCount: items.length });
        return { success: false, error: rpcError.message };
    }

    if (!rpcResult?.success) {
        log.warn(LOGS.LOG_RESTORE_INVENTORY, LOGS.INV_BATCH_FAILED, {
            error: rpcResult?.error
        });
        return {
            success: false,
            error: rpcResult?.error || 'BATCH_FAILED'
        };
    }

    log.operationSuccess(LOGS.LOG_RESTORE_INVENTORY, {
        itemsProcessed: rpcResult.itemCount
    }, Date.now() - startTime);

    return { success: true, itemCount: rpcResult.itemCount };
};

/**
 * Batch decrease inventory atomically - all or nothing
 * Uses PostgreSQL function that rolls back all if any fails
 * 
 * @param {Array} items - Array of { product_id, quantity }
 * @returns {Promise<{ success: boolean, error?: string, failedItems?: Array }>}
 */
const batchDecreaseInventory = async (items) => {
    const trace = getTraceContext();
    log.operationStart(LOGS.LOG_BATCH_DECREASE_INVENTORY, { itemCount: items.length });
    const startTime = Date.now();

    // Normalize items format
    const normalizedItems = items.map(item => ({
        product_id: item.product_id || item.product?.id,
        variant_id: item.variant_id || item.variant?.id || null,
        quantity: item.quantity || 1
    })).filter(item => item.product_id);

    const { data: rpcResult, error: rpcError } = await supabase
        .rpc('batch_decrement_inventory_atomic', {
            p_items: normalizedItems,
            p_trace_id: trace.traceId
        });

    if (rpcError) {
        log.operationError(LOGS.LOG_BATCH_DECREASE_INVENTORY, rpcError, { itemCount: items.length });
        return { success: false, error: rpcError.message };
    }

    if (!rpcResult?.success) {
        log.warn(LOGS.LOG_BATCH_DECREASE_INVENTORY, LOGS.INV_BATCH_FAILED, {
            error: rpcResult?.error,
            failedItems: rpcResult?.failedItems
        });
        return {
            success: false,
            error: rpcResult?.error || 'BATCH_FAILED',
            message: rpcResult?.message,
            failedItems: rpcResult?.failedItems
        };
    }

    log.operationSuccess(LOGS.LOG_BATCH_DECREASE_INVENTORY, {
        itemsProcessed: rpcResult.itemsProcessed
    }, Date.now() - startTime);

    return { success: true, results: rpcResult.results };
};

module.exports = {
    checkStockAvailability,
    decreaseInventory,
    restoreInventory,
    batchDecreaseInventory
};
