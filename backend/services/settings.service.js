const { supabaseAdmin, _supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const realtimeService = require('./realtime.service');

/**
 * Settings Service
 * Handles fetching and managing store configuration from the database
 */

// Cache for settings to avoid redundant DB calls on every cart calculation
let settingsCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds cache is enough for a single request flow

const DEFAULT_SETTINGS = {
    delivery_threshold: 1500,
    delivery_charge: 50,
    delivery_gst: 0,
    delivery_gst_mode: 'inclusive',
    base_currency: 'INR',
    return_logistics_flat_fee: 100,
    is_maintenance_mode: false,
    maintenance_bypass_ips: ''
};

const STORE_SETTING_DESCRIPTIONS = {
    delivery_threshold: 'Minimum order amount for free delivery',
    delivery_charge: 'Standard delivery charge for orders below threshold',
    delivery_gst: 'Standard GST rate for delivery charges',
    delivery_gst_mode: 'How delivery GST should be applied: inclusive or exclusive',
    base_currency: 'Default display currency for the storefront',
    return_logistics_flat_fee: 'Flat fee charged per return order for reverse logistics processing',
    is_maintenance_mode: 'Global flag to force the network interceptor to return 503 Maintenance Mode without redeploying',
    maintenance_bypass_ips: 'Comma separated list of Admin IPs allowed to bypass the dynamic maintenance mode'
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
            base_currency: normalizeCurrencyCode(dbSettings.base_currency, DEFAULT_SETTINGS.base_currency),
            return_logistics_flat_fee: Number(dbSettings.return_logistics_flat_fee ?? DEFAULT_SETTINGS.return_logistics_flat_fee),
            is_maintenance_mode: Boolean(dbSettings.is_maintenance_mode ?? DEFAULT_SETTINGS.is_maintenance_mode),
            maintenance_bypass_ips: String(dbSettings.maintenance_bypass_ips ?? DEFAULT_SETTINGS.maintenance_bypass_ips)
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
    const settings = await getSettings(['delivery_threshold', 'delivery_charge', 'delivery_gst', 'delivery_gst_mode', 'return_logistics_flat_fee']);
    return {
        delivery_threshold: Number(settings.delivery_threshold ?? DEFAULT_SETTINGS.delivery_threshold),
        delivery_charge: Number(settings.delivery_charge ?? DEFAULT_SETTINGS.delivery_charge),
        delivery_gst: Number(settings.delivery_gst ?? DEFAULT_SETTINGS.delivery_gst),
        delivery_gst_mode: normalizeDeliveryGstMode(settings.delivery_gst_mode, DEFAULT_SETTINGS.delivery_gst_mode),
        return_logistics_flat_fee: Number(settings.return_logistics_flat_fee ?? DEFAULT_SETTINGS.return_logistics_flat_fee)
    };
}

async function getMaintenanceSettings() {
    // Returns cached version directly - minimal latency
    const settings = await getSettings(['is_maintenance_mode', 'maintenance_bypass_ips']);
    return {
        is_maintenance_mode: Boolean(settings.is_maintenance_mode ?? false),
        maintenance_bypass_ips: String(settings.maintenance_bypass_ips ?? '')
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
        const updatedSettings = await getDeliverySettings();
        realtimeService.publish({
            topic: 'store_settings',
            type: 'settings.updated',
            payload: {
                keys: ['delivery_threshold', 'delivery_charge', 'delivery_gst', 'delivery_gst_mode'],
                settings: updatedSettings
            }
        });
        return updatedSettings;
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

async function updateMaintenanceSettings(settings) {
    try {
        const { is_maintenance_mode, maintenance_bypass_ips } = settings;
        await ensureStoreSettingRows(['is_maintenance_mode', 'maintenance_bypass_ips']);

        const writeSetting = async (key, value, description) => {
            const { data: existingRow, error: fetchError } = await supabaseAdmin
                .from('store_settings')
                .select('key')
                .eq('key', key)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existingRow) {
                const { error: updateError } = await _supabaseAdmin
                    .from('store_settings')
                    .update({
                        value,
                        description
                    })
                    .eq('key', key);
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

        if (is_maintenance_mode !== undefined) {
            await writeSetting('is_maintenance_mode', Boolean(is_maintenance_mode), STORE_SETTING_DESCRIPTIONS.is_maintenance_mode);
        }

        if (maintenance_bypass_ips !== undefined) {
            await writeSetting('maintenance_bypass_ips', String(maintenance_bypass_ips), STORE_SETTING_DESCRIPTIONS.maintenance_bypass_ips);
        }

        clearSettingsCache();
        const updatedSettings = await getMaintenanceSettings();
        realtimeService.publish({
            topic: 'store_settings',
            type: 'settings.updated',
            payload: {
                keys: ['is_maintenance_mode', 'maintenance_bypass_ips'],
                settings: updatedSettings
            }
        });
        return updatedSettings;
    } catch (error) {
        logger.error({ err: error }, 'Error updating maintenance settings:');
        throw error;
    }
}

module.exports = {
    getSettings,
    getDeliverySettings,
    getCurrencySettings,
    getMaintenanceSettings,
    clearSettingsCache,
    updateDeliverySettings,
    updateCurrencySettings,
    updateMaintenanceSettings,
    normalizeCurrencyCode,
    normalizeDeliveryGstMode,
    SUPPORTED_CURRENCIES
};
