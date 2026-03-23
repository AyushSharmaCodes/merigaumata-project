
const mockOtpService = require('./mocks/otp.mock');
const mockEmailService = require('./mocks/email.mock');

// Mock services
jest.mock('../services/otp.service', () => mockOtpService);
jest.mock('../services/email', () => mockEmailService);

// Mock Supabase
const mockSupabase = {
    auth: {
        signInWithPassword: jest.fn(),
        admin: {
            updateUserById: jest.fn()
        }
    }
};

const mockSupabaseImplementation = {
    supabaseAdmin: {
        ...mockSupabase,
        from: jest.fn()
    }
};

jest.mock('../lib/supabase', () => mockSupabaseImplementation);
jest.mock('../config/supabase', () => mockSupabaseImplementation);

// Mock createClient for tempClient
const mockTempClient = {
    auth: {
        signInWithPassword: jest.fn()
    }
};
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockTempClient)
}));

const AuthService = require('../services/auth.service');
const { AUTH } = require('../constants/messages');

describe('AuthService.changePassword with OTP', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOtpService.clearStore();
    });

    const user = {
        id: 'user-123',
        email: 'test@example.com',
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
    };

    test('should change password successfully with valid OTP', async () => {
        // Arrange
        // 1. Setup OTP
        await mockOtpService.sendOTP(user.email, { purpose: 'PASSWORD_CHANGE' });
        const validOtp = mockOtpService.TEST_OTP; // '123456'

        // 2. Mock password validation (tempClient)
        mockTempClient.auth.signInWithPassword.mockResolvedValue({ error: null });

        // 3. Mock password update
        mockSupabase.auth.admin.updateUserById.mockResolvedValue({ error: null });

        // Act
        const result = await AuthService.changePassword(
            user.id,
            user.email,
            user.currentPassword,
            user.newPassword,
            validOtp
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe(AUTH.PASSWORD_UPDATED);

        // Verifications
        expect(mockOtpService.verifyOTP).toHaveBeenCalledWith(user.email, validOtp);
        expect(mockTempClient.auth.signInWithPassword).toHaveBeenCalledWith({
            email: user.email,
            password: user.currentPassword
        });
        expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
            user.id,
            expect.objectContaining({ password: user.newPassword })
        );
    });

    test('should fail with invalid OTP', async () => {
        // Act & Assert
        await expect(AuthService.changePassword(
            user.id,
            user.email,
            user.currentPassword,
            user.newPassword,
            'wrong-otp'
        )).rejects.toMatchObject({
            message: 'OTP not found or expired' // From mock
        });

        // Ensure no password check/update happened
        expect(mockTempClient.auth.signInWithPassword).not.toHaveBeenCalled();
        expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
    });

    test('should fail if current password is incorrect', async () => {
        // Arrange
        await mockOtpService.sendOTP(user.email);
        const validOtp = mockOtpService.TEST_OTP;

        mockTempClient.auth.signInWithPassword.mockResolvedValue({
            error: { message: 'Invalid login credentials' }
        });

        // Act & Assert
        await expect(AuthService.changePassword(
            user.id,
            user.email,
            'WrongCurrentPass',
            user.newPassword,
            validOtp
        )).rejects.toMatchObject({
            message: AUTH.INVALID_PASSWORD,
            status: 401
        });
    });
});
