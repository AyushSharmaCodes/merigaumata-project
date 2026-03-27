describe('GoogleOAuthService failure handling', () => {
    const originalEnv = process.env;
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            GOOGLE_CLIENT_ID: 'google-client-id',
            GOOGLE_CLIENT_SECRET: 'google-client-secret',
            FRONTEND_URL: 'https://example.com',
            GOOGLE_API_TIMEOUT_MS: '10'
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    test('maps token exchange timeout to a 504 error', async () => {
        global.fetch = jest.fn().mockRejectedValue({ name: 'AbortError' });

        const GoogleOAuthService = require('../services/google-oauth.service');

        await expect(
            GoogleOAuthService.exchangeCode({
                code: 'auth-code',
                codeVerifier: 'verifier',
                expectedNonce: 'nonce'
            })
        ).rejects.toMatchObject({
            status: 504,
            code: 'ETIMEDOUT',
            message: 'Google authentication timed out.'
        });
    });

    test('maps upstream network errors to a 502 error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND oauth2.googleapis.com'));

        const GoogleOAuthService = require('../services/google-oauth.service');

        await expect(
            GoogleOAuthService.exchangeCode({
                code: 'auth-code',
                codeVerifier: 'verifier',
                expectedNonce: 'nonce'
            })
        ).rejects.toMatchObject({
            status: 502,
            message: 'Google authentication is temporarily unavailable.'
        });
    });
});
