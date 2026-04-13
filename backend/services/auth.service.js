const { createClient } = require('@supabase/supabase-js');
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
const { fetchWithRetry } = require('../utils/fetch-retry');

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function createIsolatedAuthClient() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        global: {
            fetch: fetchWithRetry
        }
    });
}

async function resolveProfileRecord(identity, selectClause = '*, roles(name)') {
    if (!identity?.id && !identity?.email) {
        return null;
    }

    const byId = await supabaseAdmin
        .from('profiles')
        .select(selectClause)
        .eq('id', identity.id)
        .maybeSingle();

    if (byId.data) {
        return byId.data;
    }

    if (byId.error && byId.error.code !== 'PGRST116') {
        throw byId.error;
    }

    let normalizedEmail = String(identity.email || '').trim().toLowerCase();
    if (!normalizedEmail && identity.id) {
        const authLookup = await supabaseAdmin.auth.admin.getUserById(identity.id);
        normalizedEmail = String(authLookup?.data?.user?.email || '').trim().toLowerCase();
    }

    if (!normalizedEmail) {
        return null;
    }

    const byEmail = await supabaseAdmin
        .from('profiles')
        .select(selectClause)
        .eq('email', normalizedEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (byEmail.error && byEmail.error.code !== 'PGRST116') {
        throw byEmail.error;
    }

    if (byEmail.data) {
        logger.warn({
            authUserId: identity.id,
            profileId: byEmail.data.id,
            email: normalizedEmail
        }, '[AuthService] Recovered profile by email fallback due to auth/profile ID mismatch');
    }

    return byEmail.data || null;
}

class AuthService {
    static pendingRefreshes = new Map();

    static async exchangeCodeForSession(code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data?.session || !data?.user) {
            const err = new Error(AUTH.INVALID_SESSION);
            err.status = 401;
            throw err;
        }

        const user = await this.getUserProfile(data.user.id, data.user.email);

        return {
            user,
            tokens: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            }
        };
    }

    /**
     * Authenticate Google User (from backend direct OAuth OR frontend resolved token)
     */
    static async authenticateGoogleUser(googleProfile, guestId, sessionMetadata = {}) {
        return { message: "Google Auth should be handled natively via Supabase OAuth exchange." };
    }

    /**
     * Create Email verification token internally 
     * (Supabase handles magic links, but we keep this signature if utilized)
     */
    static async createEmailVerificationToken(userId) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: tokenExpiry.toISOString()
            })
            .eq('id', userId);

        if (updateError) throw updateError;

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
    static async getUserProfile(userId, email = null) {
        const profile = await resolveProfileRecord({ id: userId, email });

        if (!profile) {
            throw new Error(AUTH.USER_NOT_FOUND);
        }

        return {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            name: profile.name,
            firstName: profile.first_name,
            lastName: profile.last_name,
            image: profile.avatar_url,
            avatarUrl: profile.avatar_url,
            role: profile.roles?.name || 'customer',
            language: profile.preferred_language, 
            preferredCurrency: profile.preferred_currency || 'INR',
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
     * Sync Session (Exchange Token for Cookies or simply validate)
     */
    static async syncSession(accessToken, guestId) {
        try {
            const { data: { user }, error: validationError } = await supabase.auth.getUser(accessToken);
            if (validationError || !user) {
                logger.error({ err: validationError }, AUTH.LOG_SESSION_VALIDATION_FAILED);
                const err = new Error(AUTH.INVALID_SESSION);
                err.status = 401;
                throw err;
            }

            const claims = { sub: user.id };

            let profile = await resolveProfileRecord(user, 'id, is_deleted, deletion_status, scheduled_deletion_at');

            if (!profile) {
                const err = new Error(AUTH.USER_NOT_FOUND);
                err.status = 404;
                throw err;
            }

            if (profile?.is_deleted || profile?.deletion_status === 'DELETION_IN_PROGRESS') {
                logger.info({ userId: profile.id, authUserId: claims.sub }, AUTH.LOG_PROFILE_REACTIVATION_SYNC);

                const { error: reactivateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        is_deleted: false,
                        deletion_status: 'ACTIVE',
                        deleted_at: null
                    })
                    .eq('id', profile.id);

                if (reactivateError) {
                    const err = new Error(AUTH.REACTIVATION_FAILED);
                    err.status = 500;
                    throw err;
                }

                supabaseAdmin
                    .from('account_deletion_jobs')
                    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
                    .eq('user_id', profile.id)
                    .in('status', ['PENDING', 'IN_PROGRESS'])
                    .then(({ error }) => {
                        if (error) logger.warn({ err: error, userId: profile.id, authUserId: claims.sub }, AUTH.LOG_DELETION_CANCEL_FAILED);
                    })
                    .catch(err => logger.warn({ err, userId: profile.id, authUserId: claims.sub }, '[AuthService] deletion_job_cancellation_error'));
            }

            if (guestId) {
                try {
                    await CartService.mergeGuestCart(profile.id, guestId);
                    logger.info({ userId: profile.id, authUserId: claims.sub }, AUTH.LOG_GUEST_CART_MERGED);
                } catch (err) {
                    logger.error({ err }, AUTH.LOG_GUEST_CART_MERGE_FAILED);
                }
            }

            logger.info({ userId: profile.id, authUserId: claims.sub }, AUTH.LOG_SYNC_FINALIZING);
            return await this.getUserProfile(profile.id, user.email);
        } catch (error) {
            if (error.status) throw error;
            logger.error({ err: error }, AUTH.LOG_UNEXPECTED_SYNC_ERROR);
            const err = new Error(error.message || AUTH.SYNC_FAILED);

            err.status = 500;
            throw err;
        }
    }

    /**
     * Validate Credentials & Send Custom OTP
     * We sign in natively with Supabase to enforce password strictness, 
     * but we inject the generated session into OTP metadata to issue on verification.
     */
    static async validateCredentials(email, password, guestId, lang = 'en') {
        const normalizedEmail = email.toLowerCase().trim();
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, is_blocked, is_deleted, email_verified, auth_provider, must_change_password, roles(name)')
            .eq('email', normalizedEmail)
            .single();

        if (profileError || !profile) {
            return { success: false, error: AUTH.ACCOUNT_NOT_FOUND, code: 'ACCOUNT_NOT_FOUND', status: 404 };
        }

        if (profile.is_deleted) return { success: false, error: AUTH.ACCOUNT_DELETED, code: 'ACCOUNT_DELETED', status: 403 };
        if (profile.is_blocked) return { success: false, error: AUTH.ACCOUNT_BLOCKED, code: 'ACCOUNT_BLOCKED', status: 403 };
        if (!profile.email_verified) return { success: false, error: AUTH.EMAIL_NOT_CONFIRMED, code: 'EMAIL_NOT_CONFIRMED', status: 403 };

        if (profile.auth_provider === 'GOOGLE' && !profile.must_change_password) {
            // Check if there is an auth user created (password hash exists natively)
             const { data: authUser, error: _ae } = await supabaseAdmin.auth.admin.getUserById(profile.id);
             if (!authUser?.user?.email) {
                 return { success: false, error: AUTH.GOOGLE_SIGNIN_REQUIRED, code: 'GOOGLE_SIGNIN_REQUIRED', status: 400 };
             }
        }

        // Validate natively with Supabase!
        // IMPORTANT: signInWithPassword mutates the shared client's auth state.
        // We must sign out immediately after capturing the tokens to restore service_role context,
        // otherwise subsequent DB operations (like OTP insert) will fail with RLS violations.
        const authClient = createIsolatedAuthClient();
        const { data: sessionData, error: authError } = await authClient.auth.signInWithPassword({
            email: normalizedEmail,
            password
        });

        if (authError || !sessionData?.session) {
            return { success: false, error: AUTH.INVALID_PASSWORD, code: 'INVALID_PASSWORD', status: 401 };
        }

        // Immediately revoke the server-side Supabase session we just created.
        // We do NOT issue the session yet — the user must pass the OTP gate first.
        // Revoking here prevents abandoned login attempts from accumulating live sessions
        // in Supabase. A fresh session will be issued after OTP verification via generateLink.
        await supabaseAdmin.auth.admin.signOut(sessionData.session.access_token).catch(e =>
            logger.debug({ err: e }, '[AuthService] Quiet signOut after credential validation (non-critical)')
        );

        // Store only the user identity — no live tokens — in OTP metadata.
        return await sendOTP(normalizedEmail, {
            userId: profile.id,
            guestId,
        }, lang);
    }

    /**
     * Verify Custom Login OTP & Return Native Tokens
     */
    static async verifyLoginOtp(email, otp, sessionMetadata = {}) {
        const normalizedEmail = email.toLowerCase().trim();
        const otpResult = await verifyOTP(normalizedEmail, otp);

        if (!otpResult.success) {
            const error = new Error(otpResult.error);
            error.status = 400;
            error.attemptsRemaining = otpResult.attemptsRemaining;
            error.code = otpResult.error === 'errors.auth.otpExpired' ? 'OTP_EXPIRED' : 'INVALID_OTP';
            throw error;
        }

        const userId = otpResult.metadata?.userId;
        if (!userId) {
            const error = new Error(AUTH.SESSION_EXPIRED_OR_INVALID);
            error.status = 401;
            throw error;
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

        if (otpResult.metadata?.guestId) {
            try {
                await CartService.mergeGuestCart(profile.id, otpResult.metadata.guestId);
            } catch (err) {
                logger.error({ err }, AUTH.LOG_GUEST_CART_MERGE_FAILED);
            }
        }

        try {
            // Issue a fresh Supabase session now that the OTP gate has been passed.
            // We use generateLink (admin) + verifyOtp instead of storing live tokens in the
            // OTP table. The admin generateLink() returns a signed token server-side WITHOUT
            // sending any email — email delivery is the caller's responsibility per Supabase docs.
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: normalizedEmail
            });

            if (linkError || !linkData?.properties?.hashed_token) {
                logger.error({ err: linkError, userId: profile.id }, '[AuthService] generateLink failed after OTP verification');
                const error = new Error(AUTH.RESTORE_SESSION_FAILED);
                error.status = 500;
                throw error;
            }

            const sessionClient = createIsolatedAuthClient();
            const { data: sessionData, error: sessionError } = await sessionClient.auth.verifyOtp({
                token_hash: linkData.properties.hashed_token,
                type: 'magiclink'
            });

            if (sessionError || !sessionData?.session) {
                logger.error({ err: sessionError, userId: profile.id }, '[AuthService] verifyOtp failed after generateLink');
                const error = new Error(AUTH.RESTORE_SESSION_FAILED);
                error.status = 500;
                throw error;
            }

            const tokens = {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token
            };

            // G4: Map the user response directly from the profile already fetched above
            // instead of calling getUserProfile() which would call resolveProfileRecord again
            // (a second profiles DB roundtrip). Saves 1 DB call per login.
            const user = {
                id: profile.id,
                email: profile.email,
                phone: profile.phone,
                name: profile.name,
                firstName: profile.first_name,
                lastName: profile.last_name,
                image: profile.avatar_url,
                avatarUrl: profile.avatar_url,
                role: profile.roles?.name || 'customer',
                language: profile.preferred_language,
                preferredCurrency: profile.preferred_currency || 'INR',
                emailVerified: profile.email_verified,
                phoneVerified: profile.phone_verified,
                mustChangePassword: profile.must_change_password,
                authProvider: profile.auth_provider || 'LOCAL',
                deletionStatus: profile.deletion_status,
                scheduledDeletionAt: profile.scheduled_deletion_at
            };
            return { user, tokens };
        } catch (sessionError) {
            if (sessionError.status) throw sessionError;
            logger.error({ err: sessionError, userId: profile.id }, '[AuthService] Failed to issue session after OTP verification');
            const error = new Error(AUTH.RESTORE_SESSION_FAILED);
            error.status = 500;
            throw error;
        }
    }

    /**
     * Register User manually into Supabase instances
     */
    static async registerUser({ email, password, name, phone, isOtpVerified, lang = 'en' }) {
        logger.info({ email, name, phone }, AUTH.LOG_REGISTRATION_REQUEST);
        const normalizedEmail = email.toLowerCase().trim();
        
        try {
            await cleanupOrphanedUser(normalizedEmail);
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

        // 1. Create Supabase Auth User Natively
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: password,
            email_confirm: isOtpVerified, 
            user_metadata: {
                full_name: name
            }
        });

        if (authError) {
            const error = new Error(authError.message || AUTH.ACCOUNT_ALREADY_EXISTS);
            error.status = 400;
            error.code = 'ACCOUNT_ALREADY_EXISTS';
            throw error;
        }

        const userId = authUser.user.id;

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
                preferred_language: lang,
                email_verified: isOtpVerified,
                phone_verified: false,
                is_deleted: false,
                auth_provider: 'LOCAL'
            }], { onConflict: 'id' });

        if (profileError) {
            throw new Error(AUTH.PROFILE_CREATE_FAILED);
        }

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
            role: 'customer'
        };
    }

    /**
     * Refresh Application Session 
     */
    static async refreshToken(refreshToken, sessionMetadata = {}) {
        const refreshKey = crypto
            .createHash('sha256')
            .update(String(refreshToken || ''))
            .digest('hex');

        const pendingRefresh = AuthService.pendingRefreshes.get(refreshKey);
        if (pendingRefresh) {
            logger.debug({
                refreshKey: refreshKey.slice(0, 12),
                hasIpAddress: Boolean(sessionMetadata?.ipAddress),
                hasUserAgent: Boolean(sessionMetadata?.userAgent)
            }, '[AuthService] Reusing in-flight refresh operation');
            return pendingRefresh;
        }

        const refreshPromise = (async () => {
            const authClient = createIsolatedAuthClient();
            const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
            if (error || !data?.session) {
                // Distinguish real token errors from transient service/network failures.
                // Only 401 for genuine invalid tokens — 503 for connectivity issues.
                // This prevents a Supabase outage or network blip from triggering a
                // permanent client-side logout cascade via the 401 interceptor.
                let errorStatus = 503;
                let errorMessage = 'Auth service temporarily unavailable';

                if (error) {
                    const msg = (error.message || '').toLowerCase();
                    const isTokenError =
                        msg.includes('invalid refresh token') ||
                        msg.includes('token not found') ||
                        msg.includes('refresh_token') ||
                        msg.includes('invalid token') ||
                        error.status === 400 ||
                        error.status === 401;

                    if (isTokenError) {
                        errorStatus = 401;
                        errorMessage = AUTH.INVALID_REFRESH_TOKEN;
                    }
                }

                const authError = new Error(errorMessage);
                authError.status = errorStatus;
                throw authError;
            }

            return {
                userId: data.user.id,
                tokens: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token
                }
            };
        })();

        AuthService.pendingRefreshes.set(refreshKey, refreshPromise);

        try {
            return await refreshPromise;
        } finally {
            AuthService.pendingRefreshes.delete(refreshKey);
        }
    }

    /**
     * Logout and wipe tokens securely
     */
    static async logout(accessToken, refreshToken) {
        // Invalidate the specific user session via admin API.
        // supabase.auth.admin.signOut does not exist — use supabaseAdmin.
        if (accessToken) {
            // Resolve user from the access token first, then sign out all their sessions
            const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken).catch(() => ({ data: { user: null } }));
            if (user?.id) {
                await supabaseAdmin.auth.admin.signOut(accessToken).catch(e => {
                    logger.warn({ err: e }, 'Quiet fail on native token invalidation');
                });
            }
        }
        await invalidateAuthCache(accessToken);
    }

    /**
     * Resend verification email
     */
    static async resendConfirmationEmail(email) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, name, email_verified, is_deleted')
            .eq('email', email)
            .single();

        if (!profile || profile.is_deleted) {
            const error = new Error(AUTH.ACCOUNT_NOT_FOUND);
            error.status = 404;
            throw error;
        }

        if (profile.email_verified) {
            const error = new Error(AUTH.EMAIL_ALREADY_VERIFIED);
            error.status = 400;
            throw error;
        }

        return await this.sendCustomVerificationEmail({
            userId: profile.id,
            email,
            name: profile.name
        });
    }

    static async verifyEmail(token) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, email_verification_expires')
            .eq('email_verification_token', token)
            .single();

        if (!profile) {
            const error = new Error(AUTH.INVALID_VERIFICATION_TOKEN);
            error.status = 400;
            throw error;
        }

        if (new Date(profile.email_verification_expires) < new Date()) {
            const error = new Error(AUTH.VERIFICATION_TOKEN_EXPIRED);
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
    }

    static async sendChangePasswordOTP(email, lang = 'en') {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (!profile) {
            const error = new Error(AUTH.USER_NOT_FOUND);
            error.status = 404;
            throw error;
        }

        return await sendOTP(email, { purpose: 'PASSWORD_CHANGE', userId: profile.id }, lang);
    }

    static async changePassword(userId, email, currentPassword, newPassword, otp) {
        const otpResult = await verifyOTP(email, otp);
        if (!otpResult.success || otpResult.metadata?.purpose !== 'PASSWORD_CHANGE') {
            const error = new Error(otpResult.error || AUTH.INVALID_OTP);
            error.status = 400;
            throw error;
        }

        // Verify current password via signed in.
        // IMPORTANT: Always use an isolated client — signInWithPassword mutates auth state
        // on the shared client, which can corrupt RLS and wipe out the server's session context.
        const authClient = createIsolatedAuthClient();
        const { error: authError } = await authClient.auth.signInWithPassword({ email, password: currentPassword });
        if (authError) {
            return { success: false, error: AUTH.INVALID_PASSWORD, code: 'INVALID_PASSWORD', status: 401 };
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (updateError) {
            const error = new Error(AUTH.PASSWORD_CHANGE_FAILED);
            error.status = 500;
            throw error;
        }

        return { success: true, message: AUTH.PASSWORD_CHANGED };
    }

    // Handled natively or directly updating supabase Auth 
    static async requestPasswordReset(email, lang = 'en') {
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL}/reset-password`
        });
        
        // Supabase sends the email, we return success so we don't leak user existence.
        return { success: true, message: 'If the account exists, you will receive a reset link shortly.' };
    }

    static async validateResetToken(token) {
        // Supabase validates on their /verify links automatically.
        return { success: true };
    }

    static async resetPassword(token, newPassword) {
        // Technically handled client-side with Supabase normally 
        // But if required on backend - relies on the access token yielded from the reset email link.
        return { error: 'Please submit new password directly from the frontend SDK or link interface' };
    }
}

module.exports = AuthService;
