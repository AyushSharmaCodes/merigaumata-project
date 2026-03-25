const mockOtpService = require('./mocks/otp.mock');

jest.mock('../services/otp.service', () => mockOtpService);
jest.mock('../services/email', () => ({
    sendEmailConfirmation: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendRegistrationEmail: jest.fn()
}));

const mockCustomAuthService = {
    getAuthAccountByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    updatePassword: jest.fn()
};

jest.mock('../services/custom-auth.service', () => mockCustomAuthService);

jest.mock('../middleware/auth.middleware', () => ({
    invalidateAuthCache: jest.fn(),
    authenticateToken: jest.fn(),
    optionalAuth: jest.fn()
}));

jest.mock('../utils/app-auth', () => ({
    APP_REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    createAppAccessToken: jest.fn(),
    generateOpaqueToken: jest.fn(),
    hashOpaqueToken: jest.fn((token) => `hashed:${token}`),
    verifyAppAccessToken: jest.fn(),
    isAppAccessToken: jest.fn(() => true)
}));

jest.mock('../lib/supabase', () => ({
    supabase: { from: jest.fn() },
    supabaseAdmin: { from: jest.fn() }
}));

const AuthService = require('../services/auth.service');
const { AUTH } = require('../constants/messages');

describe('AuthService.changePassword with OTP', () => {
    const user = {
        id: 'user-123',
        email: 'test@example.com',
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockOtpService.clearStore();
        mockCustomAuthService.getAuthAccountByEmail.mockResolvedValue({
            user_id: user.id,
            email: user.email,
            password_hash: 'stored-password-hash'
        });
        mockCustomAuthService.verifyPassword.mockResolvedValue(true);
        mockCustomAuthService.updatePassword.mockResolvedValue();
    });

    test('changes password successfully with a valid OTP and current password', async () => {
        await mockOtpService.sendOTP(user.email, { purpose: 'PASSWORD_CHANGE' });
        const validOtp = mockOtpService.TEST_OTP;

        const result = await AuthService.changePassword(
            user.id,
            user.email,
            user.currentPassword,
            user.newPassword,
            validOtp
        );

        expect(result).toEqual({
            success: true,
            message: AUTH.PASSWORD_UPDATED
        });
        expect(mockOtpService.verifyOTP).toHaveBeenCalledWith(user.email, validOtp);
        expect(mockCustomAuthService.getAuthAccountByEmail).toHaveBeenCalledWith(user.email);
        expect(mockCustomAuthService.verifyPassword).toHaveBeenCalledWith(user.currentPassword, 'stored-password-hash');
        expect(mockCustomAuthService.updatePassword).toHaveBeenCalledWith(user.id, user.newPassword);
    });

    test('fails when OTP is invalid', async () => {
        await expect(AuthService.changePassword(
            user.id,
            user.email,
            user.currentPassword,
            user.newPassword,
            'wrong-otp'
        )).rejects.toMatchObject({
            message: 'OTP not found or expired',
            status: 400
        });

        expect(mockCustomAuthService.verifyPassword).not.toHaveBeenCalled();
        expect(mockCustomAuthService.updatePassword).not.toHaveBeenCalled();
    });

    test('fails when current password is incorrect', async () => {
        await mockOtpService.sendOTP(user.email, { purpose: 'PASSWORD_CHANGE' });
        mockCustomAuthService.verifyPassword.mockResolvedValue(false);

        await expect(AuthService.changePassword(
            user.id,
            user.email,
            'WrongCurrentPass',
            user.newPassword,
            mockOtpService.TEST_OTP
        )).rejects.toMatchObject({
            message: AUTH.INVALID_PASSWORD,
            status: 401
        });

        expect(mockCustomAuthService.updatePassword).not.toHaveBeenCalled();
    });
});
