
const logger = require('../utils/logger');
const { supabaseAdmin } = require('./supabase');
const CustomAuthService = require('../services/custom-auth.service');
const crypto = require('crypto');

const DEFAULT_ROLES = ['admin', 'manager', 'customer'];

async function bootstrapRoles() {
    logger.info({ roles: DEFAULT_ROLES }, '[Bootstrap] Verifying required roles...');

    const { error: roleSeedError } = await supabaseAdmin
        .from('roles')
        .upsert(
            DEFAULT_ROLES.map((name) => ({ name })),
            { onConflict: 'name', ignoreDuplicates: true }
        );

    if (roleSeedError) {
        logger.error({ err: roleSeedError }, '[Bootstrap] Failed to seed required roles.');
        throw roleSeedError;
    }

    const { data: roles, error: roleFetchError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .in('name', DEFAULT_ROLES);

    if (roleFetchError) {
        logger.error({ err: roleFetchError }, '[Bootstrap] Failed to fetch seeded roles.');
        throw roleFetchError;
    }

    const roleMap = new Map((roles || []).map((role) => [String(role.name).toLowerCase(), role.id]));
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

        let isNewUser = false;
        const normalizedAdminEmail = adminEmail.trim().toLowerCase();
        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', normalizedAdminEmail)
            .maybeSingle();

        if (existingProfileError) {
            throw existingProfileError;
        }

        const userId = existingProfile?.id || crypto.randomUUID();
        isNewUser = !existingProfile;

        if (isNewUser) {
            const name = normalizedAdminEmail.split('@')[0];
            const { error: insertProfileError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: userId,
                    email: normalizedAdminEmail,
                    name,
                    first_name: name,
                    last_name: null,
                    role_id: adminRoleId,
                    preferred_language: 'en',
                    email_verified: true,
                    auth_provider: 'LOCAL'
                });

            if (insertProfileError) {
                throw insertProfileError;
            }

            logger.info('[Bootstrap] Admin profile created.');
        }

        await CustomAuthService.upsertLocalAccount({
            userId,
            email: normalizedAdminEmail,
            password: adminPassword
        });

        // 3. Ensure "admin" role in Profiles table and User Metadata
        if (userId) {
            // Update Profile (Critical for Application Logic)
            const { error: updateProfileError } = await supabaseAdmin
                .from('profiles')
                .update({ role_id: adminRoleId })
                .eq('id', userId);

            if (updateProfileError) {
                logger.error({ err: updateProfileError }, '[Bootstrap] Failed to update admin profile role.');
            } else {
                if (isNewUser) {
                    logger.info('[Bootstrap] Admin profile role set to "admin".');
                } else {
                    logger.info('[Bootstrap] Ensure admin profile role is "admin".');
                }
            }

        }

        logger.info({ adminEmail: normalizedAdminEmail, userId, isNewUser }, '[Bootstrap] Admin bootstrap completed.');
    } catch (error) {
        logger.error({ err: error, adminEmail: adminEmail?.trim?.().toLowerCase?.() || adminEmail }, '[Bootstrap] Failed to bootstrap admin.');
    }
}

module.exports = { bootstrapAdmin, bootstrapRoles, getBootstrapStatus };
