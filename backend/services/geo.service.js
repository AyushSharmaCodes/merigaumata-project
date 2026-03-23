const axios = require('axios');
const logger = require('../utils/logger');

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
        try {
            // 1. Fetch dialing codes from RestCountries (for clean codes)
            const rcResponse = await axios.get(`${this.restCountriesUrl}/all?fields=cca2,idd`);
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
                headers: { 'X-CSCAPI-KEY': this.cscApiKey }
            });

            if (cscResponse.data && Array.isArray(cscResponse.data)) {
                return cscResponse.data.map(c => ({
                    country: c.name,
                    iso2: c.iso2,
                    phone_code: dialingCodeMap[c.iso2] || (c.phonecode ? `+${c.phonecode}` : '')
                })).sort((a, b) => a.country.localeCompare(b.country));
            }

            return [];
        } catch (error) {
            logger.error({ err: error.message }, 'GeoService: getCountries failed');
            throw error;
        }
    }

    /**
     * Fetch states for a given country
     */
    async getStates(countryIso2) {
        try {
            const response = await axios.get(`${this.cscUrl}/countries/${countryIso2}/states`, {
                headers: { 'X-CSCAPI-KEY': this.cscApiKey }
            });

            if (response.data && Array.isArray(response.data)) {
                return response.data.map(s => ({
                    name: s.name,
                    state_code: s.iso2
                }));
            }

            return [];
        } catch (error) {
            logger.error({ err: error.message, countryIso2 }, 'GeoService: getStates failed');
            throw error;
        }
    }

    /**
     * Validate pincode and return location data
     */
    async validatePostalCode(countryIso2, postalCode) {
        try {
            // For India, use India Post API as primary
            if (countryIso2 === 'IN') {
                try {
                    const response = await axios.get(`${this.postalPincodeUrl}/pincode/${postalCode}`);
                    if (response.data && response.data[0].Status === 'Success' && response.data[0].PostOffice.length > 0) {
                        return { valid: true, data: response.data };
                    }
                } catch (e) {
                    logger.warn({ err: e.message, postalCode }, 'GeoService: India Post API failed');
                }
            }

            // Fallback/General lookup via Zippopotam
            try {
                const zippoUrl = process.env.GEO_ZIPPOPOTAM_API || 'https://api.zippopotam.us';
                const response = await axios.get(`${zippoUrl}/${countryIso2}/${postalCode}`);
                if (response.data && response.data.places && response.data.places.length > 0) {
                    return { valid: true, data: response.data };
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
                        postalcode: postalCode,
                        country: countryIso2,
                        username: geonamesUser
                    }
                });
                if (response.data && response.data.postalcodes && response.data.postalcodes.length > 0) {
                    return { valid: true, data: response.data };
                }
            } catch (e) {
                // Continue
            }

            return { valid: false };
        } catch (error) {
            logger.error({ err: error.message, countryIso2, postalCode }, 'GeoService: validatePostalCode failed');
            throw error;
        }
    }
}

module.exports = new GeoService();
