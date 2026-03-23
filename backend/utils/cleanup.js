const supabase = require('../config/supabase');
const logger = require('./logger');

/**
 * Clean up orphaned Supabase Auth users
 * (users who exist in Auth but not in profiles table)
 */
async function cleanupOrphanedUser(email) {
    try {
        logger.debug({ email }, '[Cleanup] Checking for orphaned user');

        // Check if user exists in profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (profile) {
            logger.debug({ email }, '[Cleanup] User has profile, no cleanup needed');
            return { cleaned: false, reason: 'User has profile' };
        }

        // User doesn't have profile, check if they exist in Auth
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const authUser = users.find(u => u.email === email);

        if (!authUser) {
            logger.debug({ email }, '[Cleanup] No orphaned user found in Auth');
            return { cleaned: false, reason: 'No auth user found' };
        }

        // Found orphaned user, delete them
        logger.info({ email, userId: authUser.id }, '[Cleanup] Deleting orphaned auth user');

        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);

        if (deleteError) {
            logger.error({ err: deleteError, email, userId: authUser.id }, '[Cleanup] Failed to delete orphaned user');
            throw deleteError;
        }

        logger.info({ email, userId: authUser.id }, '[Cleanup] Successfully deleted orphaned user');

        // Wait for deletion to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        return { cleaned: true, userId: authUser.id };
    } catch (error) {
        logger.error({ err: error, email }, '[Cleanup] Error during cleanup');
        throw error;
    }
}

module.exports = {
    cleanupOrphanedUser
};
