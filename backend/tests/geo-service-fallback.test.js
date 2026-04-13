jest.mock('axios');
jest.mock('../lib/supabase', () => ({
    from: jest.fn()
}));

describe('GeoService upstream failure fallback', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            GEO_API_TIMEOUT_MS: '10'
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    function buildGeoCacheQuery(responses) {
        let callIndex = 0;
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(responses[Math.min(callIndex++, responses.length - 1)]))
        };
    }

    test('serves last known cache when country providers fail', async () => {
        const axios = require('axios');
        const supabase = require('../lib/supabase');
        const expiredCache = {
            data: {
                cache_key: 'countries:all',
                cache_type: 'countries',
                provider: 'csc+restcountries',
                fetched_at: '2026-03-20T00:00:00.000Z',
                expires_at: '2026-03-21T00:00:00.000Z',
                payload: [{ country: 'India', iso2: 'IN', phone_code: '+91' }]
            },
            error: null
        };

        supabase.from.mockReturnValue(buildGeoCacheQuery([expiredCache, expiredCache]));
        axios.get.mockRejectedValue(new Error('socket hang up'));

        const geoService = require('../services/geo.service');
        const result = await geoService.getCountries();

        expect(result).toEqual([{ country: 'India', iso2: 'IN', phone_code: '+91' }]);
        expect(axios.get).toHaveBeenCalled();
    });

    test('returns invalid when postal providers all fail and no cache exists', async () => {
        const axios = require('axios');
        const supabase = require('../lib/supabase');
        supabase.from.mockReturnValue(buildGeoCacheQuery([
            { data: null, error: null },
            { data: null, error: null }
        ]));

        const timeoutError = new Error('timeout');
        timeoutError.code = 'ETIMEDOUT';
        axios.get.mockRejectedValue(timeoutError);

        const geoService = require('../services/geo.service');

        await expect(geoService.validatePostalCode('IN', '500001')).resolves.toEqual({
            valid: false
        });
    });
});
