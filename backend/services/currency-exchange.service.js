const { supabase, _supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { normalizeCurrencyCode } = require('./settings.service');
const systemSwitches = require('./system-switches.service');

const RATE_CACHE_TTL = 24 * 60 * 60 * 1000;
const STALE_WHILE_REVALIDATE_MS = 6 * 60 * 60 * 1000;
const ratesCache = new Map();
const MAX_RATES_CACHE_SIZE = 200;

// Background GC sweep
const _currencySweep = setInterval(() => {
    const now = Date.now();
    for (const [key, ent] of ratesCache.entries()) {
        if (ent.expiresAt <= now) ratesCache.delete(key);
    }
}, 60_000);
if (_currencySweep.unref) _currencySweep.unref();

const providerCooldowns = new Map();
const PROVIDER_COOLDOWN_MS = 15 * 60 * 1000;
const backgroundRefreshes = new Map();
const inFlightRateFetches = new Map();
const CURRENCY_API_TIMEOUT_MS = parseInt(process.env.CURRENCY_API_TIMEOUT_MS || process.env.THIRD_PARTY_API_TIMEOUT || '10000', 10);

const PROVIDERS = [
    {
        name: 'currencyapi.net',
        key: () => process.env.CURRENCYAPI_NET_KEY || process.env.CURRENCYAPI_KEY || null
    },
    {
        name: 'freecurrencyapi',
        key: () => process.env.FREECURRENCYAPI_KEY || null
    },
    {
        name: 'exchangerate-api',
        key: () => process.env.EXCHANGERATE_API_KEY || process.env.EXCHANGE_RATE_API_KEY || null
    }
];

async function getProviderOrder() {
    const configuredPrimary = String(await systemSwitches.getSwitch('CURRENCY_PRIMARY_PROVIDER', ''))
        .trim()
        .toLowerCase();

    if (!configuredPrimary) {
        return PROVIDERS;
    }

    const normalizedConfigured = configuredPrimary === 'exchangerate-api'
        ? 'exchangerate-api'
        : configuredPrimary === 'freecurrencyapi'
            ? 'freecurrencyapi'
            : configuredPrimary === 'currencyapi.net' || configuredPrimary === 'currencyapi'
                ? 'currencyapi.net'
                : null;

    if (!normalizedConfigured) {
        logger.warn({ configuredPrimary }, 'Unknown CURRENCY_PRIMARY_PROVIDER value, using default provider order');
        return PROVIDERS;
    }

    const preferred = PROVIDERS.find((provider) => provider.name === normalizedConfigured);
    const remaining = PROVIDERS.filter((provider) => provider.name !== normalizedConfigured);
    return preferred ? [preferred, ...remaining] : PROVIDERS;
}

function roundMoney(amount) {
    return Math.round((Number(amount) || 0) * 100) / 100;
}

function isProviderCoolingDown(providerName) {
    const until = providerCooldowns.get(providerName);
    return Boolean(until && until > Date.now());
}

function markProviderCoolingDown(providerName) {
    providerCooldowns.set(providerName, Date.now() + PROVIDER_COOLDOWN_MS);
}

function getCachedRates(baseCurrency) {
    const cached = ratesCache.get(baseCurrency);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        ratesCache.delete(baseCurrency);
        return null;
    }
    return cached;
}

function getStaleCachedRates(baseCurrency) {
    const cached = ratesCache.get(baseCurrency);
    if (!cached) return null;
    if (cached.expiresAt + STALE_WHILE_REVALIDATE_MS <= Date.now()) {
        ratesCache.delete(baseCurrency);
        return null;
    }
    return cached;
}

async function getPersistedRates(baseCurrency) {
    const { data, error } = await supabase
        .from('currency_rate_cache')
        .select('base_currency, provider, fetched_at, expires_at, rates')
        .eq('base_currency', baseCurrency)
        .maybeSingle();

    if (error) {
        logger.warn({ err: error, baseCurrency }, 'Failed to read persisted currency cache');
        return null;
    }

    if (!data) return null;

    if (new Date(data.expires_at).getTime() <= Date.now()) {
        return null;
    }

    const persisted = {
        provider: data.provider,
        fetched_at: data.fetched_at,
        rates: data.rates || {},
        expiresAt: new Date(data.expires_at).getTime()
    };

    if (ratesCache.size >= MAX_RATES_CACHE_SIZE) {
        ratesCache.delete(ratesCache.keys().next().value);
    }
    ratesCache.set(baseCurrency, persisted);
    return persisted;
}

async function getPersistedRatesAllowStale(baseCurrency) {
    const { data, error } = await supabase
        .from('currency_rate_cache')
        .select('base_currency, provider, fetched_at, expires_at, rates')
        .eq('base_currency', baseCurrency)
        .maybeSingle();

    if (error) {
        logger.warn({ err: error, baseCurrency }, 'Failed to read persisted currency cache');
        return null;
    }

    if (!data) return null;

    const expiresAt = new Date(data.expires_at).getTime();
    if (expiresAt + STALE_WHILE_REVALIDATE_MS <= Date.now()) {
        return null;
    }

    const persisted = {
        provider: data.provider,
        fetched_at: data.fetched_at,
        rates: data.rates || {},
        expiresAt,
        is_stale: expiresAt <= Date.now()
    };

    if (ratesCache.size >= MAX_RATES_CACHE_SIZE) {
        ratesCache.delete(ratesCache.keys().next().value);
    }
    ratesCache.set(baseCurrency, persisted);
    return persisted;
}

async function persistRates(baseCurrency, payload) {
    const expiresAt = payload.expiresAt || (Date.now() + RATE_CACHE_TTL);
    const { error } = await _supabaseAdmin
        .from('currency_rate_cache')
        .upsert({
            base_currency: baseCurrency,
            provider: payload.provider,
            fetched_at: payload.fetched_at,
            expires_at: new Date(expiresAt).toISOString(),
            rates: payload.rates
        }, { onConflict: 'base_currency' });

    if (error) {
        logger.warn({ err: error, baseCurrency }, 'Failed to persist currency cache');
    }
}

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), CURRENCY_API_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            const err = new Error(`Currency provider request failed with status ${response.status}`);
            err.status = response.status;
            err.body = data;
            throw err;
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Currency provider timed out');
            timeoutError.status = 504;
            timeoutError.code = 'ETIMEDOUT';
            throw timeoutError;
        }

        if (!error.status) {
            const networkError = new Error('Currency provider is temporarily unavailable');
            networkError.status = 502;
            networkError.code = error.code || 'UPSTREAM_NETWORK_ERROR';
            throw networkError;
        }

        throw error;
    } finally {
        clearTimeout(timeoutHandle);
    }
}

class CurrencyExchangeService {
    static async getCurrencyContext(baseCurrencyInput, displayCurrencyInput) {
        const baseCurrency = normalizeCurrencyCode(baseCurrencyInput);
        const displayCurrency = normalizeCurrencyCode(displayCurrencyInput, baseCurrency);

        if (baseCurrency === displayCurrency) {
            return {
                base_currency: baseCurrency,
                display_currency: displayCurrency,
                rate: 1,
                provider: 'base',
                fetched_at: new Date().toISOString(),
                rates: { [baseCurrency]: 1 },
                is_stale: false
            };
        }

        const rates = await this.getRates(baseCurrency);
        const normalizedRates = this.buildSupportedRatesMap(baseCurrency, rates.rates);

        const rate = Number(normalizedRates[displayCurrency]);

        if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error(`No exchange rate available for ${baseCurrency} -> ${displayCurrency}`);
        }

        return {
            base_currency: baseCurrency,
            display_currency: displayCurrency,
            rate,
            provider: rates.provider,
            fetched_at: rates.fetched_at,
            rates: normalizedRates,
            is_stale: Boolean(rates.is_stale)
        };
    }

    static convertAmount(amount, rate) {
        return roundMoney((Number(amount) || 0) * (Number(rate) || 1));
    }

    static async getRates(baseCurrencyInput) {
        const baseCurrency = normalizeCurrencyCode(baseCurrencyInput);
        const cached = getCachedRates(baseCurrency);
        if (cached) return cached;

        const persisted = await getPersistedRates(baseCurrency);
        if (persisted) return persisted;

        const staleCached = getStaleCachedRates(baseCurrency);
        if (staleCached) {
            staleCached.is_stale = true;
            this.refreshRatesInBackground(baseCurrency);
            return staleCached;
        }

        const stalePersisted = await getPersistedRatesAllowStale(baseCurrency);
        if (stalePersisted) {
            this.refreshRatesInBackground(baseCurrency);
            return stalePersisted;
        }

        if (inFlightRateFetches.has(baseCurrency)) {
            return inFlightRateFetches.get(baseCurrency);
        }

        const fetchPromise = this.fetchFreshRates(baseCurrency)
            .finally(() => {
                inFlightRateFetches.delete(baseCurrency);
            });

        inFlightRateFetches.set(baseCurrency, fetchPromise);

        return fetchPromise;
    }

    static async fetchFreshRates(baseCurrency) {
        const order = await getProviderOrder();
        const availableProviders = order.filter((provider) => provider.key() && !isProviderCoolingDown(provider.name));
        let lastError = null;

        for (const provider of availableProviders) {
            try {
                const result = await this.fetchRatesFromProvider(provider.name, provider.key(), baseCurrency);
                const payload = {
                    ...result,
                    expiresAt: Date.now() + RATE_CACHE_TTL,
                    is_stale: false
                };
                ratesCache.set(baseCurrency, payload);
                await persistRates(baseCurrency, payload);
                return payload;
            } catch (error) {
                lastError = error;
                const quotaReached = error.status === 429
                    || error.body?.message === 'You have exceeded your monthly quota'
                    || error.body?.error?.code === 'quota_reached'
                    || error.body?.['error-type'] === 'quota-reached'
                    || error.body?.error?.type === 'quota_reached';

                if (quotaReached) {
                    markProviderCoolingDown(provider.name);
                }

                logger.warn({
                    provider: provider.name,
                    status: error.status,
                    body: error.body
                }, 'Currency provider failed, trying next provider');
            }
        }

        if (lastError) {
            throw lastError;
        }

        const error = new Error('No currency exchange provider is configured');
        error.status = 503;
        throw error;
    }

    static refreshRatesInBackground(baseCurrency) {
        if (backgroundRefreshes.has(baseCurrency)) {
            return backgroundRefreshes.get(baseCurrency);
        }

        const refreshPromise = this.fetchFreshRates(baseCurrency)
            .catch((error) => {
                logger.warn({ err: error, baseCurrency }, 'Background currency refresh failed');
                return null;
            })
            .finally(() => {
                backgroundRefreshes.delete(baseCurrency);
            });

        backgroundRefreshes.set(baseCurrency, refreshPromise);
        return refreshPromise;
    }

    static buildSupportedRatesMap(baseCurrency, rates = {}) {
        const normalized = { [baseCurrency]: 1 };

        for (const [currency, value] of Object.entries(rates)) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) {
                normalized[String(currency).toUpperCase()] = numeric;
            }
        }

        return normalized;
    }

    static async fetchRatesFromProvider(providerName, apiKey, baseCurrency) {
        if (providerName === 'currencyapi.net') {
            return this.fetchFromCurrencyApiNet(apiKey, baseCurrency);
        }

        if (providerName === 'freecurrencyapi') {
            return this.fetchFromFreeCurrencyApi(apiKey, baseCurrency);
        }

        if (providerName === 'exchangerate-api') {
            return this.fetchFromExchangeRateApi(apiKey, baseCurrency);
        }

        throw new Error(`Unsupported currency provider ${providerName}`);
    }

    static async fetchFromCurrencyApiNet(apiKey, baseCurrency) {
        try {
            const direct = await fetchJson(`https://currencyapi.net/api/v1/rates?key=${encodeURIComponent(apiKey)}&base=${encodeURIComponent(baseCurrency)}`);
            return {
                provider: 'currencyapi.net',
                fetched_at: direct.updated ? new Date(direct.updated).toISOString() : new Date().toISOString(),
                rates: direct.rates || {}
            };
        } catch (error) {
            const fallbackBase = 'USD';
            const fallback = await fetchJson(`https://currencyapi.net/api/v1/rates?key=${encodeURIComponent(apiKey)}&base=${fallbackBase}`);
            const fallbackRates = fallback.rates || {};
            const baseRate = Number(fallbackRates[baseCurrency]);

            if (!Number.isFinite(baseRate) || baseRate <= 0) {
                throw error;
            }

            const normalizedRates = Object.entries(fallbackRates).reduce((acc, [currency, value]) => {
                acc[currency] = Number(value) / baseRate;
                return acc;
            }, { [baseCurrency]: 1 });

            return {
                provider: 'currencyapi.net',
                fetched_at: fallback.updated ? new Date(fallback.updated).toISOString() : new Date().toISOString(),
                rates: normalizedRates
            };
        }
    }

    static async fetchFromFreeCurrencyApi(apiKey, baseCurrency) {
        const data = await fetchJson(`https://api.freecurrencyapi.com/v1/latest?base_currency=${encodeURIComponent(baseCurrency)}`, {
            headers: { apikey: apiKey }
        });

        return {
            provider: 'freecurrencyapi',
            fetched_at: data.meta?.last_updated_at || new Date().toISOString(),
            rates: data.data || {}
        };
    }

    static async fetchFromExchangeRateApi(apiKey, baseCurrency) {
        const data = await fetchJson(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/${encodeURIComponent(baseCurrency)}`);

        if (data.result !== 'success') {
            const error = new Error(`ExchangeRate-API returned ${data.result}`);
            error.status = 400;
            error.body = data;
            throw error;
        }

        return {
            provider: 'exchangerate-api',
            fetched_at: data.time_last_update_utc || new Date().toISOString(),
            rates: data.conversion_rates || {}
        };
    }
}

module.exports = {
    CurrencyExchangeService
};
