const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

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
    base_currency: 'INR'
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
    const settings = await getSettings(['delivery_threshold', 'delivery_charge', 'delivery_gst']);
    return {
        delivery_threshold: Number(settings.delivery_threshold ?? DEFAULT_SETTINGS.delivery_threshold),
        delivery_charge: Number(settings.delivery_charge ?? DEFAULT_SETTINGS.delivery_charge),
        delivery_gst: Number(settings.delivery_gst ?? DEFAULT_SETTINGS.delivery_gst)
    };
}

async function updateDeliverySettings(settings) {
    try {
        const { threshold, charge, gst } = settings;
        const writeSetting = async (key, value, description) => {
            const { data: updatedRows, error: updateError } = await supabaseAdmin
                .from('store_settings')
                .update({
                    value,
                    description
                })
                .eq('key', key)
                .select('key');

            if (updateError) throw updateError;

            if (!updatedRows || updatedRows.length === 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('store_settings')
                    .insert({
                        key,
                        value,
                        description
                    });

                if (insertError) throw insertError;
            }
        };

        if (threshold !== undefined) {
            await writeSetting('delivery_threshold', threshold, 'Minimum order amount for free delivery');
        }

        if (charge !== undefined) {
            await writeSetting('delivery_charge', charge, 'Standard delivery charge for orders below threshold');
        }

        if (gst !== undefined) {
            await writeSetting('delivery_gst', gst, 'Standard GST rate for delivery charges');
        }

        clearSettingsCache();
        return await getDeliverySettings();
    } catch (error) {
        logger.error({ err: error }, 'Error updating delivery settings:');
        throw error;
    }
}

async function getCurrencySettings() {
    const settings = await getSettings(['base_currency']);
    return {
        base_currency: normalizeCurrencyCode(settings.base_currency, DEFAULT_SETTINGS.base_currency),
        supported_currencies: SUPPORTED_CURRENCIES
    };
}

async function updateCurrencySettings(settings) {
    try {
        const baseCurrency = normalizeCurrencyCode(settings.base_currency);
        const description = 'Default display currency for the storefront';

        const { data: updatedRows, error: updateError } = await supabaseAdmin
            .from('store_settings')
            .update({
                value: JSON.stringify(baseCurrency),
                description
            })
            .eq('key', 'base_currency')
            .select('key');

        if (updateError) throw updateError;

        if (!updatedRows || updatedRows.length === 0) {
            const { error: insertError } = await supabaseAdmin
                .from('store_settings')
                .insert({
                    key: 'base_currency',
                    value: JSON.stringify(baseCurrency),
                    description
                });

            if (insertError) {
                insertError.message = `Failed to save base currency setting. ${insertError.message}`;
                throw insertError;
            }
        }

        clearSettingsCache();
        return getCurrencySettings();
    } catch (error) {
        logger.error({ err: error }, 'Error updating currency settings:');
        throw error;
    }
}

module.exports = {
    getSettings,
    getDeliverySettings,
    getCurrencySettings,
    clearSettingsCache,
    updateDeliverySettings,
    updateCurrencySettings,
    normalizeCurrencyCode,
    SUPPORTED_CURRENCIES
};
