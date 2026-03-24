const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission, optionalAuth } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all social media links
router.get('/', optionalAuth, async (req, res) => {
    try {
        const isAdminView = req.query.isAdmin === 'true'
            && req.user
            && (req.user.role === 'admin' || req.user.role === 'manager');

        let query = supabase
            .from('social_media')
            .select('*')
            .order('display_order', { ascending: true });

        // Filter by active status for public users
        if (!isAdminView) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Dynamic Data i18n: Overlay localized content
        const lang = req.language || req.query.lang || 'en';
        const localizedData = data.map(social => {
            if (social.platform_i18n && social.platform_i18n[lang]) {
                social.platform = social.platform_i18n[lang];
            }
            return social;
        });

        res.json(localizedData);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching social media links:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new social media link (admin only)
router.post('/', authenticateToken, checkPermission('can_manage_social_media'), async (req, res) => {
    try {
        const { platform, url, icon, display_order, is_active } = req.body;

        if (!platform || !url) {
            return res.status(400).json({ error: req.t('errors.social.platformUrlRequired') });
        }

        const { data, error } = await supabase
            .from('social_media')
            .insert([{
                platform,
                url,
                icon,
                display_order: display_order || 0,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating social media link:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update social media link (admin only)
router.put('/:id', authenticateToken, checkPermission('can_manage_social_media'), async (req, res) => {
    try {
        const { id } = req.params;
        const { platform, url, icon, display_order, is_active } = req.body;

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (platform !== undefined) updateData.platform = platform;
        if (url !== undefined) updateData.url = url;
        if (icon !== undefined) updateData.icon = icon;
        if (display_order !== undefined) updateData.display_order = display_order;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('social_media')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: req.t('errors.social.linkNotFound') });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating social media link:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete social media link (admin only)
router.delete('/:id', authenticateToken, checkPermission('can_manage_social_media'), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('social_media')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: req.t('success.socialMedia.deleted') });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting social media link:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Reorder links (admin only)
router.put('/reorder/bulk', authenticateToken, checkPermission('can_manage_social_media'), async (req, res) => {
    try {
        const { links } = req.body;

        if (!Array.isArray(links)) {
            return res.status(400).json({ error: req.t('errors.social.linksRequired') });
        }

        const updates = links.map((link, index) =>
            supabase
                .from('social_media')
                .update({
                    display_order: index,
                    updated_at: new Date().toISOString()
                })
                .eq('id', link.id)
        );

        await Promise.all(updates);

        res.json({ message: req.t('success.socialMedia.reordered') });
    } catch (error) {
        logger.error({ err: error }, 'Error reordering social media links:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
