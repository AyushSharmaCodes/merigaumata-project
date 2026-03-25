const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { getActiveCoupons, invalidateCouponCache } = require('../services/coupon.service');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

/**
 * Coupon Routes
 * Admin-only endpoints for managing discount coupons
 */

// Get all coupons (admin & manager)
router.get('/', authenticateToken, checkPermission('can_manage_coupons'), async (req, res) => {
    try {
        const { type, is_active, expired } = req.query;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('coupons')
            .select('*', { count: 'exact' })
            .range(from, to)
            .order('created_at', { ascending: false });

        // Apply filters
        if (type) {
            query = query.eq('type', type);
        }

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const { data, error, count } = await query;

        if (error) throw error;

        // Filter expired coupons if requested
        let coupons = data;
        if (expired !== undefined) {
            const now = new Date();
            if (expired === 'true') {
                coupons = data.filter(c => new Date(c.valid_until) < now);
            } else if (expired === 'false') {
                coupons = data.filter(c => new Date(c.valid_until) >= now);
            }
        }

        res.json({
            coupons,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error) {
        logger.error({ err: error, query: req.query }, 'Failed to fetch coupons');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get active coupons for promotional banners (public)
router.get('/active', async (req, res) => {
    try {
        const coupons = await getActiveCoupons();
        res.json(coupons);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch active coupons');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single coupon by ID (admin & manager)
router.get('/:id', authenticateToken, checkPermission('can_manage_coupons'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: req.t('errors.coupon.notFound') });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error, couponId: req.params.id }, 'Failed to fetch coupon');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new coupon (admin & manager)
router.post('/', authenticateToken, checkPermission('can_manage_coupons'), requestLock('coupon-create'), idempotency(), async (req, res) => {
    try {
        const {
            code,
            type,
            discount_percentage,
            target_id,
            min_purchase_amount,
            max_discount_amount,
            valid_from,
            valid_until,
            usage_limit,
            is_active
        } = req.body;

        // Validation
        if (!code || !type || (type !== 'free_delivery' && !discount_percentage) || !valid_until) {
            return res.status(400).json({
                error: req.t('errors.coupon.missingFields')
            });
        }

        if (type !== 'free_delivery' && (discount_percentage < 1 || discount_percentage > 100)) {
            return res.status(400).json({
                error: req.t('errors.coupon.invalidDiscount')
            });
        }

        if (!['product', 'category', 'cart', 'variant', 'free_delivery'].includes(type)) {
            return res.status(400).json({
                error: req.t('errors.coupon.invalidType')
            });
        }

        // Ensure code is uppercase
        const upperCode = code.toUpperCase();

        // Check for duplicate code
        const { data: existing } = await supabase
            .from('coupons')
            .select('id')
            .eq('code', upperCode)
            .single();

        if (existing) {
            return res.status(400).json({ error: req.t('errors.coupon.exists') });
        }

        const { data, error } = await supabase
            .from('coupons')
            .insert([{
                code: upperCode,
                type,
                discount_percentage: type === 'free_delivery' ? (discount_percentage || 1) : discount_percentage,
                target_id,
                min_purchase_amount: min_purchase_amount || 0,
                max_discount_amount,
                valid_from: valid_from || new Date().toISOString(),
                valid_until,
                usage_limit,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select()
            .single();

        if (error) throw error;

        // Invalidate cache immediately so new coupons show up in cart offers/banners
        invalidateCouponCache();

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Failed to create coupon');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update coupon (admin & manager)
router.put('/:id', authenticateToken, checkPermission('can_manage_coupons'), requestLock((req) => `coupon-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const {
            code,
            type,
            discount_percentage,
            target_id,
            min_purchase_amount,
            max_discount_amount,
            valid_from,
            valid_until,
            usage_limit,
            is_active
        } = req.body;

        // Build update object
        const updates = {};

        if (code !== undefined) updates.code = code.toUpperCase();
        if (type !== undefined) updates.type = type;
        if (discount_percentage !== undefined) {
            if (type !== 'free_delivery' && (discount_percentage < 1 || discount_percentage > 100)) {
                return res.status(400).json({
                    error: req.t('errors.coupon.invalidDiscount')
                });
            }
            updates.discount_percentage = discount_percentage;
        }
        if (target_id !== undefined) updates.target_id = target_id;
        if (min_purchase_amount !== undefined) updates.min_purchase_amount = min_purchase_amount;
        if (max_discount_amount !== undefined) updates.max_discount_amount = max_discount_amount;
        if (valid_from !== undefined) updates.valid_from = valid_from;
        if (valid_until !== undefined) updates.valid_until = valid_until;
        if (usage_limit !== undefined) updates.usage_limit = usage_limit;
        if (is_active !== undefined) updates.is_active = is_active;

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('coupons')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: req.t('errors.coupon.notFound') });
        }

        // Invalidate cache on update
        invalidateCouponCache(data.code);

        res.json(data);
    } catch (error) {
        logger.error({ err: error, couponId: req.params.id, body: req.body }, 'Failed to update coupon');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete coupon (soft delete - set inactive) (admin & manager)
router.delete('/:id', authenticateToken, checkPermission('can_manage_coupons'), requestLock((req) => `coupon-delete:${req.params.id}`), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('coupons')
            .update({ is_active: false })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: req.t('errors.coupon.notFound') });
        }

        // Invalidate cache on delete (deactivation)
        invalidateCouponCache(data.code);

        res.json({ message: req.t('success.coupon.deactivated'), coupon: data });
    } catch (error) {
        logger.error({ err: error, couponId: req.params.id }, 'Failed to deactivate coupon');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
