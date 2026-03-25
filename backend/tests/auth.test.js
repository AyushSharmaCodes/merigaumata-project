/**
 * Custom authentication flow tests
 *
 * Covers:
 * - signup without auto-login
 * - email/password validation + OTP bootstrap
 * - OTP login issuing app-owned tokens
 * - custom refresh token flow
 * - logout revoking custom refresh tokens
 */

const mockOtpService = require('./mocks/otp.mock');
const mockEmailService = require('./mocks/email.mock');

jest.mock('../services/otp.service', () => mockOtpService);
jest.mock('../services/email', () => mockEmailService);

const mockInvalidateAuthCache = jest.fn();

jest.mock('../middleware/auth.middleware', () => ({
    invalidateAuthCache: mockInvalidateAuthCache,
    authenticateToken: jest.fn(),
    optionalAuth: jest.fn()
}));

const mockCustomAuthService = {
    getAuthAccountByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    touchLastLogin: jest.fn(),
    upsertLocalAccount: jest.fn(),
    updatePassword: jest.fn(),
    hasPasswordByUserId: jest.fn(),
    deleteAuthArtifacts: jest.fn()
};

jest.mock('../services/custom-auth.service', () => mockCustomAuthService);

const mockCreateAppAccessToken = jest.fn(() => 'app-access-token');
const mockGenerateOpaqueToken = jest.fn(() => 'opaque-refresh-token');
const mockHashOpaqueToken = jest.fn((token) => `hashed:${token}`);
const mockVerifyAppAccessToken = jest.fn();
const mockIsAppAccessToken = jest.fn(() => true);

jest.mock('../utils/app-auth', () => ({
    APP_REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    createAppAccessToken: mockCreateAppAccessToken,
    generateOpaqueToken: mockGenerateOpaqueToken,
    hashOpaqueToken: mockHashOpaqueToken,
    verifyAppAccessToken: mockVerifyAppAccessToken,
    isAppAccessToken: mockIsAppAccessToken
}));

function createQueryBuilder(result) {
    const chain = {
        eq: jest.fn(() => chain),
        lt: jest.fn(() => chain),
        in: jest.fn(() => Promise.resolve({ data: null, error: null })),
        order: jest.fn(() => Promise.resolve(result)),
        single: jest.fn(() => Promise.resolve(result)),
        maybeSingle: jest.fn(() => Promise.resolve(result))
    };

    return chain;
}

const fromHandlers = {};
const mockFrom = jest.fn((table) => {
    const handler = fromHandlers[table];
    if (!handler) {
        throw new Error(`Missing mock handler for table: ${table}`);
    }
    return handler();
});

jest.mock('../lib/supabase', () => ({
    supabase: {
        from: mockFrom
    },
    supabaseAdmin: {
        from: mockFrom
    }
}));

const AuthService = require('../services/auth.service');
const { AUTH } = require('../constants/messages');

describe('Custom Authentication Flows', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOtpService.clearStore();
        mockEmailService.clearSentEmails();

        Object.keys(fromHandlers).forEach((key) => delete fromHandlers[key]);

        mockCustomAuthService.getAuthAccountByEmail.mockResolvedValue(null);
        mockCustomAuthService.verifyPassword.mockResolvedValue(false);
        mockCustomAuthService.touchLastLogin.mockResolvedValue();
        mockCustomAuthService.upsertLocalAccount.mockResolvedValue();
        mockCustomAuthService.updatePassword.mockResolvedValue();
        mockCustomAuthService.hasPasswordByUserId.mockResolvedValue(false);
        mockCustomAuthService.deleteAuthArtifacts.mockResolvedValue();
    });

    describe('Signup Flow', () => {
        test('registerUser creates profile and local auth account without auto-login', async () => {
            fromHandlers.profiles = () => ({
                select: jest.fn(() => createQueryBuilder({ data: null, error: { code: 'PGRST116' } })),
                upsert: jest.fn(() => Promise.resolve({ error: null })),
                update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) }))
            });

            fromHandlers.roles = () => ({
                select: jest.fn(() => createQueryBuilder({ data: { id: 'role-customer' }, error: null }))
            });

            const result = await AuthService.registerUser({
                email: 'test@example.com',
                password: 'SecurePass123!',
                name: 'Test User',
                phone: null,
                isOtpVerified: false,
                lang: 'en'
            });
            await new Promise((resolve) => setImmediate(resolve));

            expect(result).toEqual(expect.objectContaining({
                email: 'test@example.com',
                role: 'customer',
                emailVerified: false
            }));
            expect(result.access_token).toBeUndefined();
            expect(result.refresh_token).toBeUndefined();
            expect(mockCustomAuthService.upsertLocalAccount).toHaveBeenCalledWith(expect.objectContaining({
                email: 'test@example.com',
                password: 'SecurePass123!'
            }));
            expect(mockEmailService.sendEmailConfirmation).toHaveBeenCalled();
        });
    });

    describe('Login + OTP Flow', () => {
        test('validateCredentials sends OTP using custom auth account password validation', async () => {
            fromHandlers.profiles = () => ({
                select: jest.fn(() => createQueryBuilder({
                    data: {
                        id: 'user-123',
                        email: 'user@example.com',
                        is_blocked: false,
                        is_deleted: false,
                        email_verified: true,
                        auth_provider: 'LOCAL'
                    },
                    error: null
                }))
            });

            mockCustomAuthService.getAuthAccountByEmail.mockResolvedValue({
                user_id: 'user-123',
                email: 'user@example.com',
                password_hash: 'hashed-password'
            });
            mockCustomAuthService.verifyPassword.mockResolvedValue(true);

            const result = await AuthService.validateCredentials('user@example.com', 'ValidPass123!', 'guest-1', 'en');

            expect(result.success).toBe(true);
            expect(mockOtpService.sendOTP).toHaveBeenCalledWith(
                'user@example.com',
                { userId: 'user-123', guestId: 'guest-1' },
                'en'
            );
        });

        test('validateCredentials blocks Google-only accounts without local password', async () => {
            fromHandlers.profiles = () => ({
                select: jest.fn(() => createQueryBuilder({
                    data: {
                        id: 'user-123',
                        email: 'user@example.com',
                        is_blocked: false,
                        is_deleted: false,
                        email_verified: true,
                        auth_provider: 'GOOGLE'
                    },
                    error: null
                }))
            });

            mockCustomAuthService.getAuthAccountByEmail.mockResolvedValue({
                user_id: 'user-123',
                email: 'user@example.com',
                password_hash: null
            });

            const result = await AuthService.validateCredentials('user@example.com', 'ValidPass123!', null, 'en');

            expect(result).toEqual({
                success: false,
                error: AUTH.GOOGLE_SIGNIN_REQUIRED,
                status: 400
            });
        });

        test('verifyLoginOtp returns app-owned tokens after valid OTP', async () => {
            await mockOtpService.sendOTP('user@example.com', { userId: 'user-123', guestId: null }, 'en');

            fromHandlers.profiles = jest.fn()
                .mockImplementationOnce(() => ({
                    select: jest.fn(() => createQueryBuilder({
                        data: {
                            id: 'user-123',
                            email: 'user@example.com',
                            phone: null,
                            name: 'Test User',
                            email_verified: true,
                            must_change_password: false,
                            roles: { name: 'customer' }
                        },
                        error: null
                    }))
                }))
                .mockImplementationOnce(() => ({
                    select: jest.fn(() => createQueryBuilder({
                        data: {
                            id: 'user-123',
                            email: 'user@example.com',
                            phone: null,
                            name: 'Test User',
                            preferred_language: 'en',
                            email_verified: true,
                            phone_verified: false,
                            must_change_password: false,
                            auth_provider: 'LOCAL',
                            deletion_status: 'ACTIVE',
                            roles: { name: 'customer' }
                        },
                        error: null
                    }))
                }));

            fromHandlers.app_refresh_tokens = () => ({
                insert: jest.fn(() => Promise.resolve({ error: null })),
                delete: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        lt: jest.fn(() => Promise.resolve({ error: null }))
                    }))
                })),
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                }))
            });

            const result = await AuthService.verifyLoginOtp('user@example.com', mockOtpService.TEST_OTP, {
                userAgent: 'jest-agent',
                ipAddress: '127.0.0.1'
            });

            expect(result.user).toEqual(expect.objectContaining({
                id: 'user-123',
                email: 'user@example.com',
                role: 'customer'
            }));
            expect(result.tokens).toEqual({
                access_token: 'app-access-token',
                refresh_token: 'opaque-refresh-token'
            });
            expect(mockCustomAuthService.touchLastLogin).toHaveBeenCalledWith('user-123');
            expect(mockCreateAppAccessToken).toHaveBeenCalled();
        });
    });

    describe('Refresh Flow', () => {
        test('refreshToken returns a new access token for a valid custom refresh token', async () => {
            fromHandlers.app_refresh_tokens = jest.fn()
                .mockImplementationOnce(() => ({
                    select: jest.fn(() => createQueryBuilder({
                        data: {
                            id: 'rt-1',
                            user_id: 'user-123',
                            expires_at: new Date(Date.now() + 60_000).toISOString(),
                            revoked_at: null
                        },
                        error: null
                    }))
                }))
                .mockImplementationOnce(() => ({
                    update: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            eq: jest.fn(() => Promise.resolve({ error: null }))
                        }))
                    }))
                }));

            fromHandlers.profiles = () => ({
                select: jest.fn(() => createQueryBuilder({
                    data: {
                        id: 'user-123',
                        email: 'user@example.com',
                        phone: null,
                        name: 'Test User',
                        preferred_language: 'en',
                        email_verified: true,
                        phone_verified: false,
                        must_change_password: false,
                        auth_provider: 'LOCAL',
                        deletion_status: 'ACTIVE',
                        roles: { name: 'customer' }
                    },
                    error: null
                }))
            });

            const result = await AuthService.refreshToken('opaque-refresh-token', {
                userAgent: 'jest-agent',
                ipAddress: '127.0.0.1'
            });

            expect(mockHashOpaqueToken).toHaveBeenCalledWith('opaque-refresh-token');
            expect(result).toEqual({
                userId: 'user-123',
                tokens: {
                    access_token: 'app-access-token',
                    refresh_token: 'opaque-refresh-token'
                }
            });
        });

        test('refreshToken throws 401 when refresh token is missing', async () => {
            await expect(AuthService.refreshToken(null)).rejects.toMatchObject({
                message: AUTH.REFRESH_TOKEN_REQUIRED,
                status: 401
            });
        });
    });

    describe('Logout Flow', () => {
        test('logout revokes app refresh token and clears access-token cache', async () => {
            fromHandlers.app_refresh_tokens = () => ({
                delete: jest.fn(() => ({
                    eq: jest.fn(() => Promise.resolve({ error: null }))
                }))
            });

            const result = await AuthService.logout('access-token', 'opaque-refresh-token');

            expect(result).toBe(true);
            expect(mockHashOpaqueToken).toHaveBeenCalledWith('opaque-refresh-token');
            expect(mockInvalidateAuthCache).toHaveBeenCalledWith('access-token');
        });
    });
});
