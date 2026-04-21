const { supabase, _supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { normalizeCurrencyCode, getCurrencySettings } = require('./settings.service');
const systemSwitches = require('./system-switches.service');

const ratesCache = new Map();
const MAX_RATES_CACHE_SIZE = 200;
const SCHEDULE_TIMEZONE = 'Asia/Kolkata';
const DAILY_REFRESH_HOUR_IST = 10;

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
        return {
            ...cached,
            is_stale: true
        };
    }
    return cached;
}

function setCachedRates(baseCurrency, payload) {
    if (ratesCache.size >= MAX_RATES_CACHE_SIZE && !ratesCache.has(baseCurrency)) {
        ratesCache.delete(ratesCache.keys().next().value);
    }
    ratesCache.set(baseCurrency, payload);
}

function computeNextDailyRefreshExpiry(input = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: SCHEDULE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(input).reduce((acc, part) => {
        if (part.type !== 'literal') {
            acc[part.type] = part.value;
        }
        return acc;
    }, {});

    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const nextDay = new Date(Date.UTC(year, month - 1, day + (hour >= DAILY_REFRESH_HOUR_IST ? 1 : 0), 4, 30, 0));
    return nextDay.getTime();
}

async function getPersistedRates(baseCurrency, { allowExpired = false } = {}) {
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

    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;

    if (!allowExpired && expiresAt <= Date.now()) {
        return null;
    }

    const persisted = {
        provider: data.provider,
        fetched_at: data.fetched_at,
        rates: data.rates || {},
        expiresAt,
        is_stale: expiresAt <= Date.now()
    };

    setCachedRates(baseCurrency, persisted);
    return persisted;
}

async function persistRates(baseCurrency, payload) {
    const expiresAt = payload.expiresAt || computeNextDailyRefreshExpiry(new Date(payload.fetched_at || Date.now()));
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

        const persisted = await getPersistedRates(baseCurrency, { allowExpired: true });
        if (persisted) return persisted;

        const error = new Error(`Currency snapshot unavailable for ${baseCurrency}`);
        error.status = 503;
        error.code = 'CURRENCY_SNAPSHOT_UNAVAILABLE';
        throw error;
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
                    expiresAt: computeNextDailyRefreshExpiry(new Date(result.fetched_at || Date.now())),
                    is_stale: false
                };
                setCachedRates(baseCurrency, payload);
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

    static async refreshDailySnapshot(baseCurrencyInput, options = {}) {
        const baseCurrency = normalizeCurrencyCode(baseCurrencyInput);
        const force = options.force === true;

        if (!force) {
            const existing = await getPersistedRates(baseCurrency, { allowExpired: true });
            if (existing && existing.expiresAt > Date.now()) {
                return existing;
            }
        }

        if (inFlightRateFetches.has(baseCurrency)) {
            return inFlightRateFetches.get(baseCurrency);
        }

        const refreshPromise = this.fetchFreshRates(baseCurrency)
            .finally(() => {
                inFlightRateFetches.delete(baseCurrency);
            });

        inFlightRateFetches.set(baseCurrency, refreshPromise);
        return refreshPromise;
    }

    static async refreshConfiguredCurrencies(options = {}) {
        const settings = await getCurrencySettings();
        const baseCurrencies = Array.from(new Set([
            'INR',
            normalizeCurrencyCode(settings?.base_currency, 'INR')
        ]));

        const results = [];
        for (const baseCurrency of baseCurrencies) {
            const snapshot = await this.refreshDailySnapshot(baseCurrency, options);
            results.push({
                base_currency: baseCurrency,
                provider: snapshot.provider,
                fetched_at: snapshot.fetched_at,
                is_stale: Boolean(snapshot.is_stale)
            });
        }

        return results;
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
