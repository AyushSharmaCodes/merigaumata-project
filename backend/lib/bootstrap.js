
const logger = require('../utils/logger');
const { supabaseAdmin } = require('./supabase');
const crypto = require('crypto');

const DEFAULT_ROLES = ['admin', 'manager', 'customer'];

async function bootstrapRoles() {
    logger.info({ roles: DEFAULT_ROLES }, '[Bootstrap] Verifying required roles...');

    // First attempt to seed roles
    const { error: roleSeedError } = await supabaseAdmin
        .from('roles')
        .upsert(
            DEFAULT_ROLES.map((name) => ({ name })),
            { onConflict: 'name' }
        );

    if (roleSeedError) {
        logger.error({ err: roleSeedError }, '[Bootstrap] Failed to seed required roles.');
        throw roleSeedError;
    }

    // Explicitly fetch all roles to ensure we have the latest state (UPSERT result can be empty if nothing updated)
    const { data: currentRoles, error: fetchError } = await supabaseAdmin
        .from('roles')
        .select('id, name');

    if (fetchError) {
        logger.error({ err: fetchError }, '[Bootstrap] Failed to fetch roles after seeding.');
        throw fetchError;
    }

    const roleMap = new Map((currentRoles || []).map((role) => [String(role.name).toLowerCase(), role.id]));
    const missingRoles = DEFAULT_ROLES.filter((role) => !roleMap.has(role));

    if (missingRoles.length > 0) {
        const error = new Error(`Missing required roles after bootstrap: ${missingRoles.join(', ')}`);
        logger.error({ missingRoles }, '[Bootstrap] Required roles are still missing after seeding.');
        throw error;
    }

    logger.info({ roles: DEFAULT_ROLES }, '[Bootstrap] Required roles verified.');
    return roleMap;
}

async function getBootstrapStatus() {
    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null;
    const adminPasswordConfigured = Boolean(process.env.ADMIN_PASSWORD);

    const { data: roles, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .in('name', DEFAULT_ROLES);

    if (roleError) {
        throw roleError;
    }

    const normalizedRoles = roles || [];
    const roleMap = Object.fromEntries(
        normalizedRoles.map((role) => [String(role.name).toLowerCase(), role.id])
    );

    let adminProfile = null;
    let adminProfileError = null;

    if (adminEmail) {
        const result = await supabaseAdmin
            .from('profiles')
            .select('id, email, role_id')
            .eq('email', adminEmail)
            .maybeSingle();

        adminProfile = result.data || null;
        adminProfileError = result.error || null;
    }

    if (adminProfileError) {
        throw adminProfileError;
    }

    return {
        roles: {
            required: DEFAULT_ROLES,
            available: normalizedRoles.map((role) => ({
                id: role.id,
                name: role.name
            })),
            missing: DEFAULT_ROLES.filter((role) => !roleMap[role]),
            seeded: DEFAULT_ROLES.every((role) => Boolean(roleMap[role]))
        },
        admin: {
            emailConfigured: Boolean(adminEmail),
            passwordConfigured: adminPasswordConfigured,
            configuredEmail: adminEmail,
            profileExists: Boolean(adminProfile),
            profileId: adminProfile?.id || null,
            hasAdminRole: Boolean(adminProfile?.role_id && roleMap.admin && adminProfile.role_id === roleMap.admin)
        }
    };
}

/**
 * Bootstraps the Admin user based on environment variables.
 * Idempotent: Checks if admin exists before creating.
 */
async function bootstrapAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    let roleMap;

    try {
        roleMap = await bootstrapRoles();
    } catch (error) {
        logger.error({ err: error }, '[Bootstrap] Role bootstrap failed. Admin bootstrap aborted.');
        return;
    }

    if (!adminEmail || !adminPassword) {
        logger.warn('[Bootstrap] ADMIN_EMAIL or ADMIN_PASSWORD not set. Roles were verified, but admin bootstrap is skipped.');
        return;
    }

    logger.info({ adminEmail: adminEmail.trim().toLowerCase() }, '[Bootstrap] Verifying admin user configuration...');

    try {
        const adminRoleId = roleMap.get('admin');
        if (!adminRoleId) {
            logger.error('[Bootstrap] Admin role missing after role bootstrap.');
            return;
        }

        const normalizedEmail = adminEmail.trim().toLowerCase();
        const fallbackName = normalizedEmail.split('@')[0];

        // 1. Create or update Supabase Auth user
        const { data: listResult, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingAuthUser = (listResult?.users || []).find(u => u.email === normalizedEmail);
        let authUser;

        if (existingAuthUser) {
            const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
                password: adminPassword,
                email_confirm: true,
                user_metadata: { full_name: fallbackName }
            });
            if (updateError) throw updateError;
            authUser = data.user;
        } else {
            const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: normalizedEmail,
                password: adminPassword,
                email_confirm: true,
                user_metadata: { full_name: fallbackName }
            });
            if (createError) throw createError;
            authUser = data.user;
        }

        if (!authUser) throw new Error('Failed to obtain auth user after create/update');
        const finalUserId = authUser.id;
        
        // 2. Ensure Profile exists and is updated with Admin details
        const { error: upsertProfileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: finalUserId,
                email: normalizedEmail,
                name: authUser.user_metadata?.full_name || fallbackName,
                first_name: authUser.user_metadata?.full_name?.split(' ')[0] || fallbackName,
                role_id: adminRoleId,
                preferred_language: 'en',
                email_verified: true,
                auth_provider: 'LOCAL'
            }, {
                onConflict: 'id'
            });

        if (upsertProfileError) {
            logger.error({ err: upsertProfileError }, '[Bootstrap] Failed to upsert admin profile details.');
            throw upsertProfileError;
        }

        logger.info({ adminEmail: normalizedEmail, userId: finalUserId }, '[Bootstrap] Admin bootstrap completed.');
    } catch (error) {
        logger.error({ err: error, adminEmail: adminEmail?.trim?.().toLowerCase?.() || adminEmail }, '[Bootstrap] Failed to bootstrap admin.');
    }
}

module.exports = { bootstrapAdmin, bootstrapRoles, getBootstrapStatus };
