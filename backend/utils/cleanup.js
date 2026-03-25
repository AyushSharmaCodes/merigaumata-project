const supabase = require('../config/supabase');
const logger = require('./logger');
const CustomAuthService = require('../services/custom-auth.service');

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

        const { data: authAccount } = await supabase
            .from('auth_accounts')
            .select('user_id')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (!authAccount) {
            logger.debug({ email }, '[Cleanup] No orphaned custom auth user found');
            return { cleaned: false, reason: 'No auth user found' };
        }

        logger.info({ email, userId: authAccount.user_id }, '[Cleanup] Deleting orphaned custom auth user');
        await CustomAuthService.deleteAuthArtifacts(authAccount.user_id);
        return { cleaned: true, userId: authAccount.user_id };
    } catch (error) {
        logger.error({ err: error, email }, '[Cleanup] Error during cleanup');
        throw error;
    }
}

module.exports = {
    cleanupOrphanedUser
};
