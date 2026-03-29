const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission, optionalAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

function canViewHiddenGalleryContent(req) {
    return req.user && (req.user.role === 'admin' || req.user.role === 'manager');
}

async function getPublicFolderIds() {
    const { data, error } = await supabase
        .from('gallery_folders')
        .select('id')
        .eq('is_active', true)
        .eq('is_hidden', false);

    if (error) throw error;
    return (data || []).map(folder => folder.id);
}

// Helper function to extract YouTube video ID from various URL formats
function extractYouTubeId(url) {
    const patterns = [
        /youtu\.be\/([^?]+)/,
        /youtube\.com\/watch\?v=([^&]+)/,
        /youtube\.com\/embed\/([^?]+)/,
        /youtube\.com\/v\/([^?]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// External API URLs from environment variables
const YOUTUBE_THUMBNAIL_BASE = process.env.YOUTUBE_THUMBNAIL_URL || 'https://img.youtube.com/vi';

// Helper function to generate YouTube thumbnail URL
function getYouTubeThumbnail(videoId) {
    return `${YOUTUBE_THUMBNAIL_BASE}/${videoId}/hqdefault.jpg`;
}

// Get all videos with optional filters
router.get('/', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('gallery_videos')
            .select('*');

        if (!canViewHiddenGalleryContent(req)) {
            const publicFolderIds = await getPublicFolderIds();
            if (publicFolderIds.length === 0) {
                return res.json([]);
            }
            query = query.in('folder_id', publicFolderIds);
        }

        // Filter by folder
        if (req.query.folder_id) {
            query = query.eq('folder_id', req.query.folder_id);
        }

        // Filter by tags
        if (req.query.tags) {
            const tags = req.query.tags.split(',');
            query = query.contains('tags', tags);
        }

        query = query.order('order_index', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        const localizedData = data.map(video => {
            if (video.title_i18n && video.title_i18n[lang]) {
                video.title = video.title_i18n[lang];
            }
            if (video.description_i18n && video.description_i18n[lang]) {
                video.description = video.description_i18n[lang];
            }
            return video;
        });

        res.json(localizedData);
    } catch (error) {
        logger.error({ err: error, query: req.query }, 'Failed to fetch gallery videos');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single video
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('gallery_videos')
            .select('*')
            .eq('id', req.params.id);

        if (!canViewHiddenGalleryContent(req)) {
            const publicFolderIds = await getPublicFolderIds();
            if (publicFolderIds.length === 0) {
                return res.status(404).json({ error: getFriendlyMessage(new Error('Gallery video not found'), 404) });
            }
            query = query.in('folder_id', publicFolderIds);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: getFriendlyMessage(new Error('Gallery video not found'), 404) });
        }

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        if (data.title_i18n && data.title_i18n[lang]) {
            data.title = data.title_i18n[lang];
        }
        if (data.description_i18n && data.description_i18n[lang]) {
            data.description = data.description_i18n[lang];
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error, videoId: req.params.id }, 'Failed to fetch gallery video');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get videos by folder
router.get('/folder/:folderId', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('gallery_videos')
            .select('*')
            .eq('folder_id', req.params.folderId);

        if (!canViewHiddenGalleryContent(req)) {
            const publicFolderIds = await getPublicFolderIds();
            if (!publicFolderIds.includes(req.params.folderId)) {
                return res.json([]);
            }
        }

        const { data, error } = await query.order('order_index', { ascending: true });

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        const localizedData = data.map(video => {
            if (video.title_i18n && video.title_i18n[lang]) {
                video.title = video.title_i18n[lang];
            }
            if (video.description_i18n && video.description_i18n[lang]) {
                video.description = video.description_i18n[lang];
            }
            return video;
        });

        res.json(localizedData);
    } catch (error) {
        logger.error({ err: error, folderId: req.params.folderId }, 'Failed to fetch gallery videos by folder');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new video - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_gallery'), requestLock('gallery-video-create'), idempotency(), async (req, res) => {
    try {
        const { title, title_i18n, description, description_i18n, youtube_url } = req.body;

        // Extract video ID from URL
        const videoId = extractYouTubeId(youtube_url);
        if (!videoId) {
            return res.status(400).json({ error: req.t('errors.gallery.invalidYoutubeUrl') });
        }

        // Generate thumbnail URL
        const thumbnailUrl = getYouTubeThumbnail(videoId);

        const { data, error } = await supabase
            .from('gallery_videos')
            .insert([{
                ...req.body,
                title_i18n: title_i18n || (title ? { en: title } : {}),
                description_i18n: description_i18n || (description ? { en: description } : {}),
                youtube_id: videoId,
                thumbnail_url: thumbnailUrl,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Failed to create gallery video');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update video - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_gallery'), requestLock((req) => `gallery-video-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { title, title_i18n, description, description_i18n } = req.body;
        let updateData = { ...req.body };

        if (title_i18n === undefined && title !== undefined) {
            updateData.title_i18n = { en: title };
        }
        if (description_i18n === undefined && description !== undefined) {
            updateData.description_i18n = { en: description };
        }

        // If YouTube URL is being updated, re-extract video ID and thumbnail
        if (req.body.youtube_url) {
            const videoId = extractYouTubeId(req.body.youtube_url);
            if (!videoId) {
                return res.status(400).json({ error: req.t('errors.gallery.invalidYoutubeUrl') });
            }
            updateData.youtube_id = videoId;
            updateData.thumbnail_url = getYouTubeThumbnail(videoId);
        }

        const { data, error } = await supabase
            .from('gallery_videos')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, videoId: req.params.id, body: req.body }, 'Failed to update gallery video');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete video - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_gallery'), requestLock((req) => `gallery-video-delete:${req.params.id}`), async (req, res) => {
    try {
        const { error } = await supabase
            .from('gallery_videos')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, videoId: req.params.id }, 'Failed to delete gallery video');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Bulk delete videos - Admin/Manager only
router.post('/bulk-delete', authenticateToken, checkPermission('can_manage_gallery'), requestLock((req) => `gallery-video-bulk-delete:${(req.body.ids || []).slice(0, 3).join(',')}`), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: req.t('errors.common.noItemsSelected') || 'No items selected' });
        }

        const { error } = await supabase
            .from('gallery_videos')
            .delete()
            .in('id', ids);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, ids: req.body.ids }, 'Failed to delete gallery videos bulk');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
