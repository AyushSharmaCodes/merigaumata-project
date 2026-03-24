const { supabaseAdmin, _supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Settings Service
 * Handles fetching and managing store configuration from the database
 */

// Cache for settings to avoid redundant DB calls on every cart calculation
let settingsCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds cache is enough for a single request flow

// Initialize real-time subscription to keep in-memory cache in sync with DB
const initRealtimeSync = () => {
    try {
        supabaseAdmin
            .channel('store_settings_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'store_settings'
                },
                (payload) => {
                    logger.info({ event: payload.eventType }, 'Store settings changed in DB, clearing in-memory cache');
                    clearSettingsCache();
                }
            )
            .subscribe();
    } catch (error) {
        logger.warn({ err: error }, 'Failed to initialize real-time sync for settings');
    }
};

// Start sync
initRealtimeSync();

const DEFAULT_SETTINGS = {
    delivery_threshold: 1500,
    delivery_charge: 50,
    delivery_gst: 0,
    delivery_gst_mode: 'inclusive',
    base_currency: 'INR'
};

const STORE_SETTING_DESCRIPTIONS = {
    delivery_threshold: 'Minimum order amount for free delivery',
    delivery_charge: 'Standard delivery charge for orders below threshold',
    delivery_gst: 'Standard GST rate for delivery charges',
    delivery_gst_mode: 'How delivery GST should be applied: inclusive or exclusive',
    base_currency: 'Default display currency for the storefront'
};

const SUPPORTED_CURRENCIES = [
    { code: 'INR', label: 'Indian Rupee', symbol: 'Rs' },
    { code: 'USD', label: 'US Dollar', symbol: '$' },
    { code: 'EUR', label: 'Euro', symbol: 'EUR' },
    { code: 'AUD', label: 'Australian Dollar', symbol: 'AUD' },
    { code: 'CAD', label: 'Canadian Dollar', symbol: 'CAD' },
    { code: 'JPY', label: 'Japanese Yen', symbol: 'JPY' }
];

function normalizeCurrencyCode(value, fallback = DEFAULT_SETTINGS.base_currency) {
    const normalized = String(value || fallback).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function normalizeDeliveryGstMode(value, fallback = DEFAULT_SETTINGS.delivery_gst_mode) {
    const normalized = String(value || fallback).trim().toLowerCase();
    return normalized === 'exclusive' ? 'exclusive' : 'inclusive';
}

function parseSettingValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"'))
            || (trimmed.startsWith('{') && trimmed.endsWith('}'))
            || (trimmed.startsWith('[') && trimmed.endsWith(']'))
            || trimmed === 'true'
            || trimmed === 'false'
            || trimmed === 'null'
            || /^-?\d+(\.\d+)?$/.test(trimmed)
        ) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return value;
            }
        }

        return value;
    }

    if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
        return value.value;
    }

    return value;
}

async function getSettings(keys = Object.keys(DEFAULT_SETTINGS)) {
    const now = Date.now();
    if (settingsCache && (now - lastCacheUpdate < CACHE_TTL)) {
        return keys.reduce((acc, key) => {
            if (Object.prototype.hasOwnProperty.call(settingsCache, key)) {
                acc[key] = settingsCache[key];
            }
            return acc;
        }, {});
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('store_settings')
            .select('key, value')
            .in('key', Object.keys(DEFAULT_SETTINGS));

        if (error) throw error;

        const dbSettings = (data || []).reduce((acc, curr) => {
            acc[curr.key] = parseSettingValue(curr.value);
            return acc;
        }, {});

        settingsCache = {
            delivery_threshold: Number(dbSettings.delivery_threshold ?? DEFAULT_SETTINGS.delivery_threshold),
            delivery_charge: Number(dbSettings.delivery_charge ?? DEFAULT_SETTINGS.delivery_charge),
            delivery_gst: Number(dbSettings.delivery_gst ?? DEFAULT_SETTINGS.delivery_gst),
            delivery_gst_mode: normalizeDeliveryGstMode(dbSettings.delivery_gst_mode, DEFAULT_SETTINGS.delivery_gst_mode),
            base_currency: normalizeCurrencyCode(dbSettings.base_currency, DEFAULT_SETTINGS.base_currency)
        };

        lastCacheUpdate = now;

        return keys.reduce((acc, key) => {
            if (Object.prototype.hasOwnProperty.call(settingsCache, key)) {
                acc[key] = settingsCache[key];
            }
            return acc;
        }, {});
    } catch (error) {
        logger.error({ err: error }, 'Error fetching store settings:');
        return keys.reduce((acc, key) => {
            if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
                acc[key] = DEFAULT_SETTINGS[key];
            }
            return acc;
        }, {});
    }
}

function clearSettingsCache() {
    settingsCache = null;
    lastCacheUpdate = 0;

    try {
        const { DeliveryChargeService } = require('./delivery-charge.service');
        DeliveryChargeService.invalidateCaches();
    } catch (error) {
        logger.warn({ err: error }, 'Failed to invalidate delivery charge caches after settings update');
    }
}

async function getDeliverySettings() {
    const settings = await getSettings(['delivery_threshold', 'delivery_charge', 'delivery_gst', 'delivery_gst_mode']);
    return {
        delivery_threshold: Number(settings.delivery_threshold ?? DEFAULT_SETTINGS.delivery_threshold),
        delivery_charge: Number(settings.delivery_charge ?? DEFAULT_SETTINGS.delivery_charge),
        delivery_gst: Number(settings.delivery_gst ?? DEFAULT_SETTINGS.delivery_gst),
        delivery_gst_mode: normalizeDeliveryGstMode(settings.delivery_gst_mode, DEFAULT_SETTINGS.delivery_gst_mode)
    };
}

async function ensureStoreSettingRows(keys = Object.keys(DEFAULT_SETTINGS)) {
    const rows = keys
        .filter((key) => Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key))
        .map((key) => ({
            key,
            value: key === 'base_currency'
                ? JSON.stringify(DEFAULT_SETTINGS[key])
                : DEFAULT_SETTINGS[key],
            description: STORE_SETTING_DESCRIPTIONS[key] || null
        }));

    if (rows.length === 0) return;

    const { error } = await supabaseAdmin
        .from('store_settings')
        .upsert(rows, { onConflict: 'key', ignoreDuplicates: true });

    if (error) {
        error.message = `Failed to ensure store_settings defaults. ${error.message}. Verify the store_settings repair migration has run and SUPABASE_SERVICE_ROLE_KEY is configured on the backend.`;
        throw error;
    }
}

async function updateDeliverySettings(settings) {
    try {
        const { threshold, charge, gst, gst_mode } = settings;
        await ensureStoreSettingRows(['delivery_threshold', 'delivery_charge', 'delivery_gst', 'delivery_gst_mode']);

        const writeSetting = async (key, value, description) => {
            const { data: existingRow, error: fetchError } = await supabaseAdmin
                .from('store_settings')
                .select('key')
                .eq('key', key)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existingRow) {
                const { data: updatedRows, error: updateError } = await _supabaseAdmin
                .from('store_settings')
                .update({
                    value,
                    description
                })
                .eq('key', key)
                .select('key');
                if (updateError) throw updateError;
                return;
            }

            const { error: insertError } = await _supabaseAdmin
                .from('store_settings')
                .insert({
                    key,
                    value,
                    description
                });

            if (insertError) throw insertError;
        };

        if (threshold !== undefined) {
            await writeSetting('delivery_threshold', threshold, STORE_SETTING_DESCRIPTIONS.delivery_threshold);
        }

        if (charge !== undefined) {
            await writeSetting('delivery_charge', charge, STORE_SETTING_DESCRIPTIONS.delivery_charge);
        }

        if (gst !== undefined) {
            await writeSetting('delivery_gst', gst, STORE_SETTING_DESCRIPTIONS.delivery_gst);
        }

        if (gst_mode !== undefined) {
            await writeSetting('delivery_gst_mode', normalizeDeliveryGstMode(gst_mode), STORE_SETTING_DESCRIPTIONS.delivery_gst_mode);
        }

        clearSettingsCache();
        return await getDeliverySettings();
    } catch (error) {
        logger.error({ err: error }, 'Error updating delivery settings:');
        throw error;
    }
}

async function getCurrencySettings() {
    return {
        base_currency: DEFAULT_SETTINGS.base_currency,
        supported_currencies: SUPPORTED_CURRENCIES
    };
}

async function updateCurrencySettings(settings) {
    const attemptedCurrency = normalizeCurrencyCode(settings?.base_currency, DEFAULT_SETTINGS.base_currency);
    const error = new Error(`Base currency is immutable and fixed to ${DEFAULT_SETTINGS.base_currency}. Received ${attemptedCurrency}.`);
    error.status = 403;
    throw error;
}

module.exports = {
    getSettings,
    getDeliverySettings,
    getCurrencySettings,
    clearSettingsCache,
    updateDeliverySettings,
    updateCurrencySettings,
    normalizeCurrencyCode,
    normalizeDeliveryGstMode,
    SUPPORTED_CURRENCIES
};
