
const logger = require('../utils/logger');
const { supabaseAdmin } = require('./supabase');
const CustomAuthService = require('../services/custom-auth.service');
const crypto = require('crypto');

/**
 * Bootstraps the Admin user based on environment variables.
 * Idempotent: Checks if admin exists before creating.
 */
async function bootstrapAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        logger.info('[Bootstrap] ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin bootstrap.');
        return;
    }

    logger.info('[Bootstrap] Verifying admin user configuration...');

    try {
        // 1. Get Admin Role ID
        const { data: roleData, error: roleError } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'admin')
            .single();

        if (roleError || !roleData) {
            logger.error('[Bootstrap] Failed to fetch admin role ID from database. Ensure roles table is seeded.');
            return;
        }

        const adminRoleId = roleData.id;

        let isNewUser = false;
        const normalizedAdminEmail = adminEmail.trim().toLowerCase();
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', normalizedAdminEmail)
            .maybeSingle();

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

    } catch (error) {
        logger.error('[Bootstrap] Failed to bootstrap admin:', error.message);
    }
}

module.exports = { bootstrapAdmin };
