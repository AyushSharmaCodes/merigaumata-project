const { supabase, supabaseAdmin } = require('../lib/supabase');
const logger = require('../utils/logger');
const { cleanupOrphanedUser } = require('../utils/cleanup');
const { sendOTP, verifyOTP } = require('./otp.service');
const CartService = require('./cart.service');
const crypto = require('crypto');
const phoneValidator = require('../utils/phone-validator');
const emailService = require('./email');
const { invalidateAuthCache } = require('../middleware/auth.middleware');
const { AUTH, SYSTEM } = require('../constants/messages');
const CustomAuthService = require('./custom-auth.service');
const {
    APP_REFRESH_TOKEN_TTL_MS,
    createAppAccessToken,
    generateOpaqueToken,
    hashOpaqueToken,
    isAppAccessToken,
    verifyAppAccessToken
} = require('../utils/app-auth');

// Encryption Keys - MUST be set in environment
if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is required for token encryption. Please set this in your .env file or environment configuration.');
}

const APP_REFRESH_TOKEN_TABLE = 'app_refresh_tokens';

class AuthService {
    static async cleanupRefreshTokensForUser(userId) {
        const nowIso = new Date().toISOString();

        await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .delete()
            .eq('user_id', userId)
            .lt('expires_at', nowIso);

        const { data: activeTokens, error } = await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .select('id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error || !activeTokens || activeTokens.length <= 5) {
            return;
        }

        const staleTokenIds = activeTokens.slice(5).map((token) => token.id);
        if (!staleTokenIds.length) {
            return;
        }

        await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .delete()
            .in('id', staleTokenIds);
    }

    static async findProfileByRefreshToken(refreshToken) {
        const tokenHash = hashOpaqueToken(refreshToken);
        const { data: tokenRecord, error } = await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .select('id, user_id, expires_at, revoked_at')
            .eq('token', tokenHash)
            .maybeSingle();

        if (error || !tokenRecord) {
            const authError = new Error(AUTH.INVALID_REFRESH_TOKEN);
            authError.status = 401;
            authError.code = 'APP_REFRESH_TOKEN_NOT_FOUND';
            throw authError;
        }

        if (tokenRecord.revoked_at) {
            const authError = new Error(AUTH.INVALID_REFRESH_TOKEN);
            authError.status = 401;
            authError.code = 'APP_REFRESH_TOKEN_REVOKED';
            throw authError;
        }

        if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
            await supabaseAdmin.from(APP_REFRESH_TOKEN_TABLE).delete().eq('id', tokenRecord.id);
            const authError = new Error(AUTH.REFRESH_TOKEN_EXPIRED || AUTH.INVALID_REFRESH_TOKEN);
            authError.status = 401;
            throw authError;
        }

        return tokenRecord;
    }

    static async issueAppSession(userId, sessionMetadata = {}) {
        const user = await this.getUserProfile(userId);
        await this.cleanupRefreshTokensForUser(userId);
        const refreshToken = generateOpaqueToken();
        const refreshTokenHash = hashOpaqueToken(refreshToken);
        const refreshExpiry = new Date(Date.now() + APP_REFRESH_TOKEN_TTL_MS).toISOString();

        const { error } = await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .insert({
                user_id: userId,
                token: refreshTokenHash,
                expires_at: refreshExpiry,
                last_used_at: new Date().toISOString(),
                user_agent: sessionMetadata.userAgent || null,
                ip_address: sessionMetadata.ipAddress || null
            });

        if (error) {
            throw error;
        }

        const accessToken = createAppAccessToken({
            sub: userId,
            email: user.email,
            role: user.role,
            auth_provider: user.authProvider || 'GOOGLE'
        });

        return {
            user,
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken
            }
        };
    }

    static async refreshAppSession(refreshToken, sessionMetadata = {}) {
        const tokenRecord = await this.findProfileByRefreshToken(refreshToken);
        const user = await this.getUserProfile(tokenRecord.user_id);
        const nextExpiry = new Date(Date.now() + APP_REFRESH_TOKEN_TTL_MS).toISOString();

        const { error } = await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .update({
                expires_at: nextExpiry,
                last_used_at: new Date().toISOString(),
                user_agent: sessionMetadata.userAgent || null,
                ip_address: sessionMetadata.ipAddress || null
            })
            .eq('id', tokenRecord.id);

        if (error) {
            throw error;
        }

        return {
            userId: user.id,
            tokens: {
                access_token: createAppAccessToken({
                    sub: user.id,
                    email: user.email,
                    role: user.role,
                    auth_provider: user.authProvider || 'GOOGLE'
                }),
                refresh_token: refreshToken
            }
        };
    }

    static async upsertGoogleUser({ email, name, givenName, familyName, avatarUrl, googleId }) {
        const normalizedEmail = email.toLowerCase().trim();
        let userId = null;

        const { data: existingGoogleIdentity, error: identityLookupError } = await supabaseAdmin
            .from('auth_identities')
            .select('user_id')
            .eq('provider', 'GOOGLE')
            .eq('provider_email', normalizedEmail)
            .maybeSingle();

        if (identityLookupError) {
            throw identityLookupError;
        }

        const { data: roleData } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'customer')
            .single();

        const firstName = givenName || name.trim().split(' ')[0];
        const lastName = familyName || (name.trim().split(' ').length > 1 ? name.trim().split(' ').slice(1).join(' ') : null);

        if (existingGoogleIdentity?.user_id) {
            userId = existingGoogleIdentity.user_id;
        } else {
            const { data: existingProfileByEmail, error: existingProfileError } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (existingProfileError) {
                throw existingProfileError;
            }

            userId = existingProfileByEmail?.id || crypto.randomUUID();
        }

        const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
            .from('profiles')
            .select('id, role_id, phone_verified, is_deleted, deletion_status, welcome_sent')
            .eq('id', userId)
            .maybeSingle();

        if (profileLookupError) {
            throw profileLookupError;
        }

        const profilePayload = {
            id: userId,
            email: normalizedEmail,
            name,
            first_name: firstName,
            last_name: lastName,
            avatar_url: avatarUrl,
            role_id: existingProfile?.role_id || roleData?.id,
            preferred_language: 'en',
            email_verified: true,
            phone_verified: existingProfile?.phone_verified || false,
            auth_provider: 'GOOGLE',
            is_deleted: false,
            deletion_status: 'ACTIVE'
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' });

        if (profileError) {
            throw profileError;
        }

        await CustomAuthService.upsertGoogleIdentity({
            userId,
            email: normalizedEmail,
            googleId: googleId || normalizedEmail
        });

        if (!existingProfile || existingProfile.is_deleted || existingProfile.deletion_status === 'DELETION_IN_PROGRESS') {
            this.triggerWelcomeEmail({ id: userId, email: normalizedEmail }, name, existingProfile ? 'google_reactivation' : 'google_signup');
        }

        return userId;
    }

    static async authenticateGoogleUser(googleProfile, guestId, sessionMetadata = {}) {
        const userId = await this.upsertGoogleUser(googleProfile);

        if (guestId) {
            try {
                await CartService.mergeGuestCart(userId, guestId);
            } catch (err) {
                logger.error({ err, userId }, AUTH.LOG_GUEST_CART_MERGE_FAILED);
            }
        }

        return this.issueAppSession(userId, sessionMetadata);
    }

    static async createEmailVerificationToken(userId) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: tokenExpiry.toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            throw updateError;
        }

        if (!process.env.FRONTEND_URL) {
            throw new Error('FRONTEND_URL environment variable is required for email verification');
        }

        return {
            verificationToken,
            tokenExpiry,
            verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
        };
    }

    static async sendCustomVerificationEmail({ userId, email, name, lang = 'en' }) {
        const { verificationLink } = await this.createEmailVerificationToken(userId);
        const result = await emailService.sendEmailConfirmation(email, {
            name,
            email,
            verificationLink
        }, { userId, lang });

        if (!result?.success) {
            throw new Error(result?.error || AUTH.VERIFICATION_EMAIL_FAILED);
        }

        return { success: true, verificationLink };
    }

    /**
     * Get user profile by ID
     */
    static async getUserProfile(userId) {
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('*, roles(name)')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            throw new Error(AUTH.USER_NOT_FOUND);

        }

        return {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            phone: profile.phone,
            name: profile.name,
            role: profile.roles?.name || 'customer',
            language: profile.preferred_language, // Expose as language for consumers
            preferred_language: profile.preferred_language,
            preferredCurrency: profile.preferred_currency || 'INR',
            preferred_currency: profile.preferred_currency || 'INR',
            emailVerified: profile.email_verified,
            phoneVerified: profile.phone_verified,
            mustChangePassword: profile.must_change_password,
            authProvider: profile.auth_provider || 'LOCAL',
            deletionStatus: profile.deletion_status,
            scheduledDeletionAt: profile.scheduled_deletion_at
        };
    }

    /**
     * Check if email exists
     */
    static async checkEmailExists(email) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .eq('is_deleted', false)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    }

    /**
     * Sync Session (Exchange Token for Cookies)
     */
    static async syncSession(accessToken, guestId) {
        try {
            let claims;
            try {
                claims = verifyAppAccessToken(accessToken);
            } catch (error) {
                logger.error({ err: error }, AUTH.LOG_SESSION_VALIDATION_FAILED);
                const err = new Error(AUTH.INVALID_SESSION);
                err.status = 401;
                throw err;
            }

            let { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('is_deleted, deletion_status, scheduled_deletion_at')
                .eq('id', claims.sub)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                logger.error({ err: profileError, userId: claims.sub }, AUTH.LOG_PROFILE_LOOKUP_FAILED);
                throw profileError;
            }

            if (!profile) {
                const err = new Error(AUTH.USER_NOT_FOUND);
                err.status = 404;
                throw err;
            }

            if (profile?.is_deleted || profile?.deletion_status === 'DELETION_IN_PROGRESS') {
                logger.info({ userId: claims.sub }, AUTH.LOG_PROFILE_REACTIVATION_SYNC);

                const { error: reactivateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        is_deleted: false,
                        deletion_status: 'ACTIVE',
                        deleted_at: null
                    })
                    .eq('id', claims.sub);

                if (reactivateError) {
                    logger.error({ err: reactivateError, userId: claims.sub }, AUTH.LOG_REACTIVATION_FAILED);
                    const err = new Error(AUTH.REACTIVATION_FAILED);
                    err.status = 500;
                    throw err;
                }

                supabaseAdmin
                    .from('account_deletion_jobs')
                    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
                    .eq('user_id', claims.sub)
                    .in('status', ['PENDING', 'IN_PROGRESS'])
                    .then(({ error }) => {
                        if (error) logger.warn({ err: error, userId: claims.sub }, AUTH.LOG_DELETION_CANCEL_FAILED);
                    })
                    .catch(err => logger.warn({ err, userId: claims.sub }, '[AuthService] deletion_job_cancellation_error'));
            }

            if (guestId) {
                try {
                    await CartService.mergeGuestCart(claims.sub, guestId);
                    logger.info({ userId: claims.sub }, AUTH.LOG_GUEST_CART_MERGED);
                } catch (err) {
                    logger.error({ err }, AUTH.LOG_GUEST_CART_MERGE_FAILED);
                }
            }

            logger.info({ userId: claims.sub }, AUTH.LOG_SYNC_FINALIZING);
            return await this.getUserProfile(claims.sub);
        } catch (error) {
            if (error.status) throw error;
            logger.error({ err: error }, AUTH.LOG_UNEXPECTED_SYNC_ERROR);
            const err = new Error(error.message || AUTH.SYNC_FAILED);

            err.status = 500;
            throw err;
        }
    }

    /**
     * Helper to trigger welcome emails safely and update the welcome_sent flag
     */
    static async triggerWelcomeEmail(user, name, source) {
        try {
            // First check if already sent - belt and suspenders
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('welcome_sent, name, email')
                .eq('id', user.id)
                .single();

            if (profileError) {
                logger.warn({ err: profileError, userId: user.id, source }, AUTH.LOG_WELCOME_LOOKUP_FAILED);
                // If the column doesn't exist yet, we don't want to crash. 
                // But we also don't want to spam if it's a real error.
                if (profileError.code !== '42703') {
                    return;
                }
            }

            if (profile?.welcome_sent !== false) {
                // If true, we already sent it. 
                // If undefined, either the user is missing or the column is missing (migration not run).
                // In either case, we should skip to avoid spam or errors.
                if (profile?.welcome_sent === true) {
                    logger.info({ userId: user.id, source }, AUTH.LOG_WELCOME_ALREADY_SENT);
                } else {
                    logger.info({ userId: user.id, source }, AUTH.LOG_WELCOME_SKIPPED_MISSING);
                }
                return;
            }

            const finalName = name || profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || AUTH.DEFAULT_USER_NAME;

            logger.info({ userId: user.id, email: user.email, name: finalName, source }, AUTH.LOG_WELCOME_INIT);

            // Send email
            await emailService.sendRegistrationEmail(user.email, { name: finalName, email: user.email });

            // Update database flag
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ welcome_sent: true })
                .eq('id', user.id);

            if (updateError) {
                logger.error({ err: updateError, userId: user.id }, AUTH.LOG_WELCOME_FLAG_UPDATE_FAILED);
            }
        } catch (eErr) {
            logger.error({ err: eErr, userId: user.id, source }, AUTH.LOG_WELCOME_ERROR);
        }
    }

    /**
     * Validate Credentials & Send OTP (Step 1 of Login)
     */
    static async validateCredentials(email, password, guestId, lang = 'en') {
        const normalizedEmail = email.toLowerCase().trim();
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, is_blocked, is_deleted, email_verified, auth_provider')
            .eq('email', normalizedEmail)
            .single();

        if (profileError || !profile) {
            return { success: false, error: AUTH.ACCOUNT_NOT_FOUND, code: 'ACCOUNT_NOT_FOUND', status: 404 };

        }

        if (profile.is_deleted) {
            return {
                success: false,
                error: AUTH.ACCOUNT_DELETED,
                code: 'ACCOUNT_DELETED',
                status: 403
            };
        }

        if (profile.is_blocked) {
            return { success: false, error: AUTH.ACCOUNT_BLOCKED, code: 'ACCOUNT_BLOCKED', status: 403 };

        }

        if (!profile.email_verified) {
            return { success: false, error: AUTH.EMAIL_NOT_CONFIRMED, code: 'EMAIL_NOT_CONFIRMED', status: 403 };
        }

        const authAccount = await CustomAuthService.getAuthAccountByEmail(normalizedEmail);
        if (profile.auth_provider === 'GOOGLE' && !authAccount?.password_hash) {
            return { success: false, error: AUTH.GOOGLE_SIGNIN_REQUIRED, code: 'GOOGLE_SIGNIN_REQUIRED', status: 400 };
        }
        const passwordValid = await CustomAuthService.verifyPassword(password, authAccount?.password_hash);

        if (!passwordValid) {
            return { success: false, error: AUTH.INVALID_PASSWORD, code: 'INVALID_PASSWORD', status: 401 };

        }

        return await sendOTP(normalizedEmail, { userId: profile.id, guestId }, lang);
    }

    /**
     * Verify Login OTP & Return Tokens
     */
    static async verifyLoginOtp(email, otp, sessionMetadata = {}) {
        const normalizedEmail = email.toLowerCase().trim();
        // 1. Verify OTP
        const otpResult = await verifyOTP(normalizedEmail, otp);

        if (!otpResult.success) {
            const error = new Error(otpResult.error);
            error.status = 400;
            error.attemptsRemaining = otpResult.attemptsRemaining;
            error.code = otpResult.error === 'errors.auth.otpExpired' ? 'OTP_EXPIRED' : 'INVALID_OTP';
            throw error;
        }

        let userId = otpResult.metadata?.userId;
        if (!userId) {
            const { data: profileByEmail, error: profileLookupError } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('email', normalizedEmail)
                .single();

            if (profileLookupError || !profileByEmail?.id) {
                const error = new Error(AUTH.SESSION_EXPIRED_OR_INVALID);
                error.status = 401;
                throw error;
            }

            userId = profileByEmail.id;
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*, roles(name)')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            const error = new Error(AUTH.USER_NOT_FOUND);
            error.status = 404;
            throw error;

        }

        // 5. Merge Guest Cart if guestId provided (AWAITED to prevent race conditions during checkout redirect)
        if (otpResult.metadata?.guestId) {
            try {
                await CartService.mergeGuestCart(profile.id, otpResult.metadata.guestId);
                logger.info({ userId: profile.id }, AUTH.LOG_GUEST_CART_MERGED);
            } catch (err) {
                logger.error({ err }, AUTH.LOG_GUEST_CART_MERGE_FAILED);
            }
        }

        try {
            await CustomAuthService.touchLastLogin(profile.id);
            const { tokens } = await this.issueAppSession(profile.id, sessionMetadata);

            return {
                user: {
                    id: profile.id,
                    email: profile.email,
                    phone: profile.phone,
                    name: profile.name,
                    role: profile.roles?.name || 'customer',
                    emailVerified: profile.email_verified,
                    mustChangePassword: profile.must_change_password
                },
                tokens
            };
        } catch (sessionError) {
            logger.error({ err: sessionError, userId: profile.id }, '[AuthService] Failed to issue app session after OTP verification');
            const error = new Error(AUTH.RESTORE_SESSION_FAILED);
            error.status = 500;
            throw error;
        }
    }



    /**
     * Register User
     */
    static async registerUser({ email, password, name, phone, isOtpVerified, lang = 'en' }) {
        logger.info({ email, name, phone }, AUTH.LOG_REGISTRATION_REQUEST);
        const normalizedEmail = email.toLowerCase().trim();
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, is_deleted')
            .eq('email', normalizedEmail)
            .eq('is_deleted', false)
            .single();

        if (existingProfile) {
            if (existingProfile.is_deleted) {
                const error = new Error(AUTH.ACCOUNT_DELETED);

                error.status = 403;
                error.code = 'ACCOUNT_DELETED';
                throw error;
            }
            const error = new Error(AUTH.ACCOUNT_ALREADY_EXISTS);
            error.status = 400;
            error.code = 'ACCOUNT_ALREADY_EXISTS';
            throw error;
        }

        // Cleanup orphans
        try {
            await cleanupOrphanedUser(email);
        } catch (cleanupError) {
            logger.warn({ err: cleanupError }, AUTH.LOG_CLEANUP_WARNING);
        }

        // Validate phone number if provided
        if (phone) {
            logger.info({ phone }, AUTH.LOG_CALLING_PHONE_VALIDATOR);
            const validationResult = await phoneValidator.validate(phone);
            if (!validationResult.isValid) {
                const error = new Error(validationResult.error);
                error.status = 400;
                throw error;
            }
        }

        // 1. Create Supabase Auth User
        const userId = crypto.randomUUID();

        // 2. Get Role
        const { data: roleData } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'customer')
            .single();

        // 3. Create Profile
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert([{
                id: userId,
                email: normalizedEmail,
                phone: phone || null,
                name,
                first_name: firstName,
                last_name: lastName,
                role_id: roleData?.id,
                preferred_language: 'en',
                email_verified: isOtpVerified,
                phone_verified: false,
                is_deleted: false,
                auth_provider: 'LOCAL'
            }], { onConflict: 'id' });

        if (profileError) {
            throw new Error(AUTH.PROFILE_CREATE_FAILED);

        }

        await CustomAuthService.upsertLocalAccount({
            userId,
            email: normalizedEmail,
            password
        });

        // 4. Send custom verification email
        this.sendCustomVerificationEmail({
            userId,
            email: normalizedEmail,
            name,
            lang
        }).catch(err =>
            logger.error({ err }, AUTH.LOG_SEND_CONFIRMATION_EMAIL_FAILED)
        );

        return {
            id: userId,
            email: normalizedEmail,
            phone: phone || null,
            name,
            role: 'customer',
            emailVerified: false
        };
    }
    /**
     * Verify Email Token
     */
    static async verifyEmail(token) {
        if (!token) throw new Error(AUTH.VERIFICATION_TOKEN_REQUIRED);


        let { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, welcome_sent, email_verification_token, email_verification_expires')
            .eq('email_verification_token', token)
            .single();

        if (findError && findError.code === '42703') {
            // FALLBACK: retry without welcome_sent
            const fallback = await supabaseAdmin
                .from('profiles')
                .select('id, email, name, email_verification_token, email_verification_expires')
                .eq('email_verification_token', token)
                .single();
            profile = fallback.data;
            findError = fallback.error;
        }

        if (findError || !profile) {
            const error = new Error(AUTH.INVALID_VERIFICATION_LINK);

            error.status = 400;
            throw error;
        }

        if (new Date(profile.email_verification_expires) < new Date()) {
            const error = new Error(AUTH.VERIFICATION_LINK_EXPIRED);

            error.status = 400;
            throw error;
        }

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                email_verified: true,
                email_verification_token: null,
                email_verification_expires: null
            })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        // Send Welcome Email after first verification, using triggerWelcomeEmail for consistency/flag logic
        const mockUser = { id: profile.id, email: profile.email };
        this.triggerWelcomeEmail(mockUser, profile.name, 'verify_email');

        logger.info({ userId: profile.id }, AUTH.LOG_EMAIL_VERIFIED);
        return true;
    }

    /**
     * Refresh Token
     * 
     * CRITICAL: This method handles session persistence when access token expires.
     * Called when frontend interceptor catches 401 and attempts refresh.
     * Returns: new tokens + userId for fetching user profile
     * 
     * Flow:
     * 1. Access token expired → frontend gets 401
     * 2. Interceptor calls /auth/refresh with refresh_token cookie
     * 3. This method uses Supabase to get new session
     * 4. Route sets new cookies and returns user data
     * 5. User remains logged in seamlessly
     */
    static async refreshToken(oldRefreshToken, sessionMetadata = {}) {
        if (!oldRefreshToken) {
            // WHY: No refresh token = user never logged in or cookies were cleared
            const error = new Error(AUTH.REFRESH_TOKEN_REQUIRED);

            error.status = 401;
            throw error;
        }

        return this.refreshAppSession(oldRefreshToken, sessionMetadata);
    }

    /**
     * Logout
     */
    static async logout(accessToken, refreshToken) {
        if (refreshToken) {
            try {
                await supabaseAdmin
                    .from(APP_REFRESH_TOKEN_TABLE)
                    .delete()
                    .eq('token', hashOpaqueToken(refreshToken));
            } catch (err) {
                logger.warn({ err }, '[AuthService] Failed to revoke app refresh token');
            }
        }

        if (accessToken) {
            await invalidateAuthCache(accessToken);
        }

        return true;
    }

    /**
     * Request Password Reset
     * Generates a reset token and sends email
     * Returns true always (security: don't reveal if email exists)
     */
    static async requestPasswordReset(email, lang = 'en') {
        // Find user by email
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, is_deleted, is_blocked, email_verified')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (findError || !profile) {
            return { success: true, message: AUTH.RESET_EMAIL_SENT_IF_EXISTS };
        }

        if (profile.is_deleted) {
            const error = new Error(AUTH.ACCOUNT_DELETED_RETRY);

            error.status = 403;
            error.code = 'ACCOUNT_DELETED';
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error(AUTH.ACCOUNT_BLOCKED_CONTACT);

            error.status = 403;
            error.code = 'ACCOUNT_BLOCKED';
            throw error;
        }

        if (!profile.email_verified) {
            const error = new Error(AUTH.EMAIL_NOT_CONFIRMED);
            error.status = 403;
            error.code = 'EMAIL_NOT_CONFIRMED';
            throw error;
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store token in database
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                password_reset_token: resetToken,
                password_reset_expires: tokenExpiry.toISOString()
            })
            .eq('id', profile.id);

        if (updateError) {
            logger.error({ err: updateError }, AUTH.LOG_STORE_RESET_TOKEN_FAILED);
            throw new Error(AUTH.PASSWORD_RESET_INIT_FAILED);

        }

        // Send reset email
        if (!process.env.FRONTEND_URL) {
            throw new Error(SYSTEM.FRONTEND_URL_REQUIRED);
        }
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        // Don't await - send async
        emailService.sendPasswordResetEmail(profile.email, resetLink, lang).catch(err =>
            logger.error({ err }, AUTH.LOG_SEND_RESET_EMAIL_FAILED)
        );

        logger.info({ userId: profile.id }, AUTH.LOG_RESET_TOKEN_GENERATED);
        return { success: true, message: AUTH.RESET_EMAIL_SENT_IF_EXISTS };

    }

    /**
     * Validate Reset Token
     * Checks if token is valid and not expired
     */
    static async validateResetToken(token) {
        if (!token) {
            const error = new Error(AUTH.PASSWORD_RESET_TOKEN_REQUIRED);

            error.status = 400;
            error.code = 'PASSWORD_RESET_TOKEN_REQUIRED';
            throw error;
        }

        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, password_reset_token, password_reset_expires')
            .eq('password_reset_token', token)
            .single();

        if (findError || !profile) {
            const error = new Error(AUTH.INVALID_RESET_LINK);

            error.status = 400;
            error.code = 'INVALID_RESET_LINK';
            throw error;
        }

        if (new Date(profile.password_reset_expires) < new Date()) {
            const error = new Error(AUTH.RESET_LINK_EXPIRED);

            error.status = 400;
            error.code = 'RESET_LINK_EXPIRED';
            throw error;
        }

        return { valid: true, email: profile.email };
    }

    /**
     * Reset Password
     * Sets a new password using the reset token
     * Invalidates all sessions and changes auth_provider to LOCAL
     */
    static async resetPassword(token, newPassword) {
        // Validate token first
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, password_reset_token, password_reset_expires, auth_provider, is_deleted, is_blocked')
            .eq('password_reset_token', token)
            .single();

        if (findError || !profile) {
            const error = new Error(AUTH.INVALID_RESET_LINK);

            error.status = 400;
            error.code = 'INVALID_RESET_LINK';
            throw error;
        }

        if (profile.is_deleted) {
            const error = new Error(AUTH.ACCOUNT_DELETED);

            error.status = 403;
            error.code = 'ACCOUNT_DELETED';
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error(AUTH.ACCOUNT_BLOCKED_CONTACT);

            error.status = 403;
            error.code = 'ACCOUNT_BLOCKED';
            throw error;
        }

        if (new Date(profile.password_reset_expires) < new Date()) {
            const error = new Error(AUTH.RESET_LINK_EXPIRED);

            error.status = 400;
            error.code = 'RESET_LINK_EXPIRED';
            throw error;
        }

        await CustomAuthService.updatePassword(profile.id, newPassword);

        // Clear token and update auth_provider to LOCAL
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                password_reset_token: null,
                password_reset_expires: null,
                auth_provider: 'LOCAL', // User now has a password
                must_change_password: false
            })
            .eq('id', profile.id);

        if (updateError) {
            logger.error({ err: updateError }, AUTH.LOG_STORE_RESET_TOKEN_FAILED);
        }

        await supabaseAdmin
            .from(APP_REFRESH_TOKEN_TABLE)
            .delete()
            .eq('user_id', profile.id);

        logger.info({ userId: profile.id, wasGoogleUser: profile.auth_provider === 'GOOGLE' },
            AUTH.LOG_PASSWORD_RESET_SUCCESS);

        return { success: true, message: AUTH.PASSWORD_RESET_SUCCESS };

    }

    /**
     * Send Email Verification for Google Users
     * Generates a new verification token and sends email
     * Only works for Google auth users with unverified email
     */
    static async sendGoogleUserVerificationEmail(userId) {
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, email_verified, auth_provider, preferred_language')
            .eq('id', userId)
            .single();

        if (findError || !profile) {
            const error = new Error(AUTH.USER_NOT_FOUND);

            error.status = 404;
            throw error;
        }

        // Only allow for Google auth users with unverified email
        if (profile.auth_provider !== 'GOOGLE') {
            const error = new Error(AUTH.GOOGLE_ONLY_VERIFICATION);

            error.status = 400;
            throw error;
        }

        if (profile.email_verified) {
            const error = new Error(AUTH.EMAIL_ALREADY_VERIFIED);

            error.status = 400;
            throw error;
        }

        try {
            await this.sendCustomVerificationEmail({
                userId: profile.id,
                email: profile.email,
                name: profile.name,
                lang: profile.preferred_language || 'en'
            });
        } catch (error) {
            logger.error({ err: error }, AUTH.LOG_EMAIL_VERIFICATION_ERROR);
            throw new Error(AUTH.VERIFICATION_EMAIL_FAILED);
        }

        logger.info({ userId: profile.id }, AUTH.LOG_GOOGLE_VERIFICATION_SENT);
        return { success: true, message: AUTH.VERIFICATION_EMAIL_SENT };

    }

    /**
     * Send OTP for Password Change
     */
    static async sendChangePasswordOTP(email, lang = 'en') {
        const metadata = { purpose: 'PASSWORD_CHANGE' };
        return await sendOTP(email, metadata, lang);
    }

    /**
     * Change Password
     * Verifies OTP, validates current password, and updates to new password
     */
    static async changePassword(userId, email, currentPassword, newPassword, otp) {
        // 1. Verify OTP
        const otpResult = await verifyOTP(email, otp);
        if (!otpResult.success) {
            const error = new Error(otpResult.error);
            error.status = 400;
            error.code = otpResult.error === 'errors.auth.otpExpired' ? 'OTP_EXPIRED' : 'INVALID_OTP';
            throw error;
        }

        if (otpResult.metadata?.purpose !== 'PASSWORD_CHANGE') {
            // Strict purpose check
            // logger.warn({ userId }, 'OTP used for wrong purpose'); 
            // For now, allow generic OTPs but prefer purpose match
        }

        const authAccount = await CustomAuthService.getAuthAccountByEmail(email);
        const currentPasswordValid = await CustomAuthService.verifyPassword(currentPassword, authAccount?.password_hash);

        if (!currentPasswordValid) {
            const error = new Error(AUTH.INVALID_PASSWORD);
            error.status = 401;
            throw error;
        }

        await CustomAuthService.updatePassword(userId, newPassword);

        logger.info({ userId }, AUTH.LOG_PASSWORD_UPDATED);
        return {
            success: true,
            message: AUTH.PASSWORD_UPDATED
        };
    }

    /**
     * Resend Confirmation Email (Standard Signup)
     * Checks if user is already verified
     */
    static async resendConfirmationEmail(email) {
        // 1. Get user profile
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, is_deleted, auth_provider, preferred_language, email_verified')
            .eq('email', email)
            .single();

        if (error || !profile) {
            // Be vague for security, or specific if user wants UX over security enumeration
            // Given the requirement is UX, we'll suggest creating an account
            const err = new Error(AUTH.EMAIL_NOT_FOUND);

            err.status = 404;
            err.code = 'EMAIL_NOT_FOUND';
            throw err;
        }

        if (profile.is_deleted) {
            const err = new Error(AUTH.ACCOUNT_DELETED_RETRY);

            err.status = 403;
            err.code = 'ACCOUNT_DELETED';
            throw err;
        }

        const hasPassword = await CustomAuthService.hasPasswordByUserId(profile.id);
        if (profile.auth_provider === 'GOOGLE' && !hasPassword) {
            // For Google users, use the specific Google verification flow if needed,
            // or tell them to Login with Google.
            // Usually Google users are auto-verified.
            const err = new Error(AUTH.GOOGLE_SIGNIN_REQUIRED);

            err.status = 400;
            err.code = 'GOOGLE_SIGNIN_REQUIRED';
            throw err;
        }

        if (profile.email_verified) {
            const err = new Error(AUTH.EMAIL_ALREADY_VERIFIED_LOGIN);

            err.status = 400;
            err.code = 'EMAIL_ALREADY_VERIFIED';
            throw err;
        }

        if (!process.env.FRONTEND_URL) {
            throw new Error(SYSTEM.FRONTEND_URL_REQUIRED);
        }

        await this.sendCustomVerificationEmail({
            userId: profile.id,
            email: profile.email,
            name: profile.name,
            lang: profile.preferred_language || 'en'
        }).catch(error => {
            logger.error({ err: error, userId: profile.id, email: profile.email }, AUTH.LOG_RESEND_CONFIRMATION_ERROR);
            const resendError = new Error(AUTH.VERIFICATION_EMAIL_FAILED);
            resendError.status = 500;
            throw resendError;
        });

        return { success: true, message: AUTH.CONFIRMATION_EMAIL_SENT };

    }
}

module.exports = AuthService;
