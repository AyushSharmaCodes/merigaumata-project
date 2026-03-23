/**
 * Delivery Configs API Routes
 * Admin-only routes for managing delivery configuration rules
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('DeliveryConfigsRoutes');

/**
 * Get delivery config for a product
 * GET /api/admin/delivery-configs/product/:productId
 */
router.get('/product/:productId', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { productId } = req.params;

        const { data, error } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('scope', 'PRODUCT')
            .eq('product_id', productId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = No rows returned
            throw error;
        }

        res.json({ config: data || null });
    } catch (error) {
        const errorMsg = req.t('errors.delivery.fetchConfigFailed');
        log.operationError('GET_PRODUCT_CONFIG', error, { productId: req.params.productId, message: errorMsg });
        res.status(500).json({ error: errorMsg });
    }
});

/**
 * Get delivery config for a variant
 * GET /api/admin/delivery-configs/variant/:variantId
 */
router.get('/variant/:variantId', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { variantId } = req.params;

        const { data, error } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('scope', 'VARIANT')
            .eq('variant_id', variantId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({ config: data || null });
    } catch (error) {
        const errorMsg = req.t('errors.delivery.fetchConfigFailed');
        log.operationError('GET_VARIANT_CONFIG', error, { variantId: req.params.variantId, message: errorMsg });
        res.status(500).json({ error: errorMsg });
    }
});

/**
 * Create or update delivery config
 * POST /api/admin/delivery-configs
 * Admin only
 */
router.post('/', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const {
            scope,
            product_id,
            variant_id,
            calculation_type,
            base_delivery_charge,
            max_items_per_package,
            unit_weight,
            gst_percentage,
            is_taxable,
            delivery_refund_policy
        } = req.body;

        // Apply defaults BEFORE validation
        const normalized_base_delivery_charge = base_delivery_charge !== undefined ? parseFloat(base_delivery_charge) : 0;
        const normalized_max_items = (calculation_type === 'PER_PACKAGE') ? (parseInt(max_items_per_package) || 3) : 3;
        const normalized_gst = gst_percentage !== undefined ? parseFloat(gst_percentage) : 18;
        const normalized_is_taxable = is_taxable !== undefined ? (is_taxable === true || is_taxable === 'true') : true;
        const normalized_refund_policy = delivery_refund_policy || 'NON_REFUNDABLE';

        // Validation
        if (!scope || !['PRODUCT', 'VARIANT'].includes(scope)) {
            const errorMsg = req.t('errors.delivery.invalidScope');
            log.warn('INVALID_CONFIG_SCOPE', errorMsg, { scope });
            return res.status(400).json({ error: errorMsg });
        }

        if (scope === 'PRODUCT' && !product_id) {
            const errorMsg = req.t('errors.delivery.productIdRequired');
            log.warn('PRODUCT_ID_MISSING', errorMsg);
            return res.status(400).json({ error: errorMsg });
        }

        if (scope === 'VARIANT' && !variant_id) {
            const errorMsg = req.t('errors.delivery.variantIdRequired');
            log.warn('VARIANT_ID_MISSING', errorMsg);
            return res.status(400).json({ error: errorMsg });
        }

        if (!calculation_type || !['FLAT_PER_ORDER', 'PER_PACKAGE', 'WEIGHT_BASED', 'PER_ITEM'].includes(calculation_type)) {
            const errorMsg = req.t('errors.delivery.invalidCalculationType');
            log.warn('INVALID_CALCULATION_TYPE', errorMsg, { calculation_type });
            return res.status(400).json({ error: errorMsg });
        }

        if (normalized_base_delivery_charge < 0) {
            const errorMsg = req.t('errors.delivery.negativeBaseCharge');
            log.warn('NEGATIVE_BASE_CHARGE', errorMsg, { base_delivery_charge: normalized_base_delivery_charge });
            return res.status(400).json({ error: errorMsg });
        }

        if (calculation_type === 'PER_PACKAGE' && (normalized_max_items < 1)) {
            const errorMsg = req.t('errors.delivery.invalidMaxItems');
            log.warn('INVALID_MAX_ITEMS', errorMsg, { max_items_per_package: normalized_max_items });
            return res.status(400).json({ error: errorMsg });
        }

        if (!['REFUNDABLE', 'NON_REFUNDABLE'].includes(normalized_refund_policy)) {
            const errorMsg = req.t('errors.delivery.invalidRefundPolicy');
            log.warn('INVALID_REFUND_POLICY', errorMsg, { delivery_refund_policy: normalized_refund_policy });
            return res.status(400).json({ error: errorMsg });
        }

        const configData = {
            scope,
            product_id: scope === 'PRODUCT' ? product_id : null,
            variant_id: scope === 'VARIANT' ? variant_id : null,
            calculation_type,
            base_delivery_charge: normalized_base_delivery_charge,
            max_items_per_package: normalized_max_items,
            unit_weight: calculation_type === 'WEIGHT_BASED' ? (parseFloat(unit_weight) || 0) : null,
            gst_percentage: normalized_gst,
            is_taxable: normalized_is_taxable,
            delivery_refund_policy: normalized_refund_policy,
            is_active: req.body.is_active !== undefined ? (req.body.is_active === true || req.body.is_active === 'true') : true,
            updated_at: new Date().toISOString()
        };

        // Upsert (insert or update)
        // Check if config exists (manual upsert to handle partial indexes)
        let query = supabase.from('delivery_configs').select('id');

        if (scope === 'PRODUCT') {
            query = query.eq('scope', 'PRODUCT').eq('product_id', product_id);
        } else {
            query = query.eq('scope', 'VARIANT').eq('variant_id', variant_id);
        }

        const { data: existing, error: fetchError } = await query.maybeSingle();

        if (fetchError) throw fetchError;

        let result;
        if (existing) {
            // Update existing config
            result = await supabase
                .from('delivery_configs')
                .update(configData)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            // Insert new config
            result = await supabase
                .from('delivery_configs')
                .insert(configData)
                .select()
                .single();
        }

        const { data, error } = result;

        if (error) throw error;

        log.info('DELIVERY_CONFIG_SAVED', 'Delivery config created/updated', {
            scope,
            id: data.id,
            calculation_type
        });

        res.json({ config: data });
    } catch (error) {
        const errorMsg = req.t('errors.delivery.saveFailed');
        log.operationError('SAVE_DELIVERY_CONFIG', error, { body: req.body, message: errorMsg });
        res.status(500).json({ error: errorMsg });
    }
});

/**
 * Delete delivery config
 * DELETE /api/admin/delivery-configs/:id
 * Admin only
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('delivery_configs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        log.info('DELIVERY_CONFIG_DELETED', 'Delivery config deleted', { id });

        res.json({ message: req.t('success.delivery.deleted') });
    } catch (error) {
        const errorMsg = req.t('errors.delivery.deleteFailed');
        log.operationError('DELETE_DELIVERY_CONFIG', error, { id: req.params.id, message: errorMsg });
        res.status(500).json({ error: errorMsg });
    }
});

/**
 * Get all delivery configs (for admin overview)
 * GET /api/admin/delivery-configs
 * Admin only
 */
router.get('/', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('delivery_configs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ configs: data });
    } catch (error) {
        const errorMsg = req.t('errors.delivery.fetchAllFailed');
        log.operationError('GET_ALL_CONFIGS', error, { message: errorMsg });
        res.status(500).json({ error: errorMsg });
    }
});

module.exports = router;
