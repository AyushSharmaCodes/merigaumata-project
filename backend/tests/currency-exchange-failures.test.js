jest.mock('../config/supabase', () => ({
    supabase: {
        from: jest.fn()
    },
    _supabaseAdmin: {
        from: jest.fn(() => ({
            upsert: jest.fn().mockResolvedValue({ error: null })
        }))
    }
}));

const { CurrencyExchangeService } = require('../services/currency-exchange.service');

describe('CurrencyExchangeService third-party failure handling', () => {
    const originalEnv = process.env;
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.CURRENCYAPI_NET_KEY;
        process.env = {
            ...originalEnv,
            FREECURRENCYAPI_KEY: 'freecurrency-key',
            EXCHANGERATE_API_KEY: 'exchange-rate-key',
            CURRENCY_PRIMARY_PROVIDER: 'freecurrencyapi',
            CURRENCY_API_TIMEOUT_MS: '10'
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env = originalEnv;
    });

    test('fails over to the next provider when the first provider times out', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce({ name: 'AbortError' })
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    result: 'success',
                    conversion_rates: { USD: 1, INR: 83.1 },
                    time_last_update_utc: 'Fri, 27 Mar 2026 10:00:00 +0000'
                })
            });

        const result = await CurrencyExchangeService.fetchFreshRates('USD');

        expect(result.provider).toBe('exchangerate-api');
        expect(result.rates.INR).toBe(83.1);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('returns a gateway timeout when all configured providers time out', async () => {
        global.fetch = jest.fn().mockRejectedValue({ name: 'AbortError' });

        await expect(CurrencyExchangeService.fetchFreshRates('USD')).rejects.toMatchObject({
            status: 504,
            code: 'ETIMEDOUT',
            message: 'Currency provider timed out'
        });
    });
});
