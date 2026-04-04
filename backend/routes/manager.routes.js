const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const crypto = require('crypto');
const emailService = require('../services/email');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');
const { sanitizeManagerPermissions } = require('../constants/manager-permissions');
const CustomAuthService = require('../services/custom-auth.service');
const { scheduleBackgroundTask } = require('../utils/background-task');

const MANAGER_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const MANAGER_TEMP_PASSWORD_EXPIRY_HOURS = 48;

async function getManagerProfileOrThrow(userId) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, name, preferred_language, email_verified, must_change_password, roles(name)')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        const notFoundError = new Error('Manager not found');
        notFoundError.status = 404;
        throw notFoundError;
    }

    if (profile.roles?.name !== 'manager') {
        const invalidRoleError = new Error('Target user is not a manager');
        invalidRoleError.status = 400;
        throw invalidRoleError;
    }

    return profile;
}

async function issueManagerTemporaryPassword(profile) {
    const password = CustomAuthService.generateRandomPassword();

    await CustomAuthService.upsertLocalAccount({
        userId: profile.id,
        email: profile.email,
        password
    });

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', profile.id);

    if (updateError) {
        throw updateError;
    }

    return emailService.sendManagerWelcomeEmail(
        profile.email,
        profile.name,
        password,
        profile.preferred_language || 'en',
        MANAGER_TEMP_PASSWORD_EXPIRY_HOURS
    );
}

async function cleanupFailedManagerCreation(userId) {
    const cleanupTasks = [
        supabase.from('manager_permissions').delete().eq('user_id', userId),
        supabase.from('profiles').delete().eq('id', userId),
        CustomAuthService.deleteAuthArtifacts(userId)
    ];

    const results = await Promise.allSettled(cleanupTasks);
    const failures = results
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
        logger.error({
            userId,
            failures: failures.map(({ index, result }) => ({
                step: ['permissions', 'profile', 'auth'][index],
                reason: result.reason?.message || result.reason
            }))
        }, 'Failed to fully roll back manager creation');
    }
}

// Get all managers with their permissions - Admin only
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // First get the manager role ID
        const { data: managerRole } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'manager')
            .single();

        if (!managerRole) {
            return res.json([]);
        }

        // Get all profiles with manager role and their permissions
        // Also fetch the creator's name using the self-referencing foreign key
        const { data: managers, error, count } = await supabase
            .from('profiles')
            .select(`
                id,
                email,
                name,
                phone,
                email_verified,
                must_change_password,
                created_at,
                created_by,
                creator:created_by (
                    name
                ),
                manager_permissions (*)
            `, { count: 'exact' })
            .eq('role_id', managerRole.id)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        // Transform data to flatten creator name
        const transformedManagers = managers.map(manager => ({
            ...manager,
            creator_name: manager.creator?.name || 'System'
        }));

        res.json({
            managers: transformedManagers || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Get Managers Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create a new manager - Admin only
router.post('/', authenticateToken, requireRole('admin'), requestLock('manager-create'), idempotency(), async (req, res) => {
    try {
        const { email, name, permissions } = req.body;
        const normalizedEmail = CustomAuthService.normalizeEmail(email);

        if (!normalizedEmail || !name) {
            return res.status(400).json({ error: req.t('errors.manager.emailNameRequired') });
        }

        if (!process.env.FRONTEND_URL) {
            throw new Error('FRONTEND_URL environment variable is required for manager verification emails');
        }

        // Check if user already exists
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ error: req.t('errors.manager.emailExists') });
        }

        const userId = crypto.randomUUID();
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiresAt = new Date(Date.now() + MANAGER_VERIFICATION_TTL_MS).toISOString();

        // Get manager role ID
        const { data: roleData } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'manager')
            .single();

        // Create profile
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: normalizedEmail,
                name,
                first_name: firstName,
                last_name: lastName,
                role_id: roleData?.id,
                preferred_language: 'en',
                email_verified: false,
                created_by: req.user.id,
                must_change_password: false,
                email_verification_token: verificationToken,
                email_verification_expires: verificationExpiresAt,
                auth_provider: 'LOCAL'
            });

        if (profileError) {
            throw profileError;
        }

        // Create manager permissions
        logger.debug({ userId }, 'Creating manager permissions');

        const { data: permData, error: permError } = await supabase
            .from('manager_permissions')
            .insert({
                user_id: userId,
                is_active: true,
                ...sanitizeManagerPermissions(permissions)
            })
            .select()
            .single();

        if (permError) {
            logger.error({ err: permError }, 'Error creating permissions:');
            await cleanupFailedManagerCreation(userId);
            throw permError;
        }

        logger.info({ userId }, 'Manager created and permissions assigned');

        res.status(201).json({
            message: 'success.manager.created',
            id: userId,
            email: normalizedEmail,
            name,
            emailVerified: false,
            mustChangePassword: false,
            verificationEmailSent: false,
            verificationEmailQueued: true,
            temporaryPasswordSent: false,
            temporaryPasswordQueued: false,
            permissions: permData
        });

        scheduleBackgroundTask({
            operationName: 'send-manager-verification-email',
            context: {
                userId,
                email: normalizedEmail,
                initiatedBy: req.user?.id
            },
            errorMessage: 'Failed to send manager verification email',
            task: async () => {
                const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
                const result = await emailService.sendEmailConfirmation(normalizedEmail, {
                    name,
                    email: normalizedEmail,
                    verificationLink
                });
                if (!result?.success) {
                    logger.error({
                        userId,
                        email: normalizedEmail,
                        error: result?.error
                    }, 'Manager verification email provider reported failure');
                }
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Create Manager Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update manager permissions - Admin only
router.put('/:id/permissions', authenticateToken, requireRole('admin'), requestLock((req) => `manager-permissions-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const permissions = sanitizeManagerPermissions(req.body);

        logger.debug({ userId: id }, 'Updating manager permissions');

        const { data, error } = await supabase
            .from('manager_permissions')
            .upsert({
                user_id: id,
                ...permissions,
                updated_at: new Date()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Update Manager Permissions Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Toggle manager active status - Admin only
router.put('/:id/toggle-status', authenticateToken, requireRole('admin'), requestLock((req) => `manager-toggle-status:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const { data, error } = await supabase
            .from('manager_permissions')
            .upsert({
                user_id: id,
                ...sanitizeManagerPermissions(),
                is_active,
                updated_at: new Date()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Toggle Manager Status Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Resend manager verification email - Admin only
router.post('/:id/resend-verification', authenticateToken, requireRole('admin'), requestLock((req) => `manager-resend-verification:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const profile = await getManagerProfileOrThrow(req.params.id);

        if (profile.email_verified) {
            return res.status(400).json({ error: 'Manager email is already verified' });
        }

        if (!process.env.FRONTEND_URL) {
            throw new Error('FRONTEND_URL environment variable is required for manager verification emails');
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiresAt = new Date(Date.now() + MANAGER_VERIFICATION_TTL_MS).toISOString();

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: verificationExpiresAt
            })
            .eq('id', profile.id);

        if (updateError) {
            throw updateError;
        }

        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const result = await emailService.sendEmailConfirmation(profile.email, {
            name: profile.name,
            email: profile.email,
            verificationLink
        });

        if (!result?.success) {
            throw new Error(result?.error || 'Failed to send manager verification email');
        }

        res.json({ success: true, message: 'Manager verification email sent' });
    } catch (error) {
        logger.error({ err: error, managerId: req.params.id }, 'Resend Manager Verification Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Reissue manager temporary password - Admin only
router.post('/:id/reissue-temporary-password', authenticateToken, requireRole('admin'), requestLock((req) => `manager-reissue-password:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const profile = await getManagerProfileOrThrow(req.params.id);

        if (!profile.email_verified) {
            return res.status(400).json({ error: 'Manager email must be verified before reissuing a temporary password' });
        }

        const result = await issueManagerTemporaryPassword(profile);
        if (!result?.success) {
            throw new Error(result?.error || 'Failed to send manager temporary password');
        }

        res.json({
            success: true,
            message: 'Manager temporary password reissued',
            temporaryPasswordExpiryHours: MANAGER_TEMP_PASSWORD_EXPIRY_HOURS
        });
    } catch (error) {
        logger.error({ err: error, managerId: req.params.id }, 'Reissue Manager Temporary Password Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete a manager - Admin only
router.delete('/:id', authenticateToken, requireRole('admin'), requestLock((req) => `manager-delete:${req.params.id}`), async (req, res) => {
    try {
        const { id } = req.params;

        // Delete permissions first (cascade will handle this, but explicit is better)
        await supabase
            .from('manager_permissions')
            .delete()
            .eq('user_id', id);

        // Delete profile
        await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        await CustomAuthService.deleteAuthArtifacts(id);

        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Delete Manager Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get permissions for a specific user (used by frontend to check logged-in user's permissions)
router.get('/permissions/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        if (req.user.role !== 'admin') {
            if (req.user.role !== 'manager' || req.user.id !== userId) {
                return res.status(403).json({ error: req.t('errors.auth.unauthorized') });
            }
        }

        const { data, error } = await supabase
            .from('manager_permissions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Return null if no permissions found (means user is admin or customer)
        res.json(data || null);
    } catch (error) {
        logger.error({ err: error }, 'Get User Permissions Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
