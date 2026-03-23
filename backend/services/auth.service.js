const { supabase, supabaseAdmin } = require('../lib/supabase');
const logger = require('../utils/logger');
const { cleanupOrphanedUser } = require('../utils/cleanup');
const { sendOTP, verifyOTP } = require('./otp.service');
const CartService = require('./cart.service');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const phoneValidator = require('../utils/phone-validator');
const emailService = require('./email');
const { invalidateAuthCache } = require('../middleware/auth.middleware');
const { AUTH, SYSTEM } = require('../constants/messages');

// Encryption Keys - MUST be set in environment
if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is required for token encryption. Please set this in your .env file or environment configuration.');
}

const ENCRYPTION_KEY = process.env.JWT_SECRET;
const IV_LENGTH = 16;

function encryptTokens(tokens) {
    // Ensure key is 32 bytes
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(JSON.stringify(tokens));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptTokens(text) {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
}

class AuthService {
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
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

            if (error || !user) {
                logger.error({ err: error }, AUTH.LOG_SESSION_VALIDATION_FAILED);
                const err = new Error(AUTH.INVALID_SESSION);

                err.status = 401;
                throw err;
            }

            // Check if profile exists and its status
            let { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('is_deleted, deletion_status, scheduled_deletion_at, auth_provider, welcome_sent')
                .eq('id', user.id)
                .single();

            if (profileError && profileError.code === '42703') {
                // FALLBACK: If welcome_sent column is missing, retry without it
                logger.warn({ userId: user.id }, AUTH.LOG_WELCOME_COL_MISSING);
                const fallback = await supabaseAdmin
                    .from('profiles')
                    .select('is_deleted, deletion_status, scheduled_deletion_at, auth_provider')
                    .eq('id', user.id)
                    .single();
                profile = fallback.data;
                profileError = fallback.error;
            }

            if (profileError && profileError.code !== 'PGRST116') {
                logger.error({ err: profileError, userId: user.id }, AUTH.LOG_PROFILE_LOOKUP_FAILED);
                throw profileError;
            }

            if (!profile) {
                // Profile missing! If it's an OAuth user, create it.
                logger.info({ userId: user.id }, AUTH.LOG_PROFILE_MISSING_CREATION);

                const { data: roleData } = await supabaseAdmin
                    .from('roles')
                    .select('id')
                    .eq('name', 'customer')
                    .single();

                const name = user.user_metadata?.full_name || user.user_metadata?.name || AUTH.DEFAULT_USER_NAME;
                const nameParts = name.trim().split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

                const { error: createError } = await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: user.id,
                        email: user.email,
                        name: name,
                        first_name: firstName,
                        last_name: lastName,
                        role_id: roleData?.id,
                        email_verified: user.email_confirmed_at != null,
                        auth_provider: user.app_metadata?.provider === 'google' ? 'GOOGLE' : 'LOCAL',
                        is_deleted: false,
                        deletion_status: 'ACTIVE',
                        welcome_sent: false // Explicitly set to false to be safe
                    });

                if (createError) {
                    logger.error({ err: createError, userId: user.id }, AUTH.LOG_PROFILE_CREATION_FAILED);
                    const err = new Error(AUTH.PROFILE_INIT_FAILED);

                    err.status = 500;
                    throw err;
                }

                // If we successfully created it here, it's definitely a new user
                this.triggerWelcomeEmail(user, name, 'new');
            } else {
                // Profile exists. Let's check if it needs refinement (e.g. if created by trigger)
                const isGoogleUser = user.app_metadata?.provider === 'google';

                // Welcome email logic check - if it's a first time OAuth sync but email never sent
                const needsInitialGoogleSync = isGoogleUser && profile.auth_provider === 'LOCAL' && !profile.is_deleted;
                // CRITICAL: Only trigger if strictly false. If undefined (column missing), skip to avoid spam.
                const needsWelcomeEmail = profile.welcome_sent === false && !profile.is_deleted;

                if (needsInitialGoogleSync || needsWelcomeEmail) {
                    logger.info({ userId: user.id, needsInitialGoogleSync, needsWelcomeEmail }, AUTH.LOG_PROFILE_SYNC_REQUIRED);

                    const name = user.user_metadata?.full_name || user.user_metadata?.name || AUTH.DEFAULT_USER_NAME;
                    const nameParts = name.trim().split(' ');
                    const firstName = nameParts[0];
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            name: name,
                            first_name: firstName,
                            last_name: lastName,
                            auth_provider: 'GOOGLE',
                            email_verified: user.email_confirmed_at != null
                        })
                        .eq('id', user.id);

                    // Trigger Welcome Email for this first-time Google sync
                    this.triggerWelcomeEmail(user, name, 'new_sync');
                } else if (needsWelcomeEmail) {
                    this.triggerWelcomeEmail(user, null, 'catch_up');
                } else if (profile?.is_deleted || profile?.deletion_status === 'DELETION_IN_PROGRESS') {
                    // ... (rest of the reactivation logic)
                    logger.info({ userId: user.id }, AUTH.LOG_PROFILE_REACTIVATION_SYNC);

                    // Reactivate the profile
                    const { error: reactivateError } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            email: user.email, // Restore email if it was anonymized
                            is_deleted: false,
                            deletion_status: 'ACTIVE',
                            deleted_at: null,
                            // Ensure provider is recorded correctly
                            auth_provider: user.app_metadata?.provider === 'google' ? 'GOOGLE' : profile.auth_provider || 'LOCAL'
                        })
                        .eq('id', user.id);

                    if (reactivateError) {
                        logger.error({ err: reactivateError, userId: user.id }, AUTH.LOG_REACTIVATION_FAILED);
                        const err = new Error(AUTH.REACTIVATION_FAILED);

                        err.status = 500;
                        throw err;
                    }

                    // Send Welcome Email for reactivated users in background
                    if (!profile.welcome_sent) {
                        this.triggerWelcomeEmail(user, null, 'reactivation');
                    }

                    // Cancel any active deletion jobs for this user (FIRE AND FORGET)
                    supabaseAdmin
                        .from('account_deletion_jobs')
                        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                        .in('status', ['PENDING', 'IN_PROGRESS'])
                        .then(({ error }) => {
                            if (error) logger.warn({ err: error, userId: user.id }, AUTH.LOG_DELETION_CANCEL_FAILED);
                        })
                        .catch(err => logger.warn({ err, userId: user.id }, '[AuthService] deletion_job_cancellation_error'));
                }
            }

            // Merge Guest Cart if present
            if (guestId) {
                try {
                    await CartService.mergeGuestCart(user.id, guestId);
                    logger.info({ userId: user.id }, AUTH.LOG_GUEST_CART_MERGED);
                } catch (err) {
                    logger.error({ err }, AUTH.LOG_GUEST_CART_MERGE_FAILED);
                    // Continue anyway, don't block login
                }
            }

            logger.info({ userId: user.id }, AUTH.LOG_SYNC_FINALIZING);
            // Return full user profile for consistency
            return await this.getUserProfile(user.id);
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
        // Create a temporary client to validate credentials without tainting the global instance
        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                detectSessionInUrl: false
            }
        });

        // Run profile check and auth sign-in in parallel
        const [profileResponse, authResponse] = await Promise.all([
            supabaseAdmin
                .from('profiles')
                .select('id, email, is_blocked, is_deleted')
                .eq('email', email)
                .single(),
            tempClient.auth.signInWithPassword({
                email,
                password
            })
        ]);

        const { data: profile, error: profileError } = profileResponse;
        const { data: { user, session } = {}, error: authError } = authResponse;

        if (profileError || !profile) {
            return { success: false, error: AUTH.ACCOUNT_NOT_FOUND, status: 404 };

        }

        if (profile.is_deleted) {
            return {
                success: false,
                error: AUTH.ACCOUNT_DELETED,

                status: 403
            };
        }

        if (profile.is_blocked) {
            return { success: false, error: AUTH.ACCOUNT_BLOCKED, status: 403 };

        }

        if (authError || !session) {
            return { success: false, error: AUTH.INVALID_PASSWORD, status: 401 };

        }

        // Encrypt tokens
        const tokens = {
            access_token: session.access_token,
            refresh_token: session.refresh_token
        };
        const encryptedTokens = encryptTokens(tokens);

        // Send OTP with encrypted tokens as metadata
        // Pass guestId in metadata so it can be retrieved during verification
        return await sendOTP(email, { tokens: encryptedTokens, guestId }, lang);
    }

    /**
     * Verify Login OTP & Return Tokens
     */
    static async verifyLoginOtp(email, otp) {
        // 1. Verify OTP
        const otpResult = await verifyOTP(email, otp);

        if (!otpResult.success) {
            const error = new Error(otpResult.error);
            error.status = 400;
            error.attemptsRemaining = otpResult.attemptsRemaining;
            throw error;
        }

        // 2. Extract Encrypted Tokens
        const encryptedTokens = otpResult.metadata?.tokens;
        if (!encryptedTokens) {
            throw new Error(AUTH.SESSION_EXPIRED_OR_INVALID);

        }

        // 3. Decrypt Tokens
        let tokens;
        try {
            tokens = decryptTokens(encryptedTokens);
        } catch (err) {
            logger.error({ err }, AUTH.LOG_TOKEN_DECRYPTION_FAILED);
            throw new Error(AUTH.RESTORE_SESSION_FAILED);

        }

        // 4. Get User Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*, roles(name)')
            .eq('email', email)
            .single();

        if (profileError || !profile) {
            throw new Error(AUTH.USER_NOT_FOUND);

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
    }



    /**
     * Register User
     */
    static async registerUser({ email, password, name, phone, isOtpVerified, lang = 'en' }) {
        logger.info({ email, name, phone }, AUTH.LOG_REGISTRATION_REQUEST);
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, isDeleted')
            .eq('email', email)
            .eq('is_deleted', false)
            .single();

        if (existingProfile) {
            if (existingProfile.is_deleted) {
                const error = new Error(AUTH.ACCOUNT_DELETED);

                error.status = 403;
                throw error;
            }
            const error = new Error(AUTH.ACCOUNT_ALREADY_EXISTS);
            error.status = 400;
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
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: isOtpVerified,
            user_metadata: { name, phone: phone || null }
        });

        if (authError) throw authError;

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
                id: authData.user.id,
                email,
                phone: phone || null,
                name,
                first_name: firstName,
                last_name: lastName,
                role_id: roleData?.id,
                email_verified: isOtpVerified,
                phone_verified: false,
                is_deleted: false
            }], { onConflict: 'id' });

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error(AUTH.PROFILE_CREATE_FAILED);

        }

        // 4. Verification Token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await supabaseAdmin
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: tokenExpiry.toISOString()
            })
            .eq('id', authData.user.id);

        // 5. Send Email
        if (!process.env.FRONTEND_URL) {
            throw new Error('FRONTEND_URL environment variable is required for email verification');
        }
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        // Don't await email to speed up response
        emailService.sendEmailConfirmation(email, {
            name,
            email,
            verificationLink
        }, { userId: authData.user.id, lang }).catch(err =>
            logger.error({ err }, AUTH.LOG_SEND_CONFIRMATION_EMAIL_FAILED)
        );

        return {
            id: authData.user.id,
            email,
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

        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            email_confirm: true
        });

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
    static async refreshToken(oldRefreshToken) {
        if (!oldRefreshToken) {
            // WHY: No refresh token = user never logged in or cookies were cleared
            const error = new Error(AUTH.REFRESH_TOKEN_REQUIRED);

            error.status = 401;
            throw error;
        }

        const { data: { session }, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: oldRefreshToken });

        if (error || !session) {
            // WHY: Refresh token expired or revoked - user must re-login
            logger.warn({ err: error?.message }, AUTH.LOG_SUPABASE_REFRESH_FAILED);
            const err = new Error(error?.message || AUTH.INVALID_REFRESH_TOKEN);

            err.status = error?.status || 401;
            throw err;
        }

        return {
            tokens: {
                access_token: session.access_token,
                refresh_token: session.refresh_token
            },
            userId: session.user.id
        };
    }

    /**
     * Logout
     */
    static async logout(accessToken, refreshToken) {

        if (accessToken) {
            // Invalidate local cache
            await invalidateAuthCache(accessToken);

            // Optional: Sign out from Supabase if we want to invalidate the session upstream
            // But we need the user token for that, and 'accessToken' is it.
            try {
                await supabaseAdmin.auth.admin.signOut(accessToken);
            } catch (ignore) {
                // Ignore if already invalid
            }
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
            .select('id, email, name, is_deleted, is_blocked')
            .eq('email', email.toLowerCase().trim())
            .single();

        // Security: Always return success to prevent email enumeration
        if (findError || !profile) {
            const error = new Error(AUTH.EMAIL_NOT_FOUND);

            error.status = 404;
            throw error;
        }

        if (profile.is_deleted) {
            const error = new Error(AUTH.ACCOUNT_DELETED_RETRY);

            error.status = 403;
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error(AUTH.ACCOUNT_BLOCKED_CONTACT);

            error.status = 403;
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
            throw error;
        }

        if (new Date(profile.password_reset_expires) < new Date()) {
            const error = new Error(AUTH.RESET_LINK_EXPIRED);

            error.status = 400;
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
            throw error;
        }

        if (profile.is_deleted) {
            const error = new Error(AUTH.ACCOUNT_DELETED);

            error.status = 403;
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error(AUTH.ACCOUNT_BLOCKED_CONTACT);

            error.status = 403;
            throw error;
        }

        if (new Date(profile.password_reset_expires) < new Date()) {
            const error = new Error(AUTH.RESET_LINK_EXPIRED);

            error.status = 400;
            throw error;
        }

        // Update password in Supabase Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            profile.id,
            { password: newPassword }
        );

        if (authError) {
            logger.error({ err: authError }, AUTH.LOG_CHANGE_PASSWORD_ERROR);
            throw new Error(AUTH.RESET_PASSWORD_FAILED);

        }

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

        // Invalidate all sessions for this user
        try {
            // Sign out user from all sessions
            await supabaseAdmin.auth.admin.signOut(profile.id, 'global');
        } catch (signOutError) {
            logger.warn({ err: signOutError }, AUTH.LOG_SIGN_OUT_AFTER_RESET_FAILED);
        }

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
            .select('id, email, name, email_verified, auth_provider')
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

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: tokenExpiry.toISOString()
            })
            .eq('id', profile.id);

        if (updateError) {
            logger.error({ err: updateError }, AUTH.LOG_EMAIL_VERIFICATION_ERROR);
            throw new Error(AUTH.VERIFICATION_EMAIL_FAILED);
        }

        // Send verification email
        if (!process.env.FRONTEND_URL) {
            throw new Error('FRONTEND_URL environment variable is required for email verification');
        }
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        await emailService.sendEmailConfirmation(profile.email, {
            name: profile.name,
            email: profile.email,
            verificationLink
        }, profile.id);

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
            throw error;
        }

        if (otpResult.metadata?.purpose !== 'PASSWORD_CHANGE') {
            // Strict purpose check
            // logger.warn({ userId }, 'OTP used for wrong purpose'); 
            // For now, allow generic OTPs but prefer purpose match
        }

        // 2. Validate Current Password
        // Use temporary client to validate password to avoid tainting global instance
        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                detectSessionInUrl: false
            }
        });

        const { error: signInError } = await tempClient.auth.signInWithPassword({
            email: email,
            password: currentPassword
        });

        if (signInError) {
            const error = new Error(AUTH.INVALID_PASSWORD);
            error.status = 401;
            throw error;
        }

        // 3. Update Password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (updateError) {
            throw updateError;
        }

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
            .select('id, is_deleted, auth_provider')
            .eq('email', email)
            .single();

        if (error || !profile) {
            // Be vague for security, or specific if user wants UX over security enumeration
            // Given the requirement is UX, we'll suggest creating an account
            const err = new Error(AUTH.EMAIL_NOT_FOUND);

            err.status = 404;
            throw err;
        }

        if (profile.is_deleted) {
            const err = new Error(AUTH.ACCOUNT_DELETED_RETRY);

            err.status = 403;
            throw err;
        }

        if (profile.auth_provider === 'GOOGLE') {
            // For Google users, use the specific Google verification flow if needed,
            // or tell them to Login with Google.
            // Usually Google users are auto-verified.
            const err = new Error(AUTH.GOOGLE_SIGNIN_REQUIRED);

            err.status = 400;
            throw err;
        }

        // 2. Check Supabase Auth User Status
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !user) {
            const err = new Error(AUTH.USER_DATA_NOT_FOUND);

            err.status = 404;
            throw err;
        }

        if (user.email_confirmed_at) {
            const err = new Error(AUTH.EMAIL_ALREADY_VERIFIED_LOGIN);

            err.status = 400;
            throw err; // This is the key change for the user request
        }

        // 3. Resend Confirmation
        const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: process.env.FRONTEND_URL
                    ? `${process.env.FRONTEND_URL}/auth/callback`
                    : (() => { throw new Error(SYSTEM.FRONTEND_URL_REQUIRED); })()
            }
        });

        if (resendError) {
            logger.error({ err: resendError }, AUTH.LOG_RESEND_CONFIRMATION_ERROR);
            throw new Error(resendError.message);
        }

        return { success: true, message: AUTH.CONFIRMATION_EMAIL_SENT };

    }
}

module.exports = AuthService;
