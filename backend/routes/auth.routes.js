const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { z } = require('zod');
const { authenticateToken, invalidateAuthCache, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { loginSchema, registerSchema, changePasswordSchema } = require('../schemas/auth.schema');
const AuthService = require('../services/auth.service');
const { supabase, supabaseAdmin } = require('../lib/supabase'); // Consolidated Supabase client usage
const { createClient } = require('@supabase/supabase-js');
const { getFriendlyMessage } = require('../utils/error-messages');
const { AUTH, SYSTEM, VALIDATION } = require('../constants/messages');


// NOTE: /auth/me endpoint REMOVED
// Session initialization now uses supabase.auth.getSession() on frontend
// /auth/refresh returns user data for state sync after token refresh

/**
 * POST /auth/check-email
 * Check if email exists in the system
 */
router.post('/check-email', validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;
    try {
        const exists = await AuthService.checkEmailExists(email);
        res.json({ exists, email });
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_CHECK_EMAIL_ERROR);
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * POST /auth/sync
 * Sync Supabase Session (e.g. from Google OAuth) with Backend Cookies
 */
router.post('/sync', validate(z.object({ access_token: z.string(), refresh_token: z.string() })), async (req, res) => {
    const { access_token, refresh_token } = req.body;
    const guestId = req.headers['x-guest-id'];
    logger.info({ email: req.body.email }, AUTH.LOG_SYNC_REQUEST_RECEIVED);

    try {
        const user = await AuthService.syncSession(access_token, guestId);

        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = process.env.FRONTEND_URL?.startsWith('https');
        const sameSiteNone = isProd && isHttps;

        const baseOptions = {
            httpOnly: true,
            secure: sameSiteNone,
            sameSite: sameSiteNone ? 'none' : 'lax',
            path: '/'
        };

        res.cookie('access_token', access_token, {
            ...baseOptions,
            maxAge: 60 * 60 * 1000 // 1 hour (matches Supabase token expiry)
        });

        res.cookie('refresh_token', refresh_token, {
            ...baseOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // OPTIMIZATION: Set non-httpOnly marker cookie for frontend detection
        res.cookie('logged_in', 'true', {
            ...baseOptions,
            httpOnly: false, // Explicitly false so JS can read it
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true, message: AUTH.AUTH_SESSION_SYNCED, user });


    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_SESSION_SYNC_ERROR);
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * POST /auth/validate-credentials
 * Validate email + password before sending OTP (for login flow)
 */
router.post('/validate-credentials', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const guestId = req.headers['x-guest-id'];

    try {
        const lang = req.get('x-user-lang') || 'en';
        const otpResult = await AuthService.validateCredentials(email, password, guestId, lang);

        if (!otpResult.success) {
            logger.warn({ email, guestId, otpResult }, AUTH.LOG_CREDENTIALS_VALIDATION_FAILED);
            return res.status(otpResult.retryAfter ? 429 : 200).json(otpResult);
        }

        logger.info({ email, guestId }, AUTH.LOG_OTP_SENT);
        res.json({
            success: true,
            message: AUTH.OTP_SENT,

            expiresIn: otpResult.expiresIn,
            attemptsAllowed: otpResult.attemptsAllowed
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, email, friendlyMessage }, AUTH.LOG_VALIDATE_CREDENTIALS_ERROR);
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

/**
 * POST /auth/resend-confirmation
 * Resend confirmation email (checks if already verified)
 */
router.post('/resend-confirmation', validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;
    try {
        const result = await AuthService.resendConfirmationEmail(email);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_RESEND_CONFIRMATION_ERROR);
        res.status(error.status || 400).json({ error: error.message });
    }
});

/**
 * POST /auth/register
 * Complete registration after OTP verification
 */
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const lang = req.get('x-user-lang') || 'en';
        const user = await AuthService.registerUser({
            ...req.body,
            isOtpVerified: req.body.otpVerified === true,
            lang
        });

        logger.info({ userId: user.id }, AUTH.LOG_REGISTER_SUCCESS);
        res.status(201).json({
            success: true,
            message: AUTH.REGISTER_SUCCESS,

            user
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, email: req.body.email, friendlyMessage }, AUTH.LOG_REGISTRATION_ERROR);
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

/**
 * GET /auth/verify-email
 */
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    try {
        await AuthService.verifyEmail(token);

        logger.info({ token: token ? `${token.substring(0, 5)}...` : 'null' }, AUTH.LOG_EMAIL_VERIFIED);
        res.json({
            success: true,
            message: AUTH.EMAIL_VERIFIED
        });

    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, friendlyMessage }, AUTH.LOG_EMAIL_VERIFICATION_ERROR);
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

/**
 * POST /auth/verify-login-otp
 * Verify OTP and exchange for session cookies
 */
router.post('/verify-login-otp', validate(z.object({ email: z.string().email(), otp: z.string() })), async (req, res) => {
    const { email, otp } = req.body;

    try {
        const { user, tokens } = await AuthService.verifyLoginOtp(email, otp);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 60 * 60 * 1000, // 1 hour
            path: '/'
        };

        res.cookie('access_token', tokens.access_token, cookieOptions);

        res.cookie('refresh_token', tokens.refresh_token, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // OPTIMIZATION: Set non-httpOnly marker cookie
        res.cookie('logged_in', 'true', {
            ...cookieOptions,
            httpOnly: false,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        logger.info({ email, userId: user.id }, AUTH.LOG_LOGIN_SUCCESS);
        res.json({
            success: true,
            message: AUTH.LOGIN_SUCCESS,

            user,
            tokens
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, email, friendlyMessage }, AUTH.LOG_VERIFY_LOGIN_OTP_ERROR);
        res.status(error.status || 400).json({ error: friendlyMessage, attemptsRemaining: error.attemptsRemaining });
    }
});



/**
 * POST /auth/refresh
 * Refresh access token using refresh token from cookies
 * Returns new tokens AND user data for frontend state sync
 */
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;

    // DIAGNOSTIC: Log refresh attempt
    logger.debug('[Auth Refresh] Token refresh attempt', {
        hasRefreshTokenCookie: !!refreshToken,
        cookieKeys: Object.keys(req.cookies || {}),
        userAgent: req.headers['user-agent']?.substring(0, 50)
    });

    if (!refreshToken) {
        logger.warn('[Auth Refresh] Missing refresh token cookie');
        return res.status(401).json({
            error: AUTH.SESSION_EXPIRED_PLEASE_LOGIN,
            reason: 'missing_refresh_token'
        });
    }

    // Helper to get consistent cookie options
    const getCookieOptions = (isRefresh = false) => {
        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = process.env.FRONTEND_URL?.startsWith('https');
        const sameSiteNone = isProd && isHttps;

        return {
            httpOnly: true,
            secure: sameSiteNone, // Only secure if using sameSite: none
            sameSite: sameSiteNone ? 'none' : 'lax',
            maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 1 hour for access token
            path: '/'
        };
    };

    try {
        // Get new tokens from Supabase
        logger.debug('[Auth Refresh] Calling Supabase refreshSession');
        const { tokens, userId } = await AuthService.refreshToken(refreshToken);

        // Get user profile for frontend state sync
        const user = await AuthService.getUserProfile(userId);

        const cookieOptions = getCookieOptions(false);
        const refreshOptions = getCookieOptions(true);

        res.cookie('access_token', tokens.access_token, cookieOptions);
        res.cookie('refresh_token', tokens.refresh_token, refreshOptions);

        // OPTIMIZATION: Set non-httpOnly marker cookie
        res.cookie('logged_in', 'true', {
            ...refreshOptions,
            httpOnly: false,
        });

        logger.info('[Auth Refresh] Token refresh successful', { userId });

        // Return user data along with tokens for frontend state sync
        res.json({ success: true, message: AUTH.AUTH_TOKEN_REFRESHED, user, tokens });

    } catch (error) {
        // DIAGNOSTIC: Detailed error logging
        logger.error('[Auth Refresh] Token refresh failed', {
            errorMessage: error.message,
            errorStatus: error.status,
            supabaseError: error.stack?.includes('supabase'),
            stack: error.stack
        });

        // Clear cookies with SAME options used to set them
        const cookieOptions = getCookieOptions(false);

        // ONLY clear cookies if the error is definitely an auth failure (4xx)
        // If it's a 5xx (Supabase down, network error), let the user keep their cookies and try again later.
        const isAuthError = error.status && error.status >= 400 && error.status < 500;

        // Determine user-friendly error message based on error type
        let userMessage = AUTH.SESSION_EXPIRED_PLEASE_LOGIN;
        let errorReason = 'unknown';

        if (error.message?.includes('Invalid Refresh Token') ||
            error.message?.includes('refresh token') ||
            error.message?.includes('JWT')) {
            userMessage = AUTH.REFRESH_TOKEN_EXPIRED;
            errorReason = 'invalid_or_expired_token';
            logger.warn('[Auth Refresh] Invalid or expired refresh token detected');
        } else if (error.status === 401) {
            userMessage = AUTH.SESSION_EXPIRED_PLEASE_LOGIN;
            errorReason = 'unauthorized';
        } else if (error.status >= 500) {
            userMessage = SYSTEM.INTERNAL_ERROR;
            errorReason = 'service_error';
            logger.error('[Auth Refresh] Supabase service error, not clearing cookies');
        }

        if (isAuthError) {
            logger.warn('[Auth Refresh] Clearing authentication cookies due to auth error');
            const { maxAge, ...clearOptions } = cookieOptions;
            res.clearCookie('access_token', clearOptions);
            res.clearCookie('refresh_token', clearOptions);
            res.clearCookie('logged_in', clearOptions);
        }

        res.status(error.status || 500).json({
            error: userMessage,
            reason: errorReason,
            detailed: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /auth/logout
 */
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    const accessToken = req.cookies?.access_token;

    const getCookieOptions = (isRefresh = false) => {
        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = process.env.FRONTEND_URL?.startsWith('https');
        const sameSiteNone = isProd && isHttps;

        return {
            httpOnly: true,
            secure: sameSiteNone,
            sameSite: sameSiteNone ? 'none' : 'lax',
            path: '/'
        };
    };

    const cookieOptions = getCookieOptions(false);
    const refreshOptions = getCookieOptions(true);

    const clearCookies = (response) => {
        const { maxAge: _a, ...accessClearOptions } = cookieOptions;
        const { maxAge: _r, ...refreshClearOptions } = refreshOptions;
        response.clearCookie('access_token', accessClearOptions);
        response.clearCookie('refresh_token', refreshClearOptions);
        response.clearCookie('logged_in', accessClearOptions);
    };

    try {
        await AuthService.logout(accessToken, refreshToken);
        clearCookies(res);
        logger.info({ userId: req.user?.id }, AUTH.LOG_LOGOUT_SUCCESS);
        res.json({ success: true, message: AUTH.LOGOUT_SUCCESS });

    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, AUTH.LOG_LOGOUT_ERROR);
        clearCookies(res);
        res.json({ success: true, message: AUTH.LOGOUT_SUCCESS });

    }
});

/**
 * POST /auth/send-change-password-otp
 * Send OTP for password change
 */
router.post('/send-change-password-otp', authenticateToken, async (req, res) => {
    try {
        // Check if user is Google auth - block password change
        const { data: profile } = await supabase
            .from('profiles')
            .select('authProvider')
            .eq('id', req.user.id)
            .single();

        if (profile?.auth_provider === 'GOOGLE') {
            return res.status(403).json({
                error: AUTH.GOOGLE_ONLY_VERIFICATION
            });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AuthService.sendChangePasswordOTP(req.user.email, lang);

        logger.info({ userId: req.user.id }, 'Change password OTP sent');
        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user.id }, 'Failed to send change password OTP');
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /auth/change-password
 * Change password for authenticated users
 * BLOCKED for Google auth users - they must use reset password flow
 */
router.post('/change-password', authenticateToken, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword, otp } = req.body;

    try {
        // Check if user is Google auth - block password change
        const { data: profile } = await supabase
            .from('profiles')
            .select('authProvider')
            .eq('id', req.user.id)
            .single();

        if (profile?.auth_provider === 'GOOGLE') {
            return res.status(403).json({
                error: AUTH.GOOGLE_ONLY_VERIFICATION
            });
        }

        const result = await AuthService.changePassword(
            req.user.id,
            req.user.email,
            currentPassword,
            newPassword,
            otp
        );

        res.json(result);

    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, userId: req.user.id, friendlyMessage }, AUTH.LOG_CHANGE_PASSWORD_ERROR);

        const status = error.status || 500;
        res.status(status).json({ error: friendlyMessage });
    }
});

/**
 * POST /auth/reset-password-request
 * Request a password reset email
 * Security: Always returns success (don't reveal if email exists)
 */
router.post('/reset-password-request', validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;

    try {
        const lang = req.get('x-user-lang') || 'en';
        const result = await AuthService.requestPasswordReset(email, lang);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_PASSWORD_RESET_REQUEST_ERROR);
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * GET /auth/validate-reset-token
 * Validate a password reset token before showing form
 */
router.get('/validate-reset-token', async (req, res) => {
    const { token } = req.query;

    try {
        const result = await AuthService.validateResetToken(token);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_TOKEN_VALIDATION_ERROR);
        res.status(error.status || 400).json({ error: error.message });
    }
});

/**
 * POST /auth/reset-password
 * Reset password using a valid token
 */
const resetPasswordSchema = z.object({
    token: z.string().min(1, VALIDATION.TOKEN_REQUIRED),
    newPassword: z.string()
        .min(8, VALIDATION.PASSWORD_MIN_LENGTH)
        .regex(/[a-z]/, VALIDATION.PASSWORD_LOWERCASE)
        .regex(/[A-Z]/, VALIDATION.PASSWORD_UPPERCASE)
        .regex(/[0-9]/, VALIDATION.PASSWORD_NUMBER)
        .regex(/[@$!%*?&]/, VALIDATION.PASSWORD_SPECIAL)
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const result = await AuthService.resetPassword(token, newPassword);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_PASSWORD_RESET_ERROR);
        res.status(error.status || 400).json({ error: error.message });
    }
});

module.exports = router;

