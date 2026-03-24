const crypto = require('crypto');
const logger = require('../utils/logger');
const { supabaseAdmin: supabase } = require('../lib/supabase');
const emailService = require('./email');
const { AUTH, LOGS } = require('../constants/messages');
const { translate } = require('../utils/i18n.util');

// Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const MAX_OTP_REQUESTS = 3;

/**
 * Generate cryptographically secure OTP
 */
function generateSecureOTP() {
    const randomBytes = crypto.randomBytes(3);
    const number = parseInt(randomBytes.toString('hex'), 16);
    const otp = (number % 900000 + 100000).toString();
    return otp;
}

/**
 * Hash OTP using sha256 (Faster than bcrypt, sufficient for short-lived OTPs)
 */
function hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify OTP against hash using timing-safe comparison
 */
function verifyOTPHash(otp, hash) {
    const newHash = hashOTP(otp);
    const buf1 = Buffer.from(newHash);
    const buf2 = Buffer.from(hash);
    if (buf1.length !== buf2.length) return false;
    return crypto.timingSafeEqual(buf1, buf2);
}

/**
 * Check rate limiting
 */
async function checkRateLimit(identifier) {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);

    const { data, error } = await supabase
        .from('otp_codes')
        .select('id')
        .eq('identifier', identifier)
        .gte('created_at', windowStart.toISOString());

    if (error) {
        logger.error({ err: error }, 'Rate limit check error:');
        return { allowed: true, remaining: MAX_OTP_REQUESTS };
    }

    const count = data?.length || 0;
    const remaining = Math.max(0, MAX_OTP_REQUESTS - count);

    return {
        allowed: count < MAX_OTP_REQUESTS,
        remaining,
        retryAfter: count >= MAX_OTP_REQUESTS ? RATE_LIMIT_WINDOW_MINUTES * 60 : 0
    };
}

/**
 * Clean up expired OTPs
 */
async function cleanupExpiredOTPs() {
    const { error } = await supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());

    if (error) {
        logger.error({ err: error }, 'Cleanup error:');
    }
}

/**
 * Delete OTP after successful verification
 */
async function deleteOTP(identifier) {
    const { error } = await supabase
        .from('otp_codes')
        .delete()
        .eq('identifier', identifier);

    if (error) {
        logger.error({ err: error }, 'Delete OTP error:');
    }
}

/**
 * Send OTP via Email using Resend
 */
async function sendEmailOTP(email, otp, metadata = null, lang = 'en') {

    try {
        let result;
        if (metadata?.purpose === 'ACCOUNT_DELETION') {
            result = await emailService.sendAccountDeletionOTPEmail(email, otp, OTP_EXPIRY_MINUTES, lang);
        } else if (metadata?.purpose === 'PASSWORD_CHANGE') {
            result = await emailService.sendPasswordChangeOTPEmail(email, otp, OTP_EXPIRY_MINUTES, lang);
        } else {
            result = await emailService.sendOTPEmail(email, otp, OTP_EXPIRY_MINUTES, lang);
        }
        logger.info(`✅ OTP email sent to ${email}`);
        return result;
    } catch (error) {
        logger.error({ err: error }, 'Failed to send OTP email:');
        // Fallback to console in development if Resend fails
        if (process.env.NODE_ENV === 'development') {
            logger.info('\n' + '='.repeat(70));
            logger.info('📧 EMAIL OTP DELIVERY (FALLBACK)');
            logger.info('='.repeat(70));
            logger.info(`To: ${email}`);
            logger.info(`Code: ${otp}`);
            logger.info(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
            logger.info('='.repeat(70) + '\n');
            return { success: true, type: 'EMAIL', fallback: true };
        }
        throw error;
    }
}

/**
 * Send OTP via SMS (Stub/Console Log)
 */
async function sendPhoneOTP(phone, otp) {
    // Integrate with Twilio/SNS here.
    // For now, logging to console for development.
    if (process.env.NODE_ENV === 'development' || true) { // Always log for now since no provider
        logger.info('\n' + '='.repeat(70));
        logger.info('📱 SMS OTP DELIVERY (MOCK)');
        logger.info('='.repeat(70));
        logger.info(`To: ${phone}`);
        logger.info(`Code: ${otp}`);
        logger.info(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
        logger.info('='.repeat(70) + '\n');
        return { success: true, type: 'SMS', mock: true };
    }
}

/**
 * Generate and send OTP
 * @param {string} identifier - Email or Phone
 * @param {object} [metadata] - Optional metadata to store with OTP (e.g. encrypted session)
 */
async function sendOTP(identifier, metadata = null, lang = 'en') {
    try {
        // Validation: Must be email OR phone (basic length check)
        const isEmail = identifier.includes('@');
        if (!identifier || identifier.length < 5) {
            return {
                success: false,
                error: translate('errors.auth.invalidEmailPhone')
            };
        }

        // Check rate limit and clean up old OTPs in parallel
        const [rateLimit, deleteResult] = await Promise.all([
            checkRateLimit(identifier),
            supabase
                .from('otp_codes')
                .delete()
                .eq('identifier', identifier)
        ]);

        if (!rateLimit.allowed) {
            return {
                success: false,
                error: translate('errors.auth.otpRateLimit'),
                retryAfter: rateLimit.retryAfter
            };
        }

        // Generate OTP and hash it immediately (now synchronous)
        const otp = generateSecureOTP();
        const hashedOTP = hashOTP(otp);

        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        let { error } = await supabase
            .from('otp_codes')
            .insert([{
                identifier: identifier,
                code: hashedOTP,
                expires_at: expiresAt.toISOString(),
                attempts: 0,
                verified: false,
                metadata: metadata // Store metadata
            }]);

        if (error && error.code === '42703') {
            // FALLBACK: If metadata column is missing, retry without it
            logger.warn({ identifier }, '[OTPService] metadata column missing, falling back to safe insert');
            const fallback = await supabase
                .from('otp_codes')
                .insert([{
                    identifier: identifier,
                    code: hashedOTP,
                    expires_at: expiresAt.toISOString(),
                    attempts: 0,
                    verified: false
                }]);
            error = fallback.error;
        }

        if (error) {
            logger.error({ err: error }, 'Store OTP error:');
            throw new Error(AUTH.OTP_STORE_FAILED);
        }

        // Send OTP via appropriate channel
        if (isEmail) {
            // Optimization: Send email in background to speed up response
            sendEmailOTP(identifier, otp, metadata, lang).catch(err =>
                logger.error({ err }, 'Background OTP email send failed')
            );
        } else {
            // Optimization: Send SMS in background
            sendPhoneOTP(identifier, otp).catch(err =>
                logger.error({ err }, 'Background SMS OTP send failed')
            );
        }

        // Clean up expired OTPs in background
        cleanupExpiredOTPs().catch(err => logger.error('Background cleanup error:', err));

        return {
            success: true,
            message: translate('auth.otpSentEmail'),
            expiresIn: OTP_EXPIRY_MINUTES * 60,
            attemptsAllowed: MAX_ATTEMPTS
        };
    } catch (error) {
        logger.error({ err: error }, 'Send OTP error:');
        return {
            success: false,
            error: error.message || translate(AUTH.SEND_CODE_FAILED)
        };
    }
}

/**
 * Verify OTP
 */
async function verifyOTP(identifier, otp) {
    try {
        // Validate inputs
        if (!identifier || identifier.length < 5) {
            return {
                success: false,
                error: 'Invalid identifier'
            };
        }

        if (!otp || otp.length !== OTP_LENGTH || !/^\d+$/.test(otp)) {
            return {
                success: false,
                error: 'Invalid OTP format'
            };
        }

        // Get latest OTP for email
        const { data: otpData, error } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('identifier', identifier)
            .eq('verified', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !otpData) {
            return {
                success: false,
                error: 'Invalid OTP'
            };
        }

        // Check if expired
        if (new Date(otpData.expires_at) < new Date()) {
            await deleteOTP(identifier); // Fixed variable
            return {
                success: false,
                error: 'OTP has expired. Please request a new one.'
            };
        }

        // Check max attempts
        if (otpData.attempts >= MAX_ATTEMPTS) {
            await deleteOTP(identifier); // Fixed variable
            return {
                success: false,
                error: 'Maximum attempts exceeded. Please request a new OTP.'
            };
        }

        // Verify OTP hash
        const isValid = await verifyOTPHash(otp, otpData.code);

        if (!isValid) {
            // Increment attempts
            const newAttempts = otpData.attempts + 1;
            await supabase
                .from('otp_codes')
                .update({ attempts: newAttempts })
                .eq('id', otpData.id);

            const remainingAttempts = MAX_ATTEMPTS - newAttempts;

            return {
                success: false,
                error: 'Invalid OTP',
                attemptsRemaining: remainingAttempts
            };
        }

        // Mark as verified
        await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpData.id);

        // Delete OTP after successful verification
        await deleteOTP(identifier); // Fixed variable

        return {
            success: true,
            message: translate('auth.otpVerifiedSuccess'),
            metadata: otpData.metadata // Return metadata
        };
    } catch (error) {
        logger.error({ err: error }, 'Verify OTP error:');
        return {
            success: false,
            error: 'Failed to verify OTP'
        };
    }
}

module.exports = {
    sendOTP,
    verifyOTP,
    checkRateLimit,
    cleanupExpiredOTPs
};
