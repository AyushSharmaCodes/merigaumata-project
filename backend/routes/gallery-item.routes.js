const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../lib/supabase');
const { deletePhotoByUrl, deletePhotosByUrls } = require('../services/photo.service');
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

// Get all items with optional filters
router.get('/', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('gallery_items')
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

        if (req.query.limit) {
            const limit = parseInt(req.query.limit, 10);
            if (!Number.isNaN(limit) && limit > 0) {
                query = query.limit(limit);
            }
        }

        query = query.order('order_index', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        const localizedData = data.map(item => {
            if (item.title_i18n && item.title_i18n[lang]) {
                item.title = item.title_i18n[lang];
            }
            if (item.description_i18n && item.description_i18n[lang]) {
                item.description = item.description_i18n[lang];
            }
            return item;
        });

        res.json(localizedData);
    } catch (error) {
        logger.error({ err: error, query: req.query }, 'Failed to fetch gallery items');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single item
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('gallery_items')
            .select('*')
            .eq('id', req.params.id);

        if (!canViewHiddenGalleryContent(req)) {
            const publicFolderIds = await getPublicFolderIds();
            if (publicFolderIds.length === 0) {
                return res.status(404).json({ error: getFriendlyMessage(new Error('Gallery item not found'), 404) });
            }
            query = query.in('folder_id', publicFolderIds);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: getFriendlyMessage(new Error('Gallery item not found'), 404) });
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
        logger.error({ err: error, itemId: req.params.id }, 'Failed to fetch gallery item');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get items by folder
router.get('/folder/:folderId', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('gallery_items')
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
        const localizedData = data.map(item => {
            if (item.title_i18n && item.title_i18n[lang]) {
                item.title = item.title_i18n[lang];
            }
            if (item.description_i18n && item.description_i18n[lang]) {
                item.description = item.description_i18n[lang];
            }
            return item;
        });

        res.json(localizedData);
    } catch (error) {
        logger.error({ err: error, folderId: req.params.folderId }, 'Failed to fetch gallery items by folder');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new item - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_gallery'), requestLock(req => `gallery-item-create:${req.body.image_url || 'default'}`), idempotency(), async (req, res) => {
    try {
        const { title, title_i18n, description, description_i18n } = req.body;
        const { data, error } = await supabase
            .from('gallery_items')
            .insert([{
                ...req.body,
                title_i18n: title_i18n || (title ? { en: title } : {}),
                description_i18n: description_i18n || (description ? { en: description } : {}),
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Failed to create gallery item');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update item - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_gallery'), requestLock((req) => `gallery-item-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { title, title_i18n, description, description_i18n } = req.body;
        const updateData = { ...req.body };

        if (title_i18n === undefined && title !== undefined) {
            updateData.title_i18n = { en: title };
        }
        if (description_i18n === undefined && description !== undefined) {
            updateData.description_i18n = { en: description };
        }

        const { data, error } = await supabase
            .from('gallery_items')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, itemId: req.params.id, body: req.body }, 'Failed to update gallery item');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete item (also removes from storage) - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_gallery'), requestLock((req) => `gallery-item-delete:${req.params.id}`), async (req, res) => {
    try {
        // Fetch the item to get the image URL
        const { data: item, error: fetchError } = await supabase
            .from('gallery_items')
            .select('image_url')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        // Delete from database
        const { error: deleteError } = await supabase
            .from('gallery_items')
            .delete()
            .eq('id', req.params.id);

        if (deleteError) throw deleteError;

        // Clean up storage and photos table
        if (item?.image_url) {
            try {
                await deletePhotoByUrl(item.image_url);
                logger.info({ imageUrl: item.image_url }, '✅ Gallery item storage cleaned up');
            } catch (err) {
                logger.error({ err: err, imageUrl: item.image_url }, '❌ Failed to delete gallery item storage:');
                // We've already deleted from DB, so we return 204 but log the failure
            }
        }

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, itemId: req.params.id }, 'Failed to delete gallery item');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete multiple items (also removes from storage) - Admin/Manager only
router.post('/bulk-delete', authenticateToken, checkPermission('can_manage_gallery'), requestLock((req) => `gallery-item-bulk-delete:${(req.body.ids || []).slice(0, 3).join(',')}`), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: req.t('errors.common.noItemsSelected') || 'No items selected' });
        }

        logger.info({ count: ids.length }, '🗑️  Bulk deleting gallery items:');

        // 1. Fetch items to get URLs for storage cleanup
        const { data: items, error: fetchError } = await supabase
            .from('gallery_items')
            .select('image_url')
            .in('id', ids);

        if (fetchError) throw fetchError;

        // 2. Delete from database
        const { error: deleteError } = await supabase
            .from('gallery_items')
            .delete()
            .in('id', ids);

        if (deleteError) throw deleteError;

        // 3. Clean up storage
        const imageUrls = (items || []).map(item => item.image_url).filter(Boolean);
        if (imageUrls.length > 0) {
            try {
                const results = await deletePhotosByUrls(imageUrls);
                const successCount = results.filter(r => r.success).length;
                logger.info({ total: imageUrls.length, success: successCount }, '✅ Bulk storage cleanup finished');
            } catch (storageErr) {
                logger.error({ err: storageErr }, '⚠️  Bulk storage cleanup failed (partially or fully):');
                // Already deleted from DB, so we continue
            }
        }

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, ids: req.body.ids }, 'Failed to delete gallery items bulk');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
