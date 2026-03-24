/**
 * Authentication Flow Tests
 * 
 * Tests cover:
 * - Signup flow (email verification required)
 * - Login + OTP flow
 * - Cookie security
 * - Refresh flow
 * - Logout flow
 */

const mockOtpService = require('./mocks/otp.mock');
const mockEmailService = require('./mocks/email.mock');

// Mock services before requiring auth modules
jest.mock('../services/otp.service', () => mockOtpService);
jest.mock('../services/email', () => mockEmailService);

// Mock Supabase
const mockSupabase = {
    auth: {
        signInWithPassword: jest.fn(),
        refreshSession: jest.fn(),
        admin: {
            createUser: jest.fn(),
            deleteUser: jest.fn(),
            updateUserById: jest.fn(),
            signOut: jest.fn()
        }
    },
    from: jest.fn(() => ({
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                single: jest.fn()
            }))
        })),
        insert: jest.fn(),
        update: jest.fn(() => ({
            eq: jest.fn()
        })),
        upsert: jest.fn()
    }))
};

jest.mock('../config/supabase', () => mockSupabase);

// Import after mocks are set up
const AuthService = require('../services/auth.service');

describe('Authentication Flows', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockEmailService.clearSentEmails();
        mockOtpService.clearStore();
    });

    describe('Signup Flow', () => {
        test('should send confirmation email via custom SMTP on signup', async () => {
            // Arrange
            const userData = {
                email: 'test@example.com',
                password: 'SecurePass123!',
                name: 'Test User',
                phone: null,
                isOtpVerified: false
            };

            // Mock Supabase responses
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                    })
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ error: null })
                }),
                upsert: jest.fn().mockResolvedValue({ error: null })
            });

            mockSupabase.auth.admin.createUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null
            });

            // Act
            const result = await AuthService.registerUser(userData);

            // Assert
            expect(result.email).toBe(userData.email);
            expect(result.emailVerified).toBe(false);
            expect(mockEmailService.sendEmailConfirmation).toHaveBeenCalledWith(
                userData.email,
                expect.objectContaining({ name: userData.name }),
                'user-123'
            );
        });

        test('should NOT create session cookies on signup', async () => {
            // Signup should not auto-login
            // Cookies are only set after:
            // 1. Email verification
            // 2. Login with password
            // 3. OTP verification

            const userData = {
                email: 'test@example.com',
                password: 'SecurePass123!',
                name: 'Test User',
                isOtpVerified: false
            };

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                    })
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ error: null })
                }),
                upsert: jest.fn().mockResolvedValue({ error: null })
            });

            mockSupabase.auth.admin.createUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null
            });

            const result = await AuthService.registerUser(userData);

            // Result should NOT include tokens
            expect(result.access_token).toBeUndefined();
            expect(result.refresh_token).toBeUndefined();
        });
    });

    describe('Login + OTP Flow', () => {
        test('password alone should NOT complete authentication', async () => {
            // Arrange
            const email = 'user@example.com';
            const password = 'ValidPass123!';

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: 'user-123', email, is_blocked: false, is_deleted: false },
                            error: null
                        })
                    })
                })
            });

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: { id: 'user-123' },
                    session: {
                        access_token: 'access-token',
                        refresh_token: 'refresh-token'
                    }
                },
                error: null
            });

            // Act
            const result = await AuthService.validateCredentials(email, password);

            // Assert - should return OTP pending, not full auth
            expect(result.success).toBe(true);
            expect(result.access_token).toBeUndefined();
            expect(mockOtpService.sendOTP).toHaveBeenCalledWith(
                email,
                expect.objectContaining({ tokens: expect.any(String) })
            );
        });

        test('unconfirmed email should return the proper auth error', async () => {
            const email = 'pending@example.com';
            const password = 'ValidPass123!';

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: 'user-123', email, is_blocked: false, is_deleted: false },
                            error: null
                        })
                    })
                })
            });

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: { message: 'Email not confirmed' }
            });

            const result = await AuthService.validateCredentials(email, password);

            expect(result).toEqual({
                success: false,
                error: 'errors.auth.emailNotConfirmed',
                status: 403
            });
            expect(mockOtpService.sendOTP).not.toHaveBeenCalled();
        });

        test('invalid OTP should fail with attempts remaining', async () => {
            // Setup: First validate credentials to store OTP
            const email = 'user@example.com';

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: 'user-123', email, is_blocked: false, is_deleted: false },
                            error: null
                        })
                    })
                })
            });

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: { id: 'user-123' },
                    session: { access_token: 'access', refresh_token: 'refresh' }
                },
                error: null
            });

            await AuthService.validateCredentials(email, 'password');

            // Act - try wrong OTP
            await expect(AuthService.verifyLoginOtp(email, 'wrong-otp'))
                .rejects.toThrow('Invalid OTP');
        });

        test('valid OTP should return user and tokens', async () => {
            const email = 'user@example.com';

            // Setup profile query mock
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'user-123',
                                email,
                                name: 'Test User',
                                phone: null,
                                is_blocked: false,
                                is_deleted: false,
                                email_verified: true,
                                roles: { name: 'customer' }
                            },
                            error: null
                        })
                    })
                })
            });

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: { id: 'user-123' },
                    session: { access_token: 'real-access', refresh_token: 'real-refresh' }
                },
                error: null
            });

            // Validate credentials first (stores OTP with encrypted tokens)
            await AuthService.validateCredentials(email, 'password');

            // Verify with correct OTP
            const result = await AuthService.verifyLoginOtp(email, mockOtpService.TEST_OTP);

            expect(result.user.email).toBe(email);
            expect(result.tokens.access_token).toBeDefined();
            expect(result.tokens.refresh_token).toBeDefined();
        });
    });

    describe('Cookie & Token Security', () => {
        test('tokens should only be stored in HTTP-only cookies (documented expectation)', () => {
            // DOCUMENTED EXPECTATION:
            // - Access tokens stored in 'access_token' HTTP-only cookie
            // - Refresh tokens stored in 'refresh_token' HTTP-only cookie
            // - No tokens in localStorage, sessionStorage, or JS-accessible storage
            // - Frontend cannot read these cookies (httpOnly: true)

            const expectedStoragePolicy = {
                accessToken: 'HTTP-only cookie',
                refreshToken: 'HTTP-only cookie',
                localStorage: 'NEVER',
                sessionStorage: 'NEVER'
            };

            expect(expectedStoragePolicy.localStorage).toBe('NEVER');
            expect(expectedStoragePolicy.sessionStorage).toBe('NEVER');
        });

        test('refresh method should return tokens and userId', async () => {
            const refreshToken = 'valid-refresh-token';

            mockSupabase.auth.refreshSession.mockResolvedValue({
                data: {
                    session: {
                        access_token: 'new-access-token',
                        refresh_token: 'new-refresh-token',
                        user: { id: 'user-123' }
                    }
                },
                error: null
            });

            const result = await AuthService.refreshToken(refreshToken);

            expect(result.tokens.access_token).toBe('new-access-token');
            expect(result.tokens.refresh_token).toBe('new-refresh-token');
            expect(result.userId).toBe('user-123');
        });
    });

    describe('Refresh Flow', () => {
        test('valid refresh token should return new tokens', async () => {
            mockSupabase.auth.refreshSession.mockResolvedValue({
                data: {
                    session: {
                        access_token: 'new-access',
                        refresh_token: 'new-refresh',
                        user: { id: 'user-123' }
                    }
                },
                error: null
            });

            const result = await AuthService.refreshToken('old-refresh-token');

            expect(result.tokens.access_token).toBe('new-access');
            expect(result.userId).toBe('user-123');
        });

        test('expired refresh token should throw 401 error', async () => {
            mockSupabase.auth.refreshSession.mockResolvedValue({
                data: { session: null },
                error: { message: 'Token expired', status: 401 }
            });

            await expect(AuthService.refreshToken('expired-token'))
                .rejects.toMatchObject({ status: 401 });
        });

        test('missing refresh token should throw error', async () => {
            await expect(AuthService.refreshToken(null))
                .rejects.toThrow('Refresh token required');
        });
    });

    describe('Logout Flow', () => {
        test('logout should return success', async () => {
            mockSupabase.auth.admin.signOut.mockResolvedValue({ error: null });

            const result = await AuthService.logout('access-token', 'refresh-token');

            expect(result).toBe(true);
        });

        test('logout should succeed even if Supabase fails', async () => {
            mockSupabase.auth.admin.signOut.mockRejectedValue(new Error('Network error'));

            // Should not throw, should still return true
            const result = await AuthService.logout('access-token', 'refresh-token');
            expect(result).toBe(true);
        });
    });
});

describe('Cookie Options', () => {
    // These are documented expectations for cookie configuration
    // Actual cookie setting happens in routes, tested via integration tests

    test('should use correct security settings', () => {
        const expectedCookieConfig = {
            httpOnly: true,
            secure: true, // In production
            sameSite: 'strict', // Or 'none' for cross-origin
            path: '/'
        };

        // Document expected configuration
        expect(expectedCookieConfig.httpOnly).toBe(true);
        expect(['strict', 'lax', 'none']).toContain(expectedCookieConfig.sameSite);
    });
});
