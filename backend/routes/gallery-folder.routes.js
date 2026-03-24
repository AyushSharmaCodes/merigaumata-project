const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { deletePhotosByUrls } = require('../services/photo.service');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all folders with their first image and category
router.get('/', async (req, res) => {
    try {
        const { data: folders, error } = await supabase
            .from('gallery_folders')
            .select(`
                *,
                category:categories (
                    id,
                    name,
                    name_i18n
                ),
                gallery_items (
                    image_url,
                    thumbnail_url
                )
            `)
            .order('order_index', { ascending: true })
            .order('order_index', { foreignTable: 'gallery_items', ascending: true })
            .limit(1, { foreignTable: 'gallery_items' });

        if (error) throw error;

        // Dynamic Data i18n for folder name, description and category
        const lang = req.language || req.query.lang || 'en';
        const localizedFolders = folders.map(folder => {
            // Localize category
            if (folder.category && folder.category.name_i18n && folder.category.name_i18n[lang]) {
                folder.category_name = folder.category.name_i18n[lang];
            } else if (folder.category) {
                folder.category_name = folder.category.name;
            }

            // Localize folder name
            if (folder.name_i18n && folder.name_i18n[lang]) {
                folder.name = folder.name_i18n[lang];
            }

            // Localize folder description
            if (folder.description_i18n && folder.description_i18n[lang]) {
                folder.description = folder.description_i18n[lang];
            }

            return folder;
        });

        res.json(localizedFolders);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch gallery folders');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single folder with items and videos
router.get('/:id', async (req, res) => {
    try {
        const { data: folder, error: folderError } = await supabase
            .from('gallery_folders')
            .select(`
                *,
                category:categories (
                    id,
                    name,
                    name_i18n
                )
            `)
            .eq('id', req.params.id)
            .single();

        if (folderError) throw folderError;

        // Dynamic Data i18n for category, name and description
        const lang = req.language || req.query.lang || 'en';
        if (folder.category && folder.category.name_i18n && folder.category.name_i18n[lang]) {
            folder.category_name = folder.category.name_i18n[lang];
        } else if (folder.category) {
            folder.category_name = folder.category.name;
        }

        if (folder.name_i18n && folder.name_i18n[lang]) {
            folder.name = folder.name_i18n[lang];
        }

        if (folder.description_i18n && folder.description_i18n[lang]) {
            folder.description = folder.description_i18n[lang];
        }

        // Get items for this folder
        const { data: items, error: itemsError } = await supabase
            .from('gallery_items')
            .select('*')
            .eq('folder_id', req.params.id)
            .order('order_index', { ascending: true });

        if (itemsError) throw itemsError;

        // Get videos for this folder
        const { data: videos, error: videosError } = await supabase
            .from('gallery_videos')
            .select('*')
            .eq('folder_id', req.params.id)
            .order('order_index', { ascending: true });

        if (videosError) throw videosError;

        res.json({
            ...folder,
            items: items || [],
            videos: videos || []
        });
    } catch (error) {
        logger.error({ err: error, folderId: req.params.id }, 'Failed to fetch gallery folder');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new folder - Admin/Manager only
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, name_i18n, description, description_i18n, slug, category_id, is_active, is_hidden, order_index } = req.body;

        const { data, error } = await supabase
            .from('gallery_folders')
            .insert([{
                name,
                name_i18n: name_i18n || { en: name },
                description,
                description_i18n: description_i18n || { en: description },
                slug,
                category_id,
                is_active: is_active ?? true,
                is_hidden: is_hidden ?? false,
                order_index: order_index ?? 0,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Failed to create gallery folder');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update folder - Admin/Manager only
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, name_i18n, description, description_i18n, slug, category_id, is_active, is_hidden, order_index } = req.body;

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) updateData.name = name;
        if (name_i18n !== undefined) updateData.name_i18n = name_i18n;
        if (description !== undefined) updateData.description = description;
        if (description_i18n !== undefined) updateData.description_i18n = description_i18n;
        if (slug !== undefined) updateData.slug = slug;
        if (category_id !== undefined) updateData.category_id = category_id;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (is_hidden !== undefined) updateData.is_hidden = is_hidden;
        if (order_index !== undefined) updateData.order_index = order_index;

        const { data, error } = await supabase
            .from('gallery_folders')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, folderId: req.params.id, body: req.body }, 'Failed to update gallery folder');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Set folder as home carousel - Admin/Manager only
router.put('/:id/set-carousel', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        // First, set all folders is_home_carousel to false
        const { error: resetError } = await supabase
            .from('gallery_folders')
            .update({ is_home_carousel: false })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

        if (resetError) throw resetError;

        // Then set the selected folder to true
        const { data, error } = await supabase
            .from('gallery_folders')
            .update({ is_home_carousel: true })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, folderId: req.params.id }, 'Failed to set gallery folder carousel');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete folder (cascades to items and videos) - Admin/Manager only
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        // 1. Fetch all items in this folder to get their image URLs
        const { data: items, error: itemsError } = await supabase
            .from('gallery_items')
            .select('imageUrl')
            .eq('folder_id', req.params.id);

        if (itemsError) throw itemsError;

        // 2. Delete images from storage
        if (items && items.length > 0) {
            const imageUrls = items.map(item => item.image_url).filter(url => url);
            if (imageUrls.length > 0) {
                await deletePhotosByUrls(imageUrls);
            }
        }

        // 3. Delete folder from database (cascades to items and videos)
        const { error } = await supabase
            .from('gallery_folders')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, folderId: req.params.id }, 'Failed to delete gallery folder');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
