const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

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
        res.status(500).json({ error: error.message });
    }
});

// Get all slides (admin)
router.get('/admin', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new slide - Admin/Manager only
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
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
        res.status(500).json({ error: error.message });
    }
});

// Update slide - Admin/Manager only
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
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
        res.status(500).json({ error: error.message });
    }
});

// Delete slide - Admin/Manager only
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('carousel_slides')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
