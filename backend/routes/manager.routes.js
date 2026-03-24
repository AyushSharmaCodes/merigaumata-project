const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const crypto = require('crypto');
const emailService = require('../services/email');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all managers with their permissions - Admin only
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
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
        const { data: managers, error } = await supabase
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
            `)
            .eq('role_id', managerRole.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform data to flatten creator name
        const transformedManagers = managers.map(manager => ({
            ...manager,
            creator_name: manager.creator?.name || 'System'
        }));

        res.json(transformedManagers || []);
    } catch (error) {
        logger.error({ err: error }, 'Get Managers Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create a new manager - Admin only
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { email, name, permissions, created_by } = req.body;

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

        // Generate random password
        const password = crypto.randomBytes(8).toString('hex');

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: 'manager' }
        });

        if (authError) throw authError;

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
                id: authData.user.id,
                email,
                name,
                first_name: firstName,
                last_name: lastName,
                role_id: roleData?.id,
                email_verified: true,
                created_by: created_by || null,
                must_change_password: true // Force password change on first login
            });

        if (profileError) {
            // Rollback: delete auth user
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw profileError;
        }

        // Create manager permissions
        logger.debug({ userId: authData.user.id }, 'Creating manager permissions');

        const { data: permData, error: permError } = await supabase
            .from('manager_permissions')
            .insert({
                user_id: authData.user.id,
                is_active: true,
                ...permissions
            })
            .select()
            .single();

        if (permError) {
            logger.error({ err: permError }, 'Error creating permissions:');
            // Rollback: delete profile and auth user
            await supabase.from('profiles').delete().eq('id', authData.user.id);
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw permError;
        }

        // Send Welcome Email with Password
        try {
            await emailService.sendManagerWelcomeEmail(email, name, password);
        } catch (emailError) {
            logger.error({ err: emailError }, 'Failed to send manager welcome email');
            // Don't fail the request, just log it
        }

        logger.info({ userId: authData.user.id }, 'Manager created and permissions assigned');

        res.status(201).json({
            id: authData.user.id,
            email,
            name,
            permissions: permData
        });
    } catch (error) {
        logger.error({ err: error }, 'Create Manager Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update manager permissions - Admin only
router.put('/:id/permissions', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const permissions = req.body;

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
router.put('/:id/toggle-status', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const { data, error } = await supabase
            .from('manager_permissions')
            .upsert({
                user_id: id,
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
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
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

        // Delete from auth
        const { error: authError } = await supabase.auth.admin.deleteUser(id);

        if (authError) {
            logger.error({ err: authError }, 'Auth deletion warning:');
            // Continue even if auth deletion fails
        }

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
