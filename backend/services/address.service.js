const supabase = require('../lib/supabase');
const phoneValidator = require('../utils/phone-validator');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { invalidateCheckoutSummaryCache } = require('./checkout-summary-cache.service');
const { rememberForRequest, invalidateRequestCacheByPrefix } = require('../utils/request-cache');

/**
 * Address Service
 * Handles CRUD operations for user addresses
 */

// Get all addresses for a user
const getUserAddresses = async (userId) => {
    return rememberForRequest(`addresses:list:${userId}`, async () => {
        const { data, error } = await supabase
            .from('addresses')
            .select(`
                *,
                phone_numbers (
                    phone_number
                )
            `)
            .eq('user_id', userId)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(formatAddress);
    });
};

// Get specific address
const getAddressById = async (id, userId) => {
    return rememberForRequest(`addresses:item:${userId}:${id}`, async () => {
        const { data, error } = await supabase
            .from('addresses')
            .select(`
                *,
                phone_numbers (
                    phone_number
                )
            `)
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) throw error;

        return formatAddress(data);
    });
};

function invalidateAddressRequestCache(userId) {
    invalidateRequestCacheByPrefix(`addresses:list:${userId}`);
    invalidateRequestCacheByPrefix(`addresses:item:${userId}:`);
    invalidateRequestCacheByPrefix(`addresses:primary:${userId}:`);
    invalidateRequestCacheByPrefix(`addresses:latest:${userId}:`);
}

async function ensurePhoneNumberId(userId, phoneNumber) {
    const { data, error } = await supabase
        .from('phone_numbers')
        .upsert([{
            user_id: userId,
            phone_number: phoneNumber,
            label: 'Mobile',
            is_primary: false
        }], {
            onConflict: 'user_id,phone_number',
            ignoreDuplicates: false
        })
        .select('id')
        .single();

    if (error) throw error;

    return data.id;
}

// Create new address
const createAddress = async (userId, addressData) => {
    logger.info({ data: { userId, addressData } }, 'createAddress called with:');
    // Validate required fields
    const required = ['full_name', 'phone', 'address_line1', 'city', 'state', 'postal_code', 'type'];
    for (const field of required) {
        if (!addressData[field]) {
            throw new Error(`${field} is required`);
        }
    }

    // Normalize phone for consistency
    const normalizedPhone = addressData.phone?.replace(/\s+/g, '').trim();

    // Phone validation using Abstract API
    logger.info({ phone: normalizedPhone }, 'Calling phone validator from createAddress');
    const validationResult = await phoneValidator.validate(normalizedPhone);
    if (!validationResult.isValid) {
        throw new Error(validationResult.error);
    }

    // 1. Handle Phone Number
    const phoneNumberId = await ensurePhoneNumberId(userId, normalizedPhone);

    // 2. If this address is being set as primary, unset all other primary addresses first
    if (addressData.is_primary) {
        await supabase
            .from('addresses')
            .update({ is_primary: false })
            .eq('user_id', userId);
    }

    // 3. Create Address - Map field names to DB column names
    const { phone, address_line1, address_line2, postal_code, full_name, ...otherFields } = addressData;

    const { data, error } = await supabase
        .from('addresses')
        .insert([{
            user_id: userId,
            phone_number_id: phoneNumberId,
            street_address: address_line1,        // DB column name
            apartment: address_line2 || null,     // DB column name  
            postal_code: postal_code,             // DB column name
            is_primary: !!addressData.is_primary, // DB column name & fix variable ref
            label: full_name || otherFields.label, // DB column name
            ...otherFields  // city, state, country, type
        }])
        .select(`
            *,
            phone_numbers (
                phone_number
            )
        `)
        .single();

    if (error) throw error;

    invalidateAddressRequestCache(userId);
    invalidateCheckoutSummaryCache({ userId, guestId: null });
    // Flatten the response to include phone directly
    return formatAddress(data);
};

// Update address
const updateAddress = async (id, userId, updates) => {
    logger.info({ data: { id, userId, updates } }, 'updateAddress called with:');

    // 1. Extract and map field names
    const { phone, address_line1, address_line2, postal_code, is_primary, ...otherUpdates } = updates;
    let dbUpdates = { ...otherUpdates };  // city, state, country, type, etc.

    // Map field names to database column names
    if (address_line1) dbUpdates.street_address = address_line1;
    if (address_line2 !== undefined) dbUpdates.apartment = address_line2 || null;
    if (postal_code) dbUpdates.postal_code = postal_code;
    if (is_primary !== undefined) dbUpdates.is_primary = is_primary;

    // If setting this address as primary, unset all other primary addresses first
    if (is_primary === true) {
        await supabase
            .from('addresses')
            .update({ is_primary: false })
            .eq('user_id', userId)
            .neq('id', id);
    }

    // 2. Handle Phone Number if present
    if (phone) {
        // Normalize phone for consistency
        const normalizedPhone = phone?.replace(/\s+/g, '').trim();

        logger.info({ phone: normalizedPhone }, 'Calling phone validator from updateAddress');
        const validationResult = await phoneValidator.validate(normalizedPhone);
        if (!validationResult.isValid) {
            throw new Error(validationResult.error);
        }

        dbUpdates.phone_number_id = await ensurePhoneNumberId(userId, normalizedPhone);
    }

    // 3. Update the address
    const { data, error } = await supabase
        .from('addresses')
        .update({
            ...dbUpdates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select(`
            *,
            phone_numbers (
                phone_number
            )
        `)
        .single();

    if (error) throw error;

    invalidateAddressRequestCache(userId);
    invalidateCheckoutSummaryCache({ userId, guestId: null });
    // Flatten response
    return formatAddress(data);
};

// Delete address
const deleteAddress = async (id, userId) => {
    const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) throw error;
    invalidateAddressRequestCache(userId);
    invalidateCheckoutSummaryCache({ userId, guestId: null });
    return { success: true };
};

// Set address as primary (Atomic via RPC with manual fallback)
const setPrimaryAddress = async (id, userId, type, correlationId = null) => {
    logger.info({ id, userId, type, correlationId }, 'Setting primary address via RPC');

    const { error } = await supabase.rpc('set_primary_address', {
        p_address_id: id,
        p_user_id: userId,
        p_address_type: type,
        p_correlation_id: correlationId || crypto.randomUUID()
    });

    if (error) {
        // Fallback: If RPC is missing (PGRST202), perform manual update
        if (error.code === 'PGRST202') {
            logger.warn({ id, userId, type }, 'RPC set_primary_address missing, performing manual fallback update');

            // 1. Unset existing primary for this user (globally)
            const { error: unsetError } = await supabase
                .from('addresses')
                .update({ is_primary: false, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('is_primary', true);

            if (unsetError) {
                logger.error({ err: unsetError, userId, type }, 'Manual fallback: Failed to unset existing primary');
                throw unsetError;
            }

            // 2. Set new primary
            const { error: setError } = await supabase
                .from('addresses')
                .update({ is_primary: true, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', userId);

            if (setError) {
                logger.error({ err: setError, id, userId }, 'Manual fallback: Failed to set new primary');
                throw setError;
            }

            logger.info({ id, userId, type }, 'Manual fallback update successful');
        } else {
            logger.error({ err: error, id, userId }, 'Failed to set primary address via RPC');
            throw error;
        }
    }

    // Fetch the updated address to return
    const { data, error: fetchError } = await supabase
        .from('addresses')
        .select(`
            *,
            phone_numbers (
                phone_number
            )
        `)
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;
    invalidateAddressRequestCache(userId);
    invalidateCheckoutSummaryCache({ userId, guestId: null });
    return formatAddress(data);
};

// Get primary address (with type-specific fallback)
const getPrimaryAddress = async (userId, type = null) => {
    return rememberForRequest(`addresses:primary:${userId}:${type || 'any'}`, async () => {
        const { data, error } = await supabase
            .from('addresses')
            .select(`
                *,
                phone_numbers (
                    phone_number
                )
            `)
            .eq('user_id', userId)
            .eq('is_primary', true);

        if (error) throw error;
        if (!data || data.length === 0) return null;

        if (type) {
            const typeMatch = data.find(addr => addr.type === type);
            if (typeMatch) return formatAddress(typeMatch);
        }

        return formatAddress(data[0]);
    });
};

// Get latest address (optional type filter)
const getLatestAddress = async (userId, type = null) => {
    return rememberForRequest(`addresses:latest:${userId}:${type || 'any'}`, async () => {
        const { data, error } = await supabase
            .from('addresses')
            .select(`
                *,
                phone_numbers (
                    phone_number
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return null;

        let result;
        if (type) {
            result = data.find(addr => addr.type === type || addr.type === 'both') || null;
        } else {
            result = data[0];
        }

        return formatAddress(result);
    });
};

// Helper to format DB address to frontend structure
const formatAddress = (addr) => {
    if (!addr) return null;

    // Extract phone from phone_numbers join or use existing field
    let phone = addr.phone;
    if (addr.phone_numbers) {
        const joinedPhone = Array.isArray(addr.phone_numbers)
            ? addr.phone_numbers[0]?.phone_number
            : addr.phone_numbers?.phone_number;

        // Only override if joinedPhone is valid
        if (joinedPhone) {
            phone = joinedPhone;
        }
    }

    return {
        ...addr,
        phone: phone || '',
        full_name: addr.label || addr.full_name || 'User',
        address_line1: addr.street_address || addr.address_line1 || '',
        address_line2: addr.apartment || addr.address_line2 || null,
        postal_code: addr.postal_code || '',
        city: addr.city || '',
        state: addr.state || '',
        country: addr.country || 'India',
        type: addr.type || 'other',
        is_primary: !!addr.is_primary
    };
};

module.exports = {
    getUserAddresses,
    getAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    setPrimaryAddress,
    getPrimaryAddress,
    getLatestAddress,
    formatAddress
};
