/**
 * OTP Service Mock
 * Provides predictable OTP values for testing
 */

const otpStore = new Map();

// Predictable OTP for testing
const TEST_OTP = '123456';

const mockOtpService = {
    // The test OTP value
    TEST_OTP,

    // Clear OTP store between tests
    clearStore: () => {
        otpStore.clear();
    },

    // Mock sendOTP - always returns success with predictable OTP
    sendOTP: jest.fn(async (identifier, metadata = null) => {
        const otpRecord = {
            otp: TEST_OTP,
            hashedOtp: `hashed_${TEST_OTP}`,
            metadata,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            attempts: 0,
            createdAt: new Date()
        };
        otpStore.set(identifier, otpRecord);

        return {
            success: true,
            expiresIn: 600, // 10 minutes in seconds
            attemptsAllowed: 3
        };
    }),

    // Mock verifyOTP
    verifyOTP: jest.fn(async (identifier, otp) => {
        const record = otpStore.get(identifier);

        if (!record) {
            return {
                success: false,
                error: 'OTP not found or expired',
                attemptsRemaining: 0
            };
        }

        // Check expiry
        if (new Date() > record.expiresAt) {
            otpStore.delete(identifier);
            return {
                success: false,
                error: 'OTP expired',
                attemptsRemaining: 0
            };
        }

        // Check attempts
        if (record.attempts >= 3) {
            return {
                success: false,
                error: 'Maximum attempts exceeded',
                attemptsRemaining: 0
            };
        }

        // Verify OTP
        if (otp !== TEST_OTP) {
            record.attempts++;
            return {
                success: false,
                error: 'Invalid OTP',
                attemptsRemaining: 3 - record.attempts
            };
        }

        // Success - return metadata and delete OTP
        const metadata = record.metadata;
        otpStore.delete(identifier);

        return {
            success: true,
            metadata
        };
    }),

    // Mock rate limit check
    checkRateLimit: jest.fn(async (identifier) => {
        return { allowed: true };
    }),

    // Helper to get stored OTP for test assertions
    getStoredOtp: (identifier) => otpStore.get(identifier)
};

module.exports = mockOtpService;
