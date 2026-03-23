
const logger = require('../utils/logger');
const { supabaseAdmin } = require('./supabase');

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

        // 2. Try to create the user
        let userId;
        let isNewUser = false;

        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { role: 'admin' }
        });

        if (createError) {
            if (createError.message?.includes('already registered') || createError.status === 422) {
                // User exists, find them
                // Strategy: Check profiles table first (fastest)
                const { data: profileData, error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', adminEmail)
                    .single();

                if (profileData) {
                    userId = profileData.id;
                } else {
                    // Fallback: Check Auth Users list (pagination handled simply for now, assuming admin is early user)
                    // Note: Supabase Admin listUsers doesn't support email filtering easily, we fetch page 1
                    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                    const foundUser = listData?.users?.find(u => u.email === adminEmail);

                    if (foundUser) {
                        userId = foundUser.id;
                    } else {
                        logger.error('[Bootstrap] Admin user exists but could not be found via Profile or ListUsers.');
                        return;
                    }
                }
            } else {
                throw createError;
            }
        } else {
            userId = createData.user.id;
            isNewUser = true;
            logger.info('[Bootstrap] Admin user created.');
        }

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

            // Update User Metadata (Critical for Auth Middleware)
            // Even if we created the user with metadata, the trigger might not affect metadata but 
            // subsequent updates ensuring it matches is good practice.
            // If user existed, we MUST update this.
            if (!isNewUser) {
                const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
                    userId,
                    { user_metadata: { role: 'admin' } }
                );
                if (updateMetaError) {
                    logger.warn({ err: updateMetaError }, '[Bootstrap] Failed to update admin user_metadata.');
                }
            }
        }

    } catch (error) {
        logger.error('[Bootstrap] Failed to bootstrap admin:', error.message);
    }
}

module.exports = { bootstrapAdmin };
