const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Settings Service
 * Handles fetching and managing store configuration from the database
 */

// Cache for settings to avoid redundant DB calls on every cart calculation
let settingsCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds cache is enough for a single request flow

function clearSettingsCache() {
    settingsCache = null;
    lastCacheUpdate = 0;
}

async function getDeliverySettings() {
    // Check cache
    const now = Date.now();
    if (settingsCache && (now - lastCacheUpdate < CACHE_TTL)) {
        return settingsCache;
    }

    try {
        const { data, error } = await supabase
            .from('store_settings')
            .select('key, value')
            .in('key', ['delivery_threshold', 'delivery_charge', 'delivery_gst']);

        if (error) throw error;

        const settings = data.reduce((acc, curr) => {
            acc[curr.key] = Number(curr.value);
            return acc;
        }, {});

        // Defaults if missing in DB
        const result = {
            delivery_threshold: settings.delivery_threshold ?? 1500,
            delivery_charge: settings.delivery_charge ?? 50,
            delivery_gst: settings.delivery_gst ?? 18 // Default to 18% GST if not set, matching system defaults
        };

        // Update cache
        settingsCache = result;
        lastCacheUpdate = now;

        return result;
    } catch (error) {
        logger.error({ err: error }, 'Error fetching delivery settings:');
        return { delivery_threshold: 1500, delivery_charge: 50, delivery_gst: 0 }; // Fallback to hardcoded defaults
    }
}

async function updateDeliverySettings(settings) {
    try {
        const { threshold, charge, gst } = settings;
        const updates = [];

        if (threshold !== undefined) {
            updates.push(
                supabase
                    .from('store_settings')
                    .upsert({
                        key: 'delivery_threshold',
                        value: threshold.toString(),
                        description: 'Minimum order amount for free delivery'
                    }, { onConflict: 'key' })
            );
        }

        if (charge !== undefined) {
            updates.push(
                supabase
                    .from('store_settings')
                    .upsert({
                        key: 'delivery_charge',
                        value: charge.toString(),
                        description: 'Standard delivery charge for orders below threshold'
                    }, { onConflict: 'key' })
            );
        }

        if (gst !== undefined) {
            updates.push(
                supabase
                    .from('store_settings')
                    .upsert({
                        key: 'delivery_gst',
                        value: gst.toString(),
                        description: 'Standard GST rate for delivery charges'
                    }, { onConflict: 'key' })
            );
        }

        const results = await Promise.all(updates);
        for (const res of results) {
            if (res.error) throw res.error;
        }

        return await getDeliverySettings();
    } catch (error) {
        logger.error({ err: error }, 'Error updating delivery settings:');
        throw error;
    }
}

module.exports = {
    getDeliverySettings,
    clearSettingsCache,
    updateDeliverySettings
};
