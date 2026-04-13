const supabase = require('../lib/supabase');
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

        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const authUser = users.find(u => u.email === email.toLowerCase().trim());

        if (!authUser) {
            logger.debug({ email }, '[Cleanup] No orphaned auth user found');
            return { cleaned: false, reason: 'No auth user found' };
        }

        logger.info({ email, userId: authUser.id }, '[Cleanup] Deleting orphaned auth user');
        await supabase.auth.admin.deleteUser(authUser.id);
        return { cleaned: true, userId: authUser.id };
    } catch (error) {
        logger.error({ err: error, email }, '[Cleanup] Error during cleanup');
        throw error;
    }
}

module.exports = {
    cleanupOrphanedUser
};
