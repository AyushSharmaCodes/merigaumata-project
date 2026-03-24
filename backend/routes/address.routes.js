const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth.middleware');
const { getUserAddresses, setPrimaryAddress, formatAddress, createAddress, updateAddress } = require('../services/address.service');
const crypto = require('crypto');
const { getFriendlyMessage } = require('../utils/error-messages');

/**
 * GET /api/addresses
 * Get all addresses for current user
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Use service to get addresses with phone numbers
        const addresses = await getUserAddresses(userId);

        // Transform snake_case to camelCase for frontend
        const transformedData = (addresses || []).map(address => ({
            id: address.id,
            userId: address.user_id,
            type: address.type,
            isPrimary: address.is_primary,
            streetAddress: address.street_address,
            apartment: address.apartment,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            country: address.country,
            label: address.label,
            phone: address.phone, // Now included from service
            createdAt: address.created_at,
            updatedAt: address.updated_at
        }));

        logger.info({ data: transformedData }, '[AddressDebug] Sending addresses');
        res.json(transformedData);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching addresses:');
        res.status(500).json({ error: req.t('errors.address.fetchFailed') });
    }
});

/**
 * POST /api/addresses
 * Create a new address
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { type, streetAddress, apartment, city, state, postalCode, country, isPrimary, label, phone } = req.body;

        // Validation
        if (!type || !['home', 'work', 'other'].includes(type)) {
            return res.status(400).json({ error: req.t('errors.address.invalidType') });
        }

        if (!streetAddress || !city || !state || !postalCode || !phone) {
            return res.status(400).json({ error: req.t('errors.address.missingFields') });
        }

        // Check type constraints (one home, one work)
        if (type !== 'other') {
            const { data: existingAddresses } = await supabase
                .from('addresses')
                .select('id')
                .eq('user_id', userId)
                .eq('type', type)
                .limit(1);

            if (existingAddresses && existingAddresses.length > 0) {
                return res.status(400).json({
                    error: req.t('errors.address.typeExists', { type })
                });
            }
        }

        // Prepare address data for service
        const addressData = {
            type,
            address_line1: streetAddress, // Map to DB column name expected by service
            address_line2: apartment || null, // Map to DB column name expected by service
            city,
            state,
            postal_code: postalCode, // Map to DB column name expected by service
            country: country || 'India',
            is_primary: isPrimary || false,
            label: label || null,
            phone,
            full_name: req.body.full_name || label || 'User' // Ensure full_name is passed if available, or fallback
        };

        const newAddress = await createAddress(userId, addressData);

        res.status(201).json({
            message: req.t('success.address.created'),
            address: newAddress
        });
    } catch (error) {
        logger.error({ err: error }, 'Error creating address:');

        // Handle constraint violation errors
        if (error.message && error.message.includes('can only have one')) {
            return res.status(400).json({ error: getFriendlyMessage(error, 400) });
        }

        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * PUT /api/addresses/:id
 * Update an address
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { type, streetAddress, apartment, city, state, postalCode, country, isPrimary, label, phone } = req.body;

        // Verify ownership
        const { data: existingAddress } = await supabase
            .from('addresses')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (!existingAddress) {
            return res.status(404).json({ error: req.t('errors.address.notFound') });
        }

        // Validation
        if (type && !['home', 'work', 'other'].includes(type)) {
            return res.status(400).json({ error: req.t('errors.address.invalidTypeSimple') });
        }

        // Check type constraints if changing type
        if (type && type !== existingAddress.type && type !== 'other') {
            const { data: conflictingAddresses } = await supabase
                .from('addresses')
                .select('id')
                .eq('user_id', userId)
                .eq('type', type)
                .neq('id', id)
                .limit(1);

            if (conflictingAddresses && conflictingAddresses.length > 0) {
                return res.status(400).json({
                    error: req.t('errors.address.typeExistsUpdate', { type })
                });
            }
        }

        // Prepare update data
        const updateData = {};
        if (type) updateData.type = type;
        if (streetAddress) updateData.street_address = streetAddress; // Map to DB column
        if (apartment !== undefined) updateData.apartment = apartment || null;
        if (city) updateData.city = city;
        if (state) updateData.state = state;
        if (postalCode) updateData.postal_code = postalCode; // Map to DB column
        if (country) updateData.country = country;
        if (isPrimary !== undefined) updateData.is_primary = isPrimary;
        if (label !== undefined) updateData.label = label || null;
        if (phone) updateData.phone = phone;

        const updatedAddress = await updateAddress(id, userId, updateData);

        res.json({
            message: req.t('success.address.updated'),
            address: updatedAddress
        });
    } catch (error) {
        logger.error({ err: error }, 'Error updating address:');

        if (error.message && error.message.includes('can only have one')) {
            return res.status(400).json({ error: getFriendlyMessage(error, 400) });
        }

        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * DELETE /api/addresses/:id
 * Delete an address
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Verify ownership
        const { data: existingAddress } = await supabase
            .from('addresses')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (!existingAddress) {
            return res.status(404).json({ error: req.t('errors.address.notFound') });
        }

        // Delete address
        const { error } = await supabase
            .from('addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;

        // If this was the primary address, set another address as primary
        if (existingAddress.is_primary) {
            const { data: otherAddresses } = await supabase
                .from('addresses')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            if (otherAddresses && otherAddresses.length > 0) {
                await supabase
                    .from('addresses')
                    .update({ is_primary: true })
                    .eq('id', otherAddresses[0].id);
            }
        }

        res.json({ message: req.t('success.address.deleted') });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting address:');
        res.status(500).json({ error: req.t('errors.address.deleteFailed') });
    }
});

/**
 * POST /api/addresses/:id/set-primary
 * Set an address as primary
 */
router.post('/:id/set-primary', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        let { type } = req.body; // Expect type to be passed from frontend
        const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

        logger.info({ id, type, userId }, '[AddressRoute] Set primary triggered');

        if (!type) {
            logger.warn({ id, userId }, '[AddressRoute] Type missing in set-primary request, fetching from DB');
            const { data: address, error: fetchError } = await supabase
                .from('addresses')
                .select('type')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (fetchError || !address) {
                logger.error({ err: fetchError, id, userId }, '[AddressRoute] Failed to fetch address for type lookup');
                return res.status(404).json({ error: req.t('errors.address.notFound') });
            }
            type = address.type;
            logger.info({ id, type }, '[AddressRoute] Successfully looked up address type');
        }

        const updatedAddress = await setPrimaryAddress(id, userId, type, correlationId);

        res.json({
            message: req.t('success.address.primaryUpdated'),
            address: formatAddress(updatedAddress)
        });
    } catch (error) {
        logger.error({ err: error.message, id: req.params.id }, 'Error setting primary address:');
        res.status(500).json({ error: req.t('errors.address.setPrimaryFailed') });
    }
});

module.exports = router;
