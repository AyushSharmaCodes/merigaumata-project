const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin } = require('../lib/supabase');

const BCRYPT_ROUNDS = 10; // OWASP recommended for interactive auth (~70ms vs ~350ms at 12)
const APP_REFRESH_TOKEN_TABLE = 'app_refresh_tokens';

class CustomAuthService {
    static normalizeEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    static async hashPassword(password) {
        return bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    static async verifyPassword(password, hash) {
        if (!hash) return false;
        return bcrypt.compare(password, hash);
    }

    static async getAuthAccountByEmail(email) {
        const normalizedEmail = this.normalizeEmail(email);
        const { data, error } = await supabaseAdmin
            .from('auth_accounts')
            .select('user_id, email, password_hash, password_set_at, last_login_at')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    static async getAuthAccountByUserId(userId) {
        const { data, error } = await supabaseAdmin
            .from('auth_accounts')
            .select('user_id, email, password_hash, password_set_at, last_login_at')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    static async hasPasswordByEmail(email) {
        const account = await this.getAuthAccountByEmail(email);
        return !!account?.password_hash;
    }

    static async hasPasswordByUserId(userId) {
        const account = await this.getAuthAccountByUserId(userId);
        return !!account?.password_hash;
    }

    static async upsertLocalAccount({ userId, email, password, markLogin = false }) {
        const normalizedEmail = this.normalizeEmail(email);
        const passwordHash = password ? await this.hashPassword(password) : null;
        const payload = {
            user_id: userId,
            email: normalizedEmail,
            ...(passwordHash ? {
                password_hash: passwordHash,
                password_set_at: new Date().toISOString()
            } : {}),
            ...(markLogin ? { last_login_at: new Date().toISOString() } : {})
        };

        const [{ error: accountError }, { error: identityError }] = await Promise.all([
            supabaseAdmin
                .from('auth_accounts')
                .upsert(payload, { onConflict: 'user_id' }),
            supabaseAdmin
                .from('auth_identities')
                .upsert({
                    user_id: userId,
                    provider: 'LOCAL',
                    provider_email: normalizedEmail
                }, { onConflict: 'user_id,provider' })
        ]);

        if (accountError) throw accountError;
        if (identityError) throw identityError;
    }

    static async upsertGoogleIdentity({ userId, email, googleId }) {
        const normalizedEmail = this.normalizeEmail(email);
        const { error: accountError } = await supabaseAdmin
            .from('auth_accounts')
            .upsert({
                user_id: userId,
                email: normalizedEmail
            }, { onConflict: 'user_id' });

        if (accountError) throw accountError;

        const { error } = await supabaseAdmin
            .from('auth_identities')
            .upsert({
                user_id: userId,
                provider: 'GOOGLE',
                provider_user_id: googleId,
                provider_email: normalizedEmail
            }, { onConflict: 'user_id,provider' });

        if (error) throw error;
    }

    static async updatePassword(userId, newPassword) {
        const passwordHash = await this.hashPassword(newPassword);
        const { error } = await supabaseAdmin
            .from('auth_accounts')
            .update({
                password_hash: passwordHash,
                password_set_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;
    }

    static async touchLastLogin(userId) {
        const { error } = await supabaseAdmin
            .from('auth_accounts')
            .update({
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;
    }

    static async deleteAuthArtifacts(userId) {
        await Promise.all([
            supabaseAdmin.from('auth_accounts').delete().eq('user_id', userId),
            supabaseAdmin.from('auth_identities').delete().eq('user_id', userId),
            supabaseAdmin.from(APP_REFRESH_TOKEN_TABLE).delete().eq('user_id', userId)
        ]);
    }

    static generateRandomPassword() {
        return `${crypto.randomBytes(12).toString('hex')}Aa1!`;
    }
}

module.exports = CustomAuthService;
