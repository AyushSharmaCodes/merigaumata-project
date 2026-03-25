const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all active slides (public)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        const localizedData = data.map(slide => {
            if (slide.title_i18n && slide.title_i18n[lang]) slide.title = slide.title_i18n[lang];
            if (slide.subtitle_i18n && slide.subtitle_i18n[lang]) slide.subtitle = slide.subtitle_i18n[lang];
            return slide;
        });

        res.json(localizedData);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get all slides (admin)
router.get('/admin', authenticateToken, checkPermission('can_manage_carousel'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new slide - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_carousel'), requestLock('carousel-create'), idempotency(), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .insert([{
                ...req.body,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update slide - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_carousel'), requestLock((req) => `carousel-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete slide - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_carousel'), requestLock((req) => `carousel-delete:${req.params.id}`), async (req, res) => {
    try {
        const { error } = await supabase
            .from('carousel_slides')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, slideId: req.params.id }, 'Failed to delete carousel slide');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
