const axios = require('axios');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const COUNTRIES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const STATES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const POSTAL_CACHE_TTL = 24 * 60 * 60 * 1000;
const GEO_API_TIMEOUT_MS = parseInt(process.env.GEO_API_TIMEOUT_MS || process.env.THIRD_PARTY_API_TIMEOUT || '8000', 10);
const geoCache = new Map();

function getMemoryCache(cacheKey) {
    const cached = geoCache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        geoCache.delete(cacheKey);
        return null;
    }

    return cached;
}

async function getPersistedCache(cacheKey) {
    const { data, error } = await supabase
        .from('geo_cache')
        .select('cache_key, cache_type, provider, fetched_at, expires_at, payload')
        .eq('cache_key', cacheKey)
        .maybeSingle();

    if (error) {
        logger.warn({ err: error, cacheKey }, 'GeoService: failed to read persisted geo cache');
        return null;
    }

    if (!data) return null;

    if (new Date(data.expires_at).getTime() <= Date.now()) {
        return null;
    }

    const persisted = {
        cacheType: data.cache_type,
        provider: data.provider,
        fetchedAt: data.fetched_at,
        payload: data.payload,
        expiresAt: new Date(data.expires_at).getTime()
    };

    geoCache.set(cacheKey, persisted);
    return persisted;
}

async function getLastKnownCache(cacheKey) {
    const memoryCached = geoCache.get(cacheKey);
    if (memoryCached?.payload) {
        return memoryCached;
    }

    const { data, error } = await supabase
        .from('geo_cache')
        .select('cache_key, cache_type, provider, fetched_at, expires_at, payload')
        .eq('cache_key', cacheKey)
        .maybeSingle();

    if (error || !data?.payload) {
        return null;
    }

    return {
        cacheType: data.cache_type,
        provider: data.provider,
        fetchedAt: data.fetched_at,
        payload: data.payload,
        expiresAt: new Date(data.expires_at).getTime()
    };
}

async function persistCache(cacheKey, cacheType, payload, provider, ttlMs) {
    const expiresAt = Date.now() + ttlMs;
    const cacheEntry = {
        cacheType,
        provider,
        fetchedAt: new Date().toISOString(),
        payload,
        expiresAt
    };

    geoCache.set(cacheKey, cacheEntry);

    const { error } = await supabase
        .from('geo_cache')
        .upsert({
            cache_key: cacheKey,
            cache_type: cacheType,
            provider,
            fetched_at: cacheEntry.fetchedAt,
            expires_at: new Date(expiresAt).toISOString(),
            payload
        }, { onConflict: 'cache_key' });

    if (error) {
        logger.warn({ err: error, cacheKey, cacheType }, 'GeoService: failed to persist geo cache');
    }

    return cacheEntry;
}

async function getCachedOrFetch(cacheKey, cacheType, ttlMs, fetcher) {
    const memoryCached = getMemoryCache(cacheKey);
    if (memoryCached) {
        return memoryCached.payload;
    }

    const persisted = await getPersistedCache(cacheKey);
    if (persisted) {
        return persisted.payload;
    }

    try {
        const fetched = await fetcher();
        await persistCache(cacheKey, cacheType, fetched.payload, fetched.provider, ttlMs);
        return fetched.payload;
    } catch (error) {
        const stale = await getLastKnownCache(cacheKey);
        if (stale?.payload) {
            logger.warn({ cacheKey, cacheType, provider: stale.provider }, 'GeoService: upstream failed, serving last known cache');
            return stale.payload;
        }

        if (!error.status) {
            error.status = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ? 504 : 502;
        }

        throw error;
    }
}

class GeoService {
    constructor() {
        this.cscUrl = process.env.CSC_API_URL || 'https://api.countrystatecity.in/v1';
        this.cscApiKey = process.env.CSC_API_KEY;
        this.postalPincodeUrl = process.env.GEO_POSTAL_PINCODE_API || 'https://api.postalpincode.in';
        this.restCountriesUrl = 'https://restcountries.com/v3.1';
    }

    /**
     * Fetch countries with their phone codes
     */
    async getCountries() {
        return getCachedOrFetch('countries:all', 'countries', COUNTRIES_CACHE_TTL, async () => {
            try {
                // 1. Fetch dialing codes from RestCountries (for clean codes)
                const rcResponse = await axios.get(`${this.restCountriesUrl}/all?fields=cca2,idd`, {
                    timeout: GEO_API_TIMEOUT_MS
                });
                const dialingCodeMap = {};

                if (rcResponse.data && Array.isArray(rcResponse.data)) {
                    rcResponse.data.forEach((c) => {
                        if (c.idd?.root) {
                            const root = c.idd.root;
                            const suffixes = c.idd.suffixes || [];
                            if (suffixes.length === 1) {
                                dialingCodeMap[c.cca2] = root + suffixes[0];
                            } else {
                                dialingCodeMap[c.cca2] = root;
                            }
                        }
                    });
                }

                // 2. Fetch countries from CSC API
                const cscResponse = await axios.get(`${this.cscUrl}/countries`, {
                    headers: { 'X-CSCAPI-KEY': this.cscApiKey },
                    timeout: GEO_API_TIMEOUT_MS
                });

                if (cscResponse.data && Array.isArray(cscResponse.data)) {
                    return {
                        provider: 'csc+restcountries',
                        payload: cscResponse.data.map(c => ({
                            country: c.name,
                            iso2: c.iso2,
                            phone_code: dialingCodeMap[c.iso2] || (c.phonecode ? `+${c.phonecode}` : '')
                        })).sort((a, b) => a.country.localeCompare(b.country))
                    };
                }

                return {
                    provider: 'csc+restcountries',
                    payload: []
                };
            } catch (error) {
                logger.error({ err: error.message }, 'GeoService: getCountries failed');
                throw error;
            }
        });
    }

    /**
     * Fetch states for a given country
     */
    async getStates(countryIso2) {
        const normalizedCountryIso2 = String(countryIso2 || '').toUpperCase();
        const cacheKey = `states:${normalizedCountryIso2}`;

        return getCachedOrFetch(cacheKey, 'states', STATES_CACHE_TTL, async () => {
            try {
                const response = await axios.get(`${this.cscUrl}/countries/${normalizedCountryIso2}/states`, {
                    headers: { 'X-CSCAPI-KEY': this.cscApiKey },
                    timeout: GEO_API_TIMEOUT_MS
                });

                if (response.data && Array.isArray(response.data)) {
                    return {
                        provider: 'csc',
                        payload: response.data.map(s => ({
                            name: s.name,
                            state_code: s.iso2
                        }))
                    };
                }

                return {
                    provider: 'csc',
                    payload: []
                };
            } catch (error) {
                logger.error({ err: error.message, countryIso2: normalizedCountryIso2 }, 'GeoService: getStates failed');
                throw error;
            }
        });
    }

    /**
     * Validate pincode and return location data
     */
    async validatePostalCode(countryIso2, postalCode) {
        const normalizedCountryIso2 = String(countryIso2 || '').toUpperCase();
        const normalizedPostalCode = String(postalCode || '').trim();
        const cacheKey = `postal:${normalizedCountryIso2}:${normalizedPostalCode}`;

        return getCachedOrFetch(cacheKey, 'postal', POSTAL_CACHE_TTL, async () => {
            try {
                // For India, use India Post API as primary
                if (normalizedCountryIso2 === 'IN') {
                    try {
                        const response = await axios.get(`${this.postalPincodeUrl}/pincode/${normalizedPostalCode}`, {
                            timeout: GEO_API_TIMEOUT_MS
                        });
                        if (response.data && response.data[0].Status === 'Success' && response.data[0].PostOffice.length > 0) {
                            return {
                                provider: 'india-post',
                                payload: { valid: true, data: response.data }
                            };
                        }
                    } catch (e) {
                        logger.warn({ err: e.message, postalCode: normalizedPostalCode }, 'GeoService: India Post API failed');
                    }
                }

                // Fallback/General lookup via Zippopotam
                try {
                    const zippoUrl = process.env.GEO_ZIPPOPOTAM_API || 'https://api.zippopotam.us';
                    const response = await axios.get(`${zippoUrl}/${normalizedCountryIso2}/${normalizedPostalCode}`, {
                        timeout: GEO_API_TIMEOUT_MS
                    });
                    if (response.data && response.data.places && response.data.places.length > 0) {
                        return {
                            provider: 'zippopotam',
                            payload: { valid: true, data: response.data }
                        };
                    }
                } catch (e) {
                    // Continue
                }

                // General lookup via GeoNames
                try {
                    const geonamesUrl = process.env.GEO_GEONAMES_API || 'https://secure.geonames.org';
                    const geonamesUser = process.env.GEONAMES_USERNAME || 'demo';
                    const response = await axios.get(`${geonamesUrl}/postalCodeLookupJSON`, {
                        params: {
                            postalcode: normalizedPostalCode,
                            country: normalizedCountryIso2,
                            username: geonamesUser
                        },
                        timeout: GEO_API_TIMEOUT_MS
                    });
                    if (response.data && response.data.postalcodes && response.data.postalcodes.length > 0) {
                        return {
                            provider: 'geonames',
                            payload: { valid: true, data: response.data }
                        };
                    }
                } catch (e) {
                    // Continue
                }

                return {
                    provider: 'not-found',
                    payload: { valid: false }
                };
            } catch (error) {
                logger.error({ err: error.message, countryIso2: normalizedCountryIso2, postalCode: normalizedPostalCode }, 'GeoService: validatePostalCode failed');
                throw error;
            }
        });
    }
}

module.exports = new GeoService();
