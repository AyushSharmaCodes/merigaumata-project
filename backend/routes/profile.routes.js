const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const AuthService = require('../services/auth.service');
const multer = require('multer');

const { v4: uuidv4 } = require('uuid');
const { getUserAddresses } = require('../services/address.service');
const phoneValidator = require('../utils/phone-validator');
const { getFriendlyMessage, getI18nKey } = require('../utils/error-messages');
const translationService = require('../services/translation.service');
const CustomAuthService = require('../services/custom-auth.service');
const {
    buildStoragePath,
    deleteAssetByUrl,
    sanitizeFileName,
    uploadBuffer
} = require('../services/storage-asset.service');

// Configure multer for memory storage (we'll process before uploading)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error(req.t('errors.upload.imagesOnly')), false);
        }
    },
});

const SUPPORTED_PREFERENCE_LANGUAGES = ['en', 'hi', 'ta', 'te'];

function normalizePreferenceLanguage(language) {
    if (typeof language !== 'string') return null;
    const normalized = language.trim().toLowerCase();
    return SUPPORTED_PREFERENCE_LANGUAGES.includes(normalized) ? normalized : null;
}

function normalizePreferenceCurrency(currency) {
    if (typeof currency !== 'string') return null;
    const normalized = currency.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

/**
 * GET /api/profile
 * Get current user's profile with addresses
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        logger.debug(`[ProfileRoutes] Fetching profile for user ${userId}`);

        // Optimized single query for profile, roles, phone numbers, and addresses
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select(`
                *,
                roles (name),
                phone_numbers!phone_numbers_user_id_fkey (
                    phone_number,
                    updated_at
                ),
                addresses (
                    *,
                    phone_numbers (
                        phone_number
                    )
                )
            `)
            .eq('id', userId)
            .eq('is_deleted', false)
            .order('updated_at', { foreignTable: 'phone_numbers', ascending: false })
            .order('is_primary', { foreignTable: 'addresses', ascending: false })
            .order('created_at', { foreignTable: 'addresses', ascending: false })
            .single();

        if (profileError) throw profileError;

        if (!profile) {
            return res.status(404).json({ error: getI18nKey('PROFILE_NOT_FOUND') });
        }

        // Extract latest user phone
        const latestPhone = profile.phone_numbers?.[0]?.phone_number || profile.phone || null;

        // Transform addresses to camelCase and format
        const transformedAddresses = (profile.addresses || []).map(address => {
            // Flatten phone from joined phone_numbers
            const phone = address.phone_numbers?.phone_number || address.phone || '';

            return {
                id: address.id,
                userId: address.user_id,
                type: address.type,
                isPrimary: address.is_primary,
                streetAddress: address.street_address,
                apartment: address.apartment,
                city: address.city,
                state: address.state,
                postalCode: address.postal_code,
                country: address.country,
                label: address.label,
                phone: phone,
                createdAt: address.created_at,
                updatedAt: address.updated_at
            };
        });

        logger.debug(`[ProfileRoutes] Successfully fetched profile for user ${userId}`);

        let profileResponse = {
            id: profile.id,
            email: profile.email,
            firstName: profile.first_name,
            lastName: profile.last_name,
            name: `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`,
            phone: latestPhone,
            gender: profile.gender,
            language: profile.preferred_language || 'en',
            preferredCurrency: profile.preferred_currency || 'INR',
            avatarUrl: profile.avatar_url,
            role: profile.roles?.name || 'customer',
            emailVerified: profile.email_verified,
            phoneVerified: profile.phone_verified,
            authProvider: profile.auth_provider || 'LOCAL',
            addresses: transformedAddresses
        };

        // Automatic Translation if requested
        const targetLang = req.query.lang;
        if (targetLang && targetLang !== 'en') {
            profileResponse = await translationService.translateProfileResult(profileResponse, targetLang);
        }

        res.json(profileResponse);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching profile:');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

/**
 * PUT /api/profile
 * Update user's personal information
 */
router.put('/', authenticateToken, requestLock('profile-update'), idempotency(), async (req, res) => {
    logger.info({ body: req.body, userId: req.user.userId }, 'Profile Update Request Received');
    try {
        const userId = req.user.userId;
        const { firstName, lastName, gender, phone, language } = req.body;

        // Validation
        if (!firstName || firstName.trim().length === 0) {
            return res.status(400).json({ error: getI18nKey('FIRST_NAME_REQUIRED') });
        }

        if (gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(gender)) {
            return res.status(400).json({ error: getI18nKey('INVALID_GENDER') });
        }


        // Phone validation (basic format)
        if (phone && phone.trim().length > 0) {
            // Allow optional + at start, then digits. Allow spaces/dashes/parentheses in input but strip them for check.
            const sanitizedPhone = phone.replace(/[\s\-\(\)]/g, '');
            const phoneRegex = /^\+?[0-9]{10,15}$/;

            if (!phoneRegex.test(sanitizedPhone)) {
                return res.status(400).json({ error: getI18nKey('INVALID_PHONE') });
            }

            // Abstract API validation
            logger.info({ phone }, 'Calling phone validator service from profile route');
            const validationResult = await phoneValidator.validate(phone);
            if (!validationResult.isValid) {
                return res.status(400).json({ error: validationResult.error });
            }
        }

        // Handle phone number update - save to phone_numbers table
        if (phone && phone.trim().length > 0) {
            // Check if this phone number already exists for this user
            const { data: existingPhone } = await supabase
                .from('phone_numbers')
                .select('id')
                .eq('user_id', userId)
                .eq('phone_number', phone.trim())
                .single();

            if (existingPhone) {
                // Update the existing entry to mark it as latest
                await supabase
                    .from('phone_numbers')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', existingPhone.id);
            } else {
                // Create new phone number entry
                await supabase
                    .from('phone_numbers')
                    .insert([{
                        user_id: userId,
                        phone_number: phone.trim(),
                        label: 'Mobile',
                        is_primary: true
                    }]);
            }
        }

        // Ensure names are stored in English (Parallel Translation)
        const [englishFirstName, englishLastName] = await Promise.all([
            translationService.translateText(firstName.trim(), 'en'),
            lastName ? translationService.translateText(lastName.trim(), 'en') : Promise.resolve(null)
        ]);

        const englishFullName = `${englishFirstName.trim()}${englishLastName ? ' ' + englishLastName.trim() : ''}`;

        // Update profile (keeping phone in profiles table for backward compatibility)
        const updateData = {
            first_name: englishFirstName.trim(),
            last_name: englishLastName ? englishLastName.trim() : null,
            gender: gender || null,
            phone: phone ? phone.trim() : null,
            name: englishFullName, // Keep name field in sync
        };

        if (language !== undefined) {
            const normalizedLanguage = normalizePreferenceLanguage(language);
            if (!normalizedLanguage) {
                return res.status(400).json({ error: getI18nKey('INVALID_LANGUAGE') });
            }
            updateData.preferred_language = normalizedLanguage;
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            message: getI18nKey('PROFILE_UPDATED'),
            profile: {
                firstName: data.first_name,
                lastName: data.last_name,
                gender: data.gender,
                phone: data.phone,
                language: data.preferred_language || 'en',
                preferredCurrency: data.preferred_currency || 'INR'
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error updating profile:');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

router.patch('/preferences', authenticateToken, requestLock('profile-preferences-update'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { language, currency } = req.body || {};
        const updateData = {};

        if (language !== undefined) {
            const normalizedLanguage = normalizePreferenceLanguage(language);
            if (!normalizedLanguage) {
                return res.status(400).json({ error: getI18nKey('INVALID_LANGUAGE') });
            }
            updateData.preferred_language = normalizedLanguage;
        }

        if (currency !== undefined) {
            const normalizedCurrency = normalizePreferenceCurrency(currency);
            if (!normalizedCurrency) {
                return res.status(400).json({ error: getI18nKey('INVALID_CURRENCY') });
            }
            updateData.preferred_currency = normalizedCurrency;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: getI18nKey('NO_PROFILE_PREFERENCES_PROVIDED') });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select('preferred_language, preferred_currency')
            .single();

        if (error) throw error;

        res.json({
            message: getI18nKey('PROFILE_UPDATED'),
            preferences: {
                language: data.preferred_language || 'en',
                currency: data.preferred_currency || 'INR'
            }
        });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, 'Error updating profile preferences:');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

/**
 * POST /api/profile/avatar
 * Upload and update user's profile avatar
 */
router.post('/avatar', authenticateToken, requestLock('profile-avatar-upload'), upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.userId;

        if (!req.file) {
            return res.status(400).json({ error: getI18nKey('NO_IMAGE') });
        }

        // Sharp processing removed to prevent memory spikes
        const processedImage = req.file.buffer;
        const contentType = req.file.mimetype;
        const fileExt = contentType.split('/')[1] || 'jpg';

        // Generate unique filename
        const filename = sanitizeFileName(`${userId}-${uuidv4()}.${fileExt}`);
        const filepath = buildStoragePath('avatars', filename);
        const uploadedAsset = await uploadBuffer({
            bucketName: 'profile-images',
            filePath: filepath,
            buffer: processedImage,
            contentType: contentType,
            upsert: false,
            isPublic: true
        });

        // Delete old avatar if exists
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (currentProfile?.avatar_url) {
            await deleteAssetByUrl(currentProfile.avatar_url).catch((cleanupError) => {
                logger.warn({ err: cleanupError, userId }, 'Failed to delete previous avatar from storage');
            });
        }

        // Update profile with new avatar URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: uploadedAsset.url })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({
            message: getI18nKey('AVATAR_UPLOADED'),
            avatarUrl: uploadedAsset.url
        });
    } catch (error) {
        logger.error({ err: error }, 'Error uploading avatar:');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

/**
 * DELETE /api/profile/avatar
 * Remove user's profile avatar
 */
router.delete('/avatar', authenticateToken, requestLock('profile-avatar-delete'), async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get current profile to check for avatar
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        if (!profile || !profile.avatar_url) {
            return res.status(404).json({ error: getI18nKey('NO_AVATAR_TO_DELETE') });
        }

        await deleteAssetByUrl(profile.avatar_url);

        // Update profile to remove avatar URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({ message: getI18nKey('AVATAR_DELETED') });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting avatar:');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

/**
 * POST /api/profile/delete-account
 * Completely delete user account and personal data
 * Preserves only name and email for public contributions (comments, reviews, testimonials)
 */
router.post('/delete-account', authenticateToken, requestLock('profile-delete-account'), idempotency(), async (req, res) => {
    return res.status(410).json({
        error: 'Legacy account deletion endpoint retired. Use /api/account/delete for OTP-verified deletion.'
    });
});

/**
 * POST /api/profile/change-password
 * Change current user's password
 */
router.post('/change-password', authenticateToken, requestLock('profile-change-password'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: req.t('errors.validation.passwordLength') });
        }

        await CustomAuthService.updatePassword(userId, newPassword);

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ must_change_password: false })
            .eq('id', userId);

        if (profileError) {
            logger.error({ err: profileError }, 'Failed to clear must_change_password flag');
            // Don't fail request as password *was* changed
        }

        res.json({ message: getI18nKey('PASSWORD_UPDATED') });
    } catch (error) {
        logger.error({ err: error }, 'Error changing password:');
        const friendlyMessage = getFriendlyMessage(error);
        res.status(500).json({ error: friendlyMessage });
    }
});

/**
 * POST /api/profile/send-email-verification
 * Send email verification for Google auth users
 * Only works for users with auth_provider = 'GOOGLE' and email_verified = false
 */
router.post('/send-email-verification', authenticateToken, requestLock('profile-send-email-verification'), idempotency(), async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await AuthService.sendGoogleUserVerificationEmail(userId);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error sending email verification:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
