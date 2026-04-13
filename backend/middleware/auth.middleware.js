const logger = require('../utils/logger');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const CacheService = require('../lib/store/cache.service');
const crypto = require('crypto');
const { getContext } = require('../utils/async-context');
const AuthMessages = require('../constants/messages/AuthMessages');
const SystemMessages = require('../constants/messages/SystemMessages');
const LogMessages = require('../constants/messages/LogMessages');

// Cache for user object and profile/permission lookups.
// Defaults: 60s for the auth user, 120s for the profile+roles record.
// These TTLs are safe because role/profile changes are infrequent and low-stakes for
// stale reads. Override via env vars for tighter consistency requirements.
// IMPORTANT: If you add a route that mutates roles/profiles, call authCache.delete() for
// the affected user keys to proactively invalidate the cache.
const authCache = CacheService.getInstance();
const AUTH_USER_CACHE_TTL_MS = Number(process.env.AUTH_USER_CACHE_TTL_MS || 60 * 1000);
const AUTH_PROFILE_CACHE_TTL_MS = Number(process.env.AUTH_PROFILE_CACHE_TTL_MS || 120 * 1000);
const AUTH_NULL_SENTINEL = '__AUTH_CACHE_NULL__';

function buildProfileCacheKey(authUser, selectClause) {
    const identifier = authUser?.id || String(authUser?.email || '').trim().toLowerCase();
    return identifier ? `profile_${identifier}_${selectClause}` : null;
}

async function resolveProfileRecord(authUser, selectClause = 'deletion_status, roles(name), is_blocked') {
    if (!authUser?.id && !authUser?.email) {
        return null;
    }

    const cacheKey = buildProfileCacheKey(authUser, selectClause);
    if (cacheKey) {
        const cached = await authCache.get(cacheKey);
        if (cached !== null) {
            return cached === AUTH_NULL_SENTINEL ? null : cached;
        }
    }

    const byId = await supabaseAdmin
        .from('profiles')
        .select(selectClause)
        .eq('id', authUser.id)
        .maybeSingle();

    if (byId.data) {
        if (cacheKey) {
            await authCache.set(cacheKey, byId.data, AUTH_PROFILE_CACHE_TTL_MS);
        }
        return byId.data;
    }

    if (byId.error && byId.error.code !== 'PGRST116') {
        throw byId.error;
    }

    const normalizedEmail = String(authUser.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
        return null;
    }

    const byEmail = await supabaseAdmin
        .from('profiles')
        .select(`id, ${selectClause}`)
        .eq('email', normalizedEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (byEmail.error && byEmail.error.code !== 'PGRST116') {
        throw byEmail.error;
    }

    if (byEmail.data) {
        logger.warn({
            authUserId: authUser.id,
            profileId: byEmail.data.id,
            email: normalizedEmail
        }, '[AuthMiddleware] Recovered profile by email fallback due to auth/profile ID mismatch');
    }

    if (cacheKey) {
        await authCache.set(cacheKey, byEmail.data || AUTH_NULL_SENTINEL, AUTH_PROFILE_CACHE_TTL_MS);
    }

    return byEmail.data || null;
}

async function resolveAuthenticatedUser(token) {
    if (!token) return null;

    const cacheKey = `token_user_${hashToken(token)}`;
    const cached = await authCache.get(cacheKey);
    if (cached !== null) {
        return cached === AUTH_NULL_SENTINEL ? null : cached;
    }

    try {
        // Option 1: Fast verification using JWT secret (if we share supabase JWT secret)
        // Option 2: Secure server-side validation using supabase admin
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            await authCache.set(cacheKey, AUTH_NULL_SENTINEL, AUTH_USER_CACHE_TTL_MS);
            return null;
        }

        const resolvedUser = {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
        };
        await authCache.set(cacheKey, resolvedUser, AUTH_USER_CACHE_TTL_MS);
        return resolvedUser;
    } catch {
        await authCache.set(cacheKey, AUTH_NULL_SENTINEL, AUTH_USER_CACHE_TTL_MS);
        return null;
    }
}

/**
 * Hash token for cache key (don't store raw tokens as keys)
 */
function hashToken(token) {
    // Secure token hashing to prevent cache collision attacks
    return `auth_${crypto.createHash('sha256').update(token).digest('hex')}`;
}

/**
 * Middleware to verify JWT token from cookies or Authorization header
 */
async function authenticateToken(req, res, next) {
    try {
        // Extract token - PRIORITIZE COOKIE over Authorization header
        let token = req.cookies?.access_token;
        let tokenSource = 'cookie';

        logger.debug({
            msg: '[AuthMiddleware] Request Details',
            method: req.method,
            url: req.originalUrl,
            hasAccessTokenCookie: !!req.cookies?.access_token,
            hasRefreshTokenCookie: !!req.cookies?.refresh_token,
            authHeader: req.headers.authorization ? 'Present' : 'Missing'
        });

        // Extract Authorization header token for potential fallback
        let headerToken = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            headerToken = authHeader.split(' ')[1];
        } else if (authHeader && !token) {
            logger.warn({ header: authHeader.substring(0, 20) + '...' }, '[AuthMiddleware] Authorization header present but invalid format');
        }

        if (!token) {
            if (headerToken) {
                token = headerToken;
                tokenSource = 'header';
                logger.debug('[AuthMiddleware] Token found in Authorization header');
            }
        } else {
            logger.debug('[AuthMiddleware] Token found in Cookies');
        }

        if (!token) {
            logger.debug({ msg: LogMessages.AUTH_TOKEN_MISSING }, '[AuthMiddleware] No token found in cookies or headers');
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED, code: 'TOKEN_MISSING' });
        }

        logger.debug('[AuthMiddleware] Validating app token...');

        // 2. Validate token using Supabase Admin
        let user = await resolveAuthenticatedUser(token);
        let error = user ? null : new Error('Invalid or expired token');

        // FALLBACK: If cookie token is invalid/expired but we have a header token, try that
        if ((error || !user) && tokenSource === 'cookie' && headerToken && headerToken !== token) {
            logger.debug('[AuthMiddleware] Cookie token invalid, attempting fallback to Authorization header');
            const fallbackUser = await resolveAuthenticatedUser(headerToken);
            if (fallbackUser) {
                logger.debug('[AuthMiddleware] Authorization header token valid, using as fallback');
                user = fallbackUser;
                error = null;
                token = headerToken; // Use header token for caching
                tokenSource = 'header-fallback';
            }
        }

        if (error || !user) {
            logger.debug({ err: error?.message, tokenSource }, '[AuthMiddleware] App token validation failed (Invalid or expired token)');
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
        }

        // 3. Check Account Deletion Status, Blocked Status, and Role (Critical Security Check)
        // We use supabaseAdmin here to bypass RLS and ensure we can resolve the user's role 
        // regardless of profiles table policies. The backend applies its own JS authorization.
        let profile = null;
        try {
            profile = await resolveProfileRecord(user);
        } catch (profileError) {
            logger.error({ userId: user.id, error: profileError }, '[AuthMiddleware] Profile fetch error');
        }

        const deletionStatus = profile?.deletion_status || 'ACTIVE';
        const isBlocked = profile?.is_blocked === true;

        // Handle both singular join object and possible array join (PostgREST variance)
        let databaseRole = 'customer';
        // Handle case sensitivity robustly
        const rolesData = profile?.roles || profile?.Roles;

        if (rolesData) {
            if (Array.isArray(rolesData)) {
                databaseRole = rolesData[0]?.name || rolesData[0]?.Name || 'customer';
            } else {
                databaseRole = rolesData.name || rolesData.Name || 'customer';
            }
        }

        // Normalize role to lowercase for robust check
        databaseRole = (databaseRole || 'customer').toLowerCase();

        logger.debug({
            userId: user.id,
            deletionStatus,
            isBlocked,
            databaseRole
        }, '[AuthMiddleware] Role resolution');

        // ENFORCE ACCESS RULES
        if (isBlocked) {
            return res.status(403).json({ error: AuthMessages.ACCOUNT_BLOCKED, code: 'ACCOUNT_BLOCKED' });
        }
        if (deletionStatus === 'DELETED') {
            return res.status(410).json({ error: AuthMessages.ACCOUNT_DELETED, code: 'ACCOUNT_DELETED' });
        }
        if (deletionStatus === 'DELETION_IN_PROGRESS') {
            return res.status(403).json({ error: AuthMessages.DELETION_IN_PROGRESS, code: 'DELETION_IN_PROGRESS' });
        }
        if (deletionStatus === 'PENDING_DELETION' || deletionStatus === 'PENDING_DELETION_BLOCKED') {
            // Allow access ONLY to essential auth and deletion endpoints
            const allowedPaths = [
                '/api/auth/refresh',
                '/api/auth/logout',
                '/api/auth/me',
                '/api/auth/sync',
                '/api/account/delete/cancel',
                '/api/account/delete/status'
            ];

            const isAllowed = allowedPaths.some(path => req.originalUrl.startsWith(path));

            if (!isAllowed) {
                logger.warn({ userId: user.id, path: req.originalUrl }, '[AuthMiddleware] Access blocked for account pending deletion');
                return res.status(403).json({
                    error: AuthMessages.DELETION_IN_PROGRESS, // Use existing or add precise one
                    code: 'ACCOUNT_PENDING_DELETION'
                });
            }
        }

        logger.debug(`[AuthMiddleware] App token validation success for user ${user.id}`);

        // 4. Build user object - DATABASE ROLE IS SOURCE OF TRUTH
        // G1: Forward auth_provider and must_change_password from the cached profile so
        // downstream routes (e.g. change-password) don't need a separate DB roundtrip.
        const appUser = {
            id: profile?.id || user.id,
            userId: profile?.id || user.id, // Compatibility
            authUserId: user.id,
            email: user.email,
            deletionStatus, // Add status to user object
            authProvider: profile?.auth_provider || null,
            mustChangePassword: profile?.must_change_password ?? false,
            ...user.user_metadata,
            role: databaseRole // Prioritize database role last so it wins
        };

        req.user = appUser;

        // Context Enrichment
        const store = getContext();
        if (store) store.userId = appUser.id;

        logger.debug(`[AuthMiddleware] Authenticated user ${appUser.id} as ${appUser.role}`);

        next();
    } catch (error) {
        logger.error({ err: error }, '[AuthMiddleware] Error');
        return res.status(500).json({ error: SystemMessages.INTERNAL_ERROR });
    }
}

/**
 * Middleware to check if user has required role
 * Supports both rest parameters: authorizeRole('admin', 'manager')
 * and a single array: authorizeRole(['admin', 'manager'])
 */
function authorizeRole(...roles) {
    const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn({
                msg: 'Access Forbidden: Role mismatch',
                required: allowedRoles,
                actual: req.user.role,
                userId: req.user.id
            });
            return res.status(403).json({ error: AuthMessages.FORBIDDEN });
        }

        next();
    };
}

/**
 * Optional authentication - doesn't fail if no token, but returns 401 if token is invalid
 * This allows the frontend to attempt a refresh on expired tokens.
 */
async function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.access_token;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        // No token = guest user (allowed)
        if (!token) {
            req.user = null;
            return next();
        }

        // 1. Validate app token
        const user = await resolveAuthenticatedUser(token);

        if (!user) {
            // Token provided but invalid/expired — treat as guest rather than blocking.
            // The frontend apiClient handles refresh separately via its 401 interceptor.
            logger.debug('[AuthMiddleware] Optional auth: token invalid/expired, proceeding as guest');
            req.user = null;
            return next();
        }

        // 2. Fetch Profile for Status and Role - DATABASE IS SOURCE OF TRUTH
        // We use supabaseAdmin here to bypass RLS during role resolution
        const profile = await resolveProfileRecord(user);

        const deletionStatus = profile?.deletion_status || 'ACTIVE';
        const isBlocked = profile?.is_blocked === true;

        // Blocked users are treated as guests in optional auth context
        if (isBlocked) {
            logger.debug({ userId: user.id }, '[AuthMiddleware] Optional auth: blocked user treated as guest');
            req.user = null;
            return next();
        }

        let databaseRole = 'customer';
        const rolesData = profile?.roles || profile?.Roles;

        logger.debug({
            userId: user.id,
            deletionStatus,
            databaseRole: rolesData ? (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) : 'customer',
            hasRolesData: !!rolesData
        }, '[AuthMiddleware] Optional auth role resolution');

        if (rolesData) {
            databaseRole = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) || 'customer';
        }

        // 3. Build user
        // G1: Forward auth_provider and must_change_password from the cached profile.
        const appUser = {
            id: profile?.id || user.id,
            userId: profile?.id || user.id,
            authUserId: user.id,
            email: user.email,
            deletionStatus,
            authProvider: profile?.auth_provider || null,
            mustChangePassword: profile?.must_change_password ?? false,
            ...user.user_metadata,
            role: databaseRole // Prioritize database role
        };

        req.user = appUser;

        const store = getContext();
        if (store) store.userId = appUser.id;

        next();
    } catch (error) {
        logger.error({ err: error }, '[AuthMiddleware] Optional Auth Error');
        req.user = null;
        next();
    }
}

/**
 * Invalidate a token from the cache (e.g., on logout)
 */
async function invalidateAuthCache(token) {
    if (token) {
        await authCache.delete(`token_user_${hashToken(token)}`);
        logger.debug('[AuthMiddleware] Cache invalidated');
    }
}

/**
 * Middleware to check if user has specific module permission
 * Admins have all permissions, Managers check manager_permissions table
 */
function checkPermission(permissionName) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
        }

        // Admins can do everything
        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.role !== 'manager') {
            return res.status(403).json({ error: AuthMessages.INSUFFICIENT_PERMISSIONS });
        }

        try {
            // Check cache for permissions
            const cacheKey = `perms_${req.user.id}`;
            let permissions = await authCache.get(cacheKey);

            if (!permissions) {
                logger.debug({ userId: req.user.id }, '[AuthMiddleware] Permission cache miss, fetching from DB');
                const { data, error } = await supabaseAdmin
                    .from('manager_permissions')
                    .select('*')
                    .eq('user_id', req.user.id)
                    .single();

                if (error || !data) {
                    logger.warn({ userId: req.user.id, err: error }, '[AuthMiddleware] Failed to fetch manager permissions');
                    return res.status(403).json({ error: AuthMessages.MANAGER_NOT_FOUND });
                }

                permissions = data;
                await authCache.set(cacheKey, permissions, 60 * 1000); // Cache for 1 minute
            }

            if (!permissions.is_active) {
                logger.warn({ userId: req.user.id }, '[AuthMiddleware] Manager account is inactive');
                return res.status(403).json({ error: AuthMessages.MANAGER_INACTIVE });
            }

            if (!permissions[permissionName]) {
                logger.warn({
                    msg: 'Access Forbidden: Permission missing',
                    required: permissionName,
                    userId: req.user.id
                });
                return res.status(403).json({
                    error: AuthMessages.INSUFFICIENT_PERMISSIONS,
                    details: { required: permissionName }
                });
            }

            next();
        } catch (err) {
            logger.error({ err, userId: req.user.id }, '[AuthMiddleware] Permission check error');
            res.status(500).json({ error: AuthMessages.VERIFY_PERMISSIONS_FAILED });
        }
    };
}

module.exports = {
    authenticateToken,
    authorizeRole,
    requireRole: authorizeRole, // Alias
    requireAuth: authenticateToken, // Alias
    checkPermission,
    optionalAuth,
    invalidateAuthCache
};
