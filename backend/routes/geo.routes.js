const express = require('express');
const router = express.Router();
const geoService = require('../services/geo.service');
const logger = require('../utils/logger');

/**
 * GET /api/geo/countries
 * Proxy for countries API with phone codes
 */
router.get('/countries', async (req, res) => {
    try {
        const countries = await geoService.getCountries();
        res.json(countries);
    } catch (error) {
        logger.error({ err: error.message }, 'Error fetching countries:');
        res.status(500).json({ error: req.t('errors.geo.fetchCountriesFailed') });
    }
});

/**
 * GET /api/geo/states/:countryIso2
 * Proxy for states API
 */
router.get('/states/:countryIso2', async (req, res) => {
    try {
        const { countryIso2 } = req.params;
        const states = await geoService.getStates(countryIso2);
        res.json(states);
    } catch (error) {
        logger.error({ err: error.message, countryIso2: req.params.countryIso2 }, 'Error fetching states:');
        res.status(500).json({ error: req.t('errors.geo.fetchStatesFailed') });
    }
});

/**
 * POST /api/geo/states
 * Legacy support for POST /states (if needed by old frontend)
 */
router.post('/states', async (req, res) => {
    try {
        const { countryIso2, country } = req.body;
        // If country name is provided instead of ISO2, we might need a lookup, 
        // but GeoService ideally wants ISO2.
        const states = await geoService.getStates(countryIso2 || country);
        res.json({ data: states }); // Wrap in data for legacy compatibility
    } catch (error) {
        logger.error({ err: error.message }, 'Error fetching states (Legacy POST):');
        res.status(500).json({ error: req.t('errors.geo.fetchStatesFailed') });
    }
});

const phoneValidator = require('../utils/phone-validator');
const { phoneValidationRateLimit } = require('../middleware/rateLimit.middleware');

/**
 * GET /api/geo/postal/:country/:postalCode
 * Proxy for postal code validation
 */
router.get('/postal/:country/:postalCode', async (req, res) => {
    try {
        const { country, postalCode } = req.params;
        const result = await geoService.validatePostalCode(country, postalCode);
        res.json(result);
    } catch (error) {
        logger.error({ err: error.message }, 'Error validating postal code:');
        res.status(500).json({ error: req.t('errors.geo.validatePostalFailed') });
    }
});

/**
 * GET /api/geo/validate-phone
 * Proxy for phone validation using Abstract API
 */
router.get('/validate-phone', phoneValidationRateLimit, async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const result = await phoneValidator.validate(phone);
        res.json(result);
    } catch (error) {
        logger.error({ err: error.message, phone: req.query.phone }, 'Error validating phone number:');
        res.status(500).json({ error: 'Internal server error during phone validation' });
    }
});

module.exports = router;
