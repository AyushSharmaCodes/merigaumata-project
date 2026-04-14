const logger = require('../utils/logger');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const MemoryStore = require('../lib/store/memory.store');
const { getContext } = require('../utils/async-context');
const AuthMessages = require('../constants/messages/AuthMessages');
const SystemMessages = require('../constants/messages/SystemMessages');
const LogMessages = require('../constants/messages/LogMessages');
const { verifyAppAccessToken, isAppAccessToken } = require('../utils/app-auth');

// Cache used for manager permission lookups
const authCache = new MemoryStore();
// Cache used for user profile status and role lookups (5m TTL)
const profileCache = new MemoryStore();
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

async function resolveAuthenticatedUser(token) {
    if (isAppAccessToken(token)) {
        try {
            const claims = verifyAppAccessToken(token);
            return {
                id: claims.sub,
                email: claims.email,
                user_metadata: {
                    auth_provider: claims.auth_provider
                }
            };
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Hash token for cache key (don't store raw tokens as keys)
 */
function hashToken(token) {
    // Simple hash for cache key - not cryptographic, just for key generation
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `auth_${hash}`;
}

/**
 * Middleware to verify JWT token from STRICT HttpOnly cookies
 */
async function authenticateToken(req, res, next) {
    try {
        // Extract token - STRICTLY FROM COOKIE for enhanced security
        const token = req.cookies?.access_token;

        if (!token) {
            logger.debug({ msg: LogMessages.AUTH_TOKEN_MISSING }, '[AuthMiddleware] No access_token cookie found');
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED, code: 'TOKEN_MISSING' });
        }

        // 1. Resolve basic info from token (doesn't hit DB if it's our own signed token)
        const user = await resolveAuthenticatedUser(token);
        if (!user) {
            logger.debug('[AuthMiddleware] App token validation failed (Invalid or expired token)');
            return res.status(401).json({ error: AuthMessages.AUTHENTICATION_REQUIRED });
        }

        // 2. Check Cache for Profile Status/Role
        const cacheKey = `profile_meta_${user.id}`;
        let profileMeta = await profileCache.get(cacheKey);

        if (!profileMeta) {
            logger.debug({ userId: user.id }, '[AuthMiddleware] Profile cache miss, fetching from DB');
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('deletion_status, roles(name), is_blocked')
                .eq('id', user.id)
                .single();

            if (profileError) {
                logger.error({ userId: user.id, error: profileError }, '[AuthMiddleware] Profile fetch error');
                // Don't cache error, let logic proceed with defaults or block
            }

            const deletionStatus = profile?.deletion_status || 'ACTIVE';
            const isBlocked = profile?.is_blocked === true;
            let databaseRole = 'customer';
            const rolesData = profile?.roles;

            if (rolesData) {
                databaseRole = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) || 'customer';
            }
            databaseRole = databaseRole.toLowerCase();

            profileMeta = { deletionStatus, isBlocked, databaseRole };
            
            // Only cache if fetch was successful
            if (!profileError) {
                await profileCache.set(cacheKey, profileMeta, PROFILE_CACHE_TTL);
            }
        }

        const { deletionStatus, isBlocked, databaseRole } = profileMeta;

        // 3. ENFORCE ACCESS RULES
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
                return res.status(403).json({ error: AuthMessages.DELETION_IN_PROGRESS, code: 'ACCOUNT_PENDING_DELETION' });
            }
        }

        // 4. Build user object
        req.user = {
            id: user.id,
            userId: user.id,
            email: user.email,
            deletionStatus,
            ...user.user_metadata,
            role: databaseRole
        };

        const store = getContext();
        if (store) store.userId = req.user.id;

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
 * Optional authentication - STRICTLY FROM COOKIE
 */
async function optionalAuth(req, res, next) {
    try {
        const token = req.cookies?.access_token;

        if (!token) {
            req.user = null;
            return next();
        }

        // 1. Resolve basic info
        const user = await resolveAuthenticatedUser(token);
        if (!user) {
            logger.debug('[AuthMiddleware] Optional auth: token invalid/expired, proceeding as guest');
            req.user = null;
            return next();
        }

        // 2. Check Cache
        const cacheKey = `profile_meta_${user.id}`;
        let profileMeta = await profileCache.get(cacheKey);

        if (!profileMeta) {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('deletion_status, roles(name), is_blocked')
                .eq('id', user.id)
                .single();

            if (error) {
                logger.debug({ userId: user.id, error }, '[AuthMiddleware] Optional auth profile fetch error');
            }

            const deletionStatus = profile?.deletion_status || 'ACTIVE';
            const isBlocked = profile?.is_blocked === true;
            let databaseRole = 'customer';
            const rolesData = profile?.roles;
            if (rolesData) {
                databaseRole = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) || 'customer';
            }
            databaseRole = databaseRole.toLowerCase();

            profileMeta = { deletionStatus, isBlocked, databaseRole };
            if (!error) {
                await profileCache.set(cacheKey, profileMeta, PROFILE_CACHE_TTL);
            }
        }

        const { deletionStatus, isBlocked, databaseRole } = profileMeta;

        if (isBlocked) {
            req.user = null;
            return next();
        }

        // 3. Build user
        req.user = {
            id: user.id,
            userId: user.id,
            email: user.email,
            deletionStatus,
            ...user.user_metadata,
            role: databaseRole
        };

        const store = getContext();
        if (store) store.userId = req.user.id;

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
        const cacheKey = hashToken(token);
        await authCache.delete(cacheKey);
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
