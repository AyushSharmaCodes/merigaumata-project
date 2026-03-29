const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { z } = require('zod');
const { authenticateToken, invalidateAuthCache, optionalAuth } = require('../middleware/auth.middleware');
const { authRateLimit, authSessionRateLimit } = require('../middleware/rateLimit.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const validate = require('../middleware/validate.middleware');
const { loginSchema, registerSchema, changePasswordSchema } = require('../schemas/auth.schema');
const AuthService = require('../services/auth.service');
const { supabase, supabaseAdmin } = require('../lib/supabase'); // Consolidated Supabase client usage
const { getFriendlyMessage } = require('../utils/error-messages');
const { AUTH, SYSTEM, VALIDATION } = require('../constants/messages');
const GoogleOAuthService = require('../services/google-oauth.service');
const CustomAuthService = require('../services/custom-auth.service');
const authRefreshMonitor = require('../lib/auth-refresh-monitor');
const { hashOpaqueToken } = require('../utils/app-auth');

const googleExchangeSchema = z.object({
    code: z.string().min(1),
    state: z.string().min(1)
});

function parseBooleanEnv(value) {
    if (value === undefined || value === null || value === '') return undefined;

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return undefined;
}

const getCookieOptions = (req, isRefresh = false) => {
    const isProd = process.env.NODE_ENV === 'production';
    const configuredSameSite = String(process.env.AUTH_COOKIE_SAMESITE || '').trim().toLowerCase();
    const configuredSecure = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE);
    const origin = req?.get?.('origin') || req?.headers?.origin || '';
    const forwardedProto = req?.get?.('x-forwarded-proto') || req?.headers?.['x-forwarded-proto'] || '';
    const isHttpsRequest = String(origin).startsWith('https://') || String(forwardedProto).includes('https');

    const sameSite = configuredSameSite === 'none' || configuredSameSite === 'lax' || configuredSameSite === 'strict'
        ? configuredSameSite
        : (isProd ? 'none' : 'lax');

    const secure = configuredSecure !== undefined
        ? configuredSecure
        : (isProd || sameSite === 'none' || isHttpsRequest);

    return {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
        path: '/'
    };
};

const logResolvedCookiePolicy = (req, reason) => {
    if (process.env.NODE_ENV === 'production') return;

    const accessOptions = getCookieOptions(req, false);
    const refreshOptions = getCookieOptions(req, true);
    logger.info('[Auth Cookies] Resolved auth cookie policy', {
        module: 'AuthRoutes',
        operation: 'AUTH_COOKIE_POLICY',
        context: {
            reason,
            nodeEnv: process.env.NODE_ENV,
            origin: req?.get?.('origin') || req?.headers?.origin || null,
            forwardedProto: req?.get?.('x-forwarded-proto') || req?.headers?.['x-forwarded-proto'] || null,
            configuredSameSite: process.env.AUTH_COOKIE_SAMESITE || null,
            configuredSecure: process.env.AUTH_COOKIE_SECURE || null,
            access: {
                sameSite: accessOptions.sameSite,
                secure: accessOptions.secure,
                maxAge: accessOptions.maxAge
            },
            refresh: {
                sameSite: refreshOptions.sameSite,
                secure: refreshOptions.secure,
                maxAge: refreshOptions.maxAge
            }
        }
    });
};

const setAuthCookies = (req, res, accessToken, refreshToken) => {
    logResolvedCookiePolicy(req, 'set_auth_cookies');
    const cookieOptions = getCookieOptions(req, false);
    const refreshOptions = getCookieOptions(req, true);

    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('refresh_token', refreshToken, refreshOptions);
    res.cookie('logged_in', 'true', {
        ...refreshOptions,
        httpOnly: false
    });
};

const clearAuthCookies = (req, res) => {
    logResolvedCookiePolicy(req, 'clear_auth_cookies');
    const cookieOptions = getCookieOptions(req, false);
    const refreshOptions = getCookieOptions(req, true);
    const { maxAge: _accessMaxAge, ...accessClearOptions } = cookieOptions;
    const { maxAge: _refreshMaxAge, ...refreshClearOptions } = refreshOptions;

    res.clearCookie('access_token', accessClearOptions);
    res.clearCookie('refresh_token', refreshClearOptions);
    res.clearCookie('logged_in', {
        ...refreshClearOptions,
        httpOnly: false
    });
};

const getSessionMetadata = (req) => ({
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null
});

const getRefreshLockOperation = (req) => {
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;

    if (!refreshToken) {
        return 'auth-refresh';
    }

    return `auth-refresh:${hashOpaqueToken(refreshToken)}`;
};

const clearGoogleOauthCookies = (req, res) => {
    logResolvedCookiePolicy(req, 'clear_google_oauth_cookies');
    const cookieOptions = getCookieOptions(req, true);
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions;

    res.clearCookie('google_oauth_state', clearOptions);
    res.clearCookie('google_oauth_nonce', clearOptions);
    res.clearCookie('google_oauth_code_verifier', clearOptions);
};


// NOTE: /auth/me endpoint REMOVED
// Session initialization is cookie/app-token based on the frontend
// /auth/refresh returns user data for state sync after token refresh

router.get('/google/authorize', async (req, res) => {
    try {
        const authRequest = GoogleOAuthService.createAuthorizationRequest();
        const cookieOptions = getCookieOptions(req, true);

        res.cookie('google_oauth_state', authRequest.state, {
            ...cookieOptions,
            maxAge: 10 * 60 * 1000
        });
        res.cookie('google_oauth_nonce', authRequest.nonce, {
            ...cookieOptions,
            maxAge: 10 * 60 * 1000
        });
        res.cookie('google_oauth_code_verifier', authRequest.codeVerifier, {
            ...cookieOptions,
            maxAge: 10 * 60 * 1000
        });

        res.json({ url: authRequest.url });
    } catch (error) {
        logger.error({ err: error }, '[AuthRoutes] Google authorize failed');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.post('/google/exchange', authRateLimit, requestLock('auth-google-exchange'), idempotency(), validate(googleExchangeSchema), async (req, res) => {
    const { code, state } = req.body;
    const guestId = req.headers['x-guest-id'];

    try {
        const expectedState = req.cookies?.google_oauth_state;
        const expectedNonce = req.cookies?.google_oauth_nonce;
        const codeVerifier = req.cookies?.google_oauth_code_verifier;

        if (!expectedState || !expectedNonce || !codeVerifier || expectedState !== state) {
            return res.status(401).json({ error: AUTH.INVALID_SESSION });
        }

        const googleProfile = await GoogleOAuthService.exchangeCode({
            code,
            codeVerifier,
            expectedNonce
        });

        const { user, tokens } = await AuthService.authenticateGoogleUser(googleProfile, guestId, getSessionMetadata(req));
        setAuthCookies(req, res, tokens.access_token, tokens.refresh_token);

        clearGoogleOauthCookies(req, res);

        res.json({
            success: true,
            message: AUTH.LOGIN_SUCCESS,
            user,
            tokens
        });
    } catch (error) {
        logger.error({ err: error }, '[AuthRoutes] Google exchange failed');
        clearGoogleOauthCookies(req, res);
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /auth/check-email
 * Check if email exists in the system
 */
router.post('/check-email', authRateLimit, validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;
    try {
        const exists = await AuthService.checkEmailExists(email);
        res.json({ exists, email });
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_CHECK_EMAIL_ERROR);
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /auth/sync
 * Sync Supabase Session (e.g. from Google OAuth) with Backend Cookies
 */
router.post('/sync', authSessionRateLimit, requestLock('auth-sync-session'), idempotency(), validate(z.object({ access_token: z.string(), refresh_token: z.string() })), async (req, res) => {
    const { access_token, refresh_token } = req.body;
    const guestId = req.headers['x-guest-id'];
    logger.info({ email: req.body.email }, AUTH.LOG_SYNC_REQUEST_RECEIVED);

    try {
        const user = await AuthService.syncSession(access_token, guestId);

        setAuthCookies(req, res, access_token, refresh_token);

        res.json({ success: true, message: AUTH.AUTH_SESSION_SYNCED, user });


    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_SESSION_SYNC_ERROR);
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

/**
 * POST /auth/validate-credentials
 * Validate email + password before sending OTP (for login flow)
 */
router.post('/validate-credentials', authRateLimit, validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const guestId = req.headers['x-guest-id'];

    try {
        const lang = req.get('x-user-lang') || 'en';
        const otpResult = await AuthService.validateCredentials(email, password, guestId, lang);

        if (!otpResult.success) {
            logger.warn({ email, guestId, otpResult }, AUTH.LOG_CREDENTIALS_VALIDATION_FAILED);
            return res.status(otpResult.retryAfter ? 429 : (otpResult.status || 400)).json(otpResult);
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
router.post('/resend-confirmation', authRateLimit, requestLock((req) => `auth-resend-confirmation:${req.body.email || 'unknown'}`), idempotency(), validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;
    try {
        const result = await AuthService.resendConfirmationEmail(email);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_RESEND_CONFIRMATION_ERROR);
        res.status(error.status || 400).json({
            error: getFriendlyMessage(error, error.status || 400),
            code: error.code
        });
    }
});

/**
 * POST /auth/register
 * Complete registration after OTP verification
 */
router.post('/register', authRateLimit, requestLock((req) => `auth-register:${req.body.email || 'unknown'}`), idempotency(), validate(registerSchema), async (req, res) => {
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
        res.status(error.status || 500).json({ error: friendlyMessage, code: error.code });
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
router.post('/verify-login-otp', authRateLimit, requestLock((req) => `auth-verify-login-otp:${req.body.email || 'unknown'}`), idempotency(), validate(z.object({ email: z.string().email(), otp: z.string() })), async (req, res) => {
    const { email, otp } = req.body;

    try {
        const { user, tokens } = await AuthService.verifyLoginOtp(email, otp, getSessionMetadata(req));
        setAuthCookies(req, res, tokens.access_token, tokens.refresh_token);

        logger.info({ email, userId: user.id }, AUTH.LOG_LOGIN_SUCCESS);
        res.json({
            success: true,
            message: AUTH.LOGIN_SUCCESS,

            user,
            tokens
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error, error.status || 400);
        logger.error({ err: error, email, friendlyMessage }, AUTH.LOG_VERIFY_LOGIN_OTP_ERROR);
        res.status(error.status || 400).json({
            error: friendlyMessage,
            code: error.code,
            attemptsRemaining: error.attemptsRemaining
        });
    }
});



/**
 * POST /auth/refresh
 * Refresh access token using refresh token from cookies
 * Returns new tokens AND user data for frontend state sync
 */
router.post('/refresh', authSessionRateLimit, requestLock(getRefreshLockOperation), idempotency(), async (req, res) => {
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
    const correlationId = req.correlationId || req.headers['x-correlation-id'] || req.id || 'unknown';
    const isFromCookie = !!req.cookies?.refresh_token;
    const optionalUnauthenticated = req.body?.optional === true;

    // DIAGNOSTIC: Log refresh attempt
    logger.debug('[Auth Refresh] Token refresh attempt', {
        module: 'AuthRoutes',
        operation: 'REFRESH_ATTEMPT',
        hasRefreshTokenCookie: isFromCookie,
        hasRefreshTokenBody: !!req.body?.refresh_token,
        cookieKeys: Object.keys(req.cookies || {}),
        userAgent: req.headers['user-agent']?.substring(0, 50),
        correlationId
    });
    void authRefreshMonitor.recordAttempt({
        correlationId,
        hasRefreshTokenCookie: isFromCookie
    });

    if (!refreshToken) {
        if (optionalUnauthenticated) {
            logger.debug('[Auth Refresh] Optional refresh found no active session', {
                module: 'AuthRoutes',
                operation: 'REFRESH_OPTIONAL_NO_SESSION',
                correlationId,
                hasAccessTokenCookie: !!req.cookies?.access_token
            });

            return res.status(200).json({
                success: true,
                authenticated: false,
                reason: 'no_active_session'
            });
        }

        logger.warn('[Auth Refresh] Missing refresh token cookie', {
            module: 'AuthRoutes',
            operation: 'REFRESH_MISSING_COOKIE',
            correlationId,
            hasAccessTokenCookie: !!req.cookies?.access_token,
            cookieKeys: Object.keys(req.cookies || {})
        });
        void authRefreshMonitor.recordMissingCookie({
            correlationId,
            hasAccessTokenCookie: !!req.cookies?.access_token
        });
        return res.status(401).json({
            error: AUTH.SESSION_EXPIRED_PLEASE_LOGIN,
            reason: 'missing_refresh_token'
        });
    }

    try {
        // Get new tokens from Supabase
        logger.debug('[Auth Refresh] Refreshing custom auth session', {
            module: 'AuthRoutes',
            operation: 'REFRESH_EXECUTE',
            correlationId
        });
        const { tokens, userId } = await AuthService.refreshToken(refreshToken, getSessionMetadata(req));

        // Get user profile for frontend state sync
        const user = await AuthService.getUserProfile(userId);

        setAuthCookies(req, res, tokens.access_token, tokens.refresh_token);

        logger.info('[Auth Refresh] Token refresh successful', {
            module: 'AuthRoutes',
            operation: 'REFRESH_SUCCESS',
            userId,
            correlationId,
            rotatedRefreshToken: tokens.refresh_token !== refreshToken
        });
        void authRefreshMonitor.recordSuccess({
            correlationId,
            userId,
            rotatedRefreshToken: tokens.refresh_token !== refreshToken
        });

        // Return user data along with tokens for frontend state sync
        res.json({ success: true, message: AUTH.AUTH_TOKEN_REFRESHED, user, tokens });

    } catch (error) {
        // DIAGNOSTIC: Detailed error logging
        logger.error('[Auth Refresh] Token refresh failed', {
            module: 'AuthRoutes',
            operation: 'REFRESH_FAILURE',
            errorMessage: error.message,
            errorStatus: error.status,
            supabaseError: error.stack?.includes('supabase'),
            stack: error.stack,
            correlationId
        });

        // Clear cookies with SAME options used to set them
        // ONLY clear cookies if the error is definitely an auth failure (4xx)
        // If it's a 5xx (Supabase down, network error), let the user keep their cookies and try again later.
        const shouldClearCookies = error.status === 401 || error.status === 403 || error.status === 410;

        // Determine user-friendly error message based on error type
        let userMessage = AUTH.SESSION_EXPIRED_PLEASE_LOGIN;
        let errorReason = 'unknown';

        if (error.message?.includes('Invalid Refresh Token') ||
            error.message?.includes('refresh token') ||
            error.message?.includes('JWT')) {
            userMessage = AUTH.REFRESH_TOKEN_EXPIRED;
            errorReason = 'invalid_or_expired_token';
            logger.warn('[Auth Refresh] Invalid or expired refresh token detected', {
                module: 'AuthRoutes',
                operation: 'REFRESH_INVALID_TOKEN',
                correlationId,
                errorStatus: error.status
            });
        } else if (error.status === 401) {
            userMessage = AUTH.SESSION_EXPIRED_PLEASE_LOGIN;
            errorReason = 'unauthorized';
        } else if (error.status >= 500) {
            userMessage = SYSTEM.INTERNAL_ERROR;
            errorReason = 'service_error';
            logger.error('[Auth Refresh] Session service error, not clearing cookies', {
                module: 'AuthRoutes',
                operation: 'REFRESH_SERVICE_ERROR',
                correlationId,
                errorStatus: error.status
            });
        } else if (error.status === 409) {
            userMessage = 'A similar operation is already in progress. Please wait for it to complete.';
            errorReason = 'concurrent_refresh';
        }

        if (shouldClearCookies) {
            logger.warn('[Auth Refresh] Clearing authentication cookies due to auth error', {
                module: 'AuthRoutes',
                operation: 'REFRESH_CLEAR_COOKIES',
                correlationId,
                errorReason
            });
            clearAuthCookies(req, res);
        }

        void authRefreshMonitor.recordFailure(errorReason, {
            correlationId,
            status: error.status || 500
        });

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
router.post('/logout', authSessionRateLimit, requestLock('auth-logout'), idempotency(), async (req, res) => {
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
    const accessToken = req.cookies?.access_token;

    try {
        await AuthService.logout(accessToken, refreshToken);
        clearAuthCookies(req, res);
        logger.info({ userId: req.user?.id }, AUTH.LOG_LOGOUT_SUCCESS);
        res.json({ success: true, message: AUTH.LOGOUT_SUCCESS });

    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, AUTH.LOG_LOGOUT_ERROR);
        clearAuthCookies(req, res);
        res.json({ success: true, message: AUTH.LOGOUT_SUCCESS });

    }
});

/**
 * POST /auth/send-change-password-otp
 * Send OTP for password change
 */
router.post('/send-change-password-otp', authSessionRateLimit, authenticateToken, requestLock('auth-send-change-password-otp'), idempotency(), async (req, res) => {
    try {
        // Check if user is Google auth - block password change
        const { data: profile } = await supabase
            .from('profiles')
            .select('auth_provider')
            .eq('id', req.user.id)
            .single();

        const hasPassword = await CustomAuthService.hasPasswordByUserId(req.user.id);
        if (profile?.auth_provider === 'GOOGLE' && !hasPassword) {
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
        res.status(error.status || 500).json({
            error: getFriendlyMessage(error, error.status || 500),
            code: error.code
        });
    }
});

/**
 * POST /auth/change-password
 * Change password for authenticated users
 * BLOCKED for Google auth users - they must use reset password flow
 */
router.post('/change-password', authSessionRateLimit, authenticateToken, requestLock('auth-change-password'), idempotency(), validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword, otp } = req.body;

    try {
        // Check if user is Google auth - block password change
        const { data: profile } = await supabase
            .from('profiles')
            .select('auth_provider')
            .eq('id', req.user.id)
            .single();

        const hasPassword = await CustomAuthService.hasPasswordByUserId(req.user.id);
        if (profile?.auth_provider === 'GOOGLE' && !hasPassword) {
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
        res.status(status).json({ error: friendlyMessage, code: error.code });
    }
});

/**
 * POST /auth/reset-password-request
 * Request a password reset email
 * Security: Always returns success (don't reveal if email exists)
 */
router.post('/reset-password-request', authRateLimit, requestLock((req) => `auth-reset-password-request:${req.body.email || 'unknown'}`), idempotency(), validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;

    try {
        const lang = req.get('x-user-lang') || 'en';
        const result = await AuthService.requestPasswordReset(email, lang);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_PASSWORD_RESET_REQUEST_ERROR);
        res.status(error.status || 500).json({
            error: getFriendlyMessage(error, error.status || 500),
            code: error.code
        });
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
        res.status(error.status || 400).json({
            error: getFriendlyMessage(error, error.status || 400),
            code: error.code
        });
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

router.post('/reset-password', authRateLimit, requestLock('auth-reset-password'), idempotency(), validate(resetPasswordSchema), async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const result = await AuthService.resetPassword(token, newPassword);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, AUTH.LOG_PASSWORD_RESET_ERROR);
        res.status(error.status || 400).json({
            error: getFriendlyMessage(error, error.status || 400),
            code: error.code
        });
    }
});

module.exports = router;
