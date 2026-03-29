const express = require('express');
const router = express.Router();
const settingsService = require('../services/settings.service');
const { CurrencyExchangeService } = require('../services/currency-exchange.service');
const logger = require('../utils/logger');
const { authenticateToken, requireRole, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');

/**
 * @route GET /api/settings/delivery
 * @desc Get dynamic delivery thresholds and charges
 * @access Public
 */
router.get('/delivery', async (req, res, next) => {
    try {
        const settings = await settingsService.getDeliverySettings();
        res.json(settings);
    } catch (error) {
        logger.error({ err: error }, 'Error in GET /settings/delivery');
        next(error);
    }
});

/**
 * @route PATCH /api/settings/delivery
 * @desc Update dynamic delivery thresholds and charges
 * @access Admin/Manager
 */
router.patch('/delivery', authenticateToken, checkPermission('can_manage_delivery_configs'), requestLock('settings-delivery-update'), idempotency(), async (req, res, next) => {
    try {
        const { threshold, charge, gst, gst_mode } = req.body;
        const result = await settingsService.updateDeliverySettings({ threshold, charge, gst, gst_mode });

        // Invalidate delivery settings cache in cart service
        // Cache is handled directly in service or disabled, no need to call cart service
        // const { invalidateDeliverySettingsCache } = require('../services/cart.service');
        // invalidateDeliverySettingsCache();

        res.json(result);
    } catch (error) {
        logger.error('Settings update failed', {
            module: 'Settings',
            operation: 'UPDATE_DELIVERY',
            err: error
        });
        next(error);
    }
});

router.get('/currency', async (req, res, next) => {
    try {
        const settings = await settingsService.getCurrencySettings();
        res.json(settings);
    } catch (error) {
        logger.error({ err: error }, 'Error in GET /settings/currency');
        next(error);
    }
});

router.patch('/currency', authenticateToken, requireRole('admin'), requestLock('settings-currency-update'), idempotency(), async (req, res, next) => {
    try {
        const result = await settingsService.updateCurrencySettings({
            base_currency: req.body.base_currency
        });
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error in PATCH /settings/currency');
        if (error.status === 403) {
            return res.status(403).json({ error: error.message });
        }
        next(error);
    }
});

router.get('/currency-context', async (req, res, next) => {
    try {
        const { base_currency, supported_currencies } = await settingsService.getCurrencySettings();
        const canonicalCurrency = 'INR';
        const requestedCurrency = req.get('x-user-currency') || req.query.currency || base_currency;
        const context = await CurrencyExchangeService.getCurrencyContext(canonicalCurrency, requestedCurrency);

        res.json({
            ...context,
            default_display_currency: base_currency,
            supported_currencies,
            fetched_at: context.fetched_at,
            is_stale: context.is_stale
        });
    } catch (error) {
        logger.error({ err: error }, 'Error in GET /settings/currency-context');
        next(error);
    }
});

module.exports = router;
