const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');

const { applyTranslations } = require('../utils/i18n.util');

// Get all categories (with optional type filter)
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;

        let query = supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        // Filter by type if provided
        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';

        // Preserve original name for admin editing by mapping before applying translations
        const mappedData = data.map(category => ({
            ...category,
            original_name: category.name
        }));

        res.json(applyTranslations(mappedData, lang));
    } catch (error) {
        logger.error({ err: error }, 'Error fetching categories');
        res.status(500).json({ error: error.message });
    }
});

// Get single category
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        res.json(applyTranslations(data, lang));
    } catch (error) {
        logger.error({ err: error, categoryId: req.params.id }, 'Error fetching category');
        res.status(500).json({ error: error.message });
    }
});

// Create category - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_categories'), async (req, res) => {
    try {
        const { name, name_i18n, type = 'product' } = req.body;

        // Validate type
        if (!['product', 'event', 'faq', 'gallery'].includes(type)) {
            return res.status(400).json({
                error: req.t('errors.category.invalidType')
            });
        }

        const { data, error } = await supabase
            .from('categories')
            .insert([{ name, name_i18n: name_i18n || { en: name }, type }])
            .select()
            .single();

        if (error) throw error;

        logger.info({ categoryId: data.id, name, type }, 'Category created');
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating category');
        res.status(500).json({ error: error.message });
    }
});

// Update category - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_categories'), async (req, res) => {
    try {
        const { name, name_i18n, type } = req.body;

        // Validate type if provided
        if (type && !['product', 'event', 'faq', 'gallery'].includes(type)) {
            return res.status(400).json({
                error: req.t('errors.category.invalidType')
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (name_i18n !== undefined) updateData.name_i18n = name_i18n;
        if (type !== undefined) updateData.type = type;

        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        logger.info({ categoryId: req.params.id, updates: Object.keys(updateData) }, 'Category updated');
        res.json(data);
    } catch (error) {
        logger.error({ err: error, categoryId: req.params.id }, 'Error updating category');
        res.status(500).json({ error: error.message });
    }
});

// Delete category - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_categories'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        logger.info({ categoryId: req.params.id }, 'Category deleted');
        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, categoryId: req.params.id }, 'Error deleting category');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
