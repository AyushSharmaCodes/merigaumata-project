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

        if (!email || !name) {
            return res.status(400).json({ error: req.t('errors.manager.emailNameRequired') });
        }

        // Check if user already exists
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(400).json({ error: req.t('errors.manager.emailExists') });
        }

        const password = CustomAuthService.generateRandomPassword();
        const userId = crypto.randomUUID();

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
                email,
                name,
                first_name: firstName,
                last_name: lastName,
                role_id: roleData?.id,
                preferred_language: 'en',
                email_verified: true,
                created_by: req.user.id,
                must_change_password: true,
                auth_provider: 'LOCAL'
            });

        if (profileError) {
            throw profileError;
        }

        await CustomAuthService.upsertLocalAccount({
            userId,
            email,
            password
        });

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
            await supabase.from('profiles').delete().eq('id', userId);
            await CustomAuthService.deleteAuthArtifacts(userId);
            throw permError;
        }

        // Send Welcome Email with Password
        try {
            await emailService.sendManagerWelcomeEmail(email, name, password);
        } catch (emailError) {
            logger.error({ err: emailError }, 'Failed to send manager welcome email');
            // Don't fail the request, just log it
        }

        logger.info({ userId }, 'Manager created and permissions assigned');

        res.status(201).json({
            message: 'success.manager.created',
            id: userId,
            email,
            name,
            mustChangePassword: true,
            temporaryPasswordSent: true,
            permissions: permData
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
