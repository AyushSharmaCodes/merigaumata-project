const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Get all testimonials
router.get('/', async (req, res) => {
    try {
        let query = supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false });

        if (req.query.limit) {
            const limit = parseInt(req.query.limit, 10);
            if (!Number.isNaN(limit) && limit > 0) {
                query = query.limit(limit);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        const localizedData = (data || []).map(t => {
            if (t.content_i18n && t.content_i18n[lang]) t.content = t.content_i18n[lang];
            if (t.name_i18n && t.name_i18n[lang]) t.name = t.name_i18n[lang];
            if (t.role_i18n && t.role_i18n[lang]) t.role = t.role_i18n[lang];
            return t;
        });

        res.json(localizedData);
    } catch (error) {
        logger.error({ err: error, query: req.query }, 'Failed to fetch testimonials');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single testimonial
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        if (data.content_i18n && data.content_i18n[lang]) data.content = data.content_i18n[lang];
        if (data.name_i18n && data.name_i18n[lang]) data.name = data.name_i18n[lang];
        if (data.role_i18n && data.role_i18n[lang]) data.role = data.role_i18n[lang];

        res.json(data);
    } catch (error) {
        logger.error({ err: error, testimonialId: req.params.id }, 'Failed to fetch testimonial');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create testimonial - Admin/Manager only
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, role, content } = req.body;
        const LANGUAGES = ['hi', 'ta', 'te'];

        const name_i18n = {};
        const role_i18n = {};
        const content_i18n = {};

        // Auto-translate if fields are present
        if (name || role || content) {
            const TranslationService = require('../services/translation.service');
            for (const lang of LANGUAGES) {
                try {
                    const [nameTr, roleTr, contentTr] = await Promise.all([
                        TranslationService.translateText(name, lang),
                        TranslationService.translateText(role, lang),
                        TranslationService.translateText(content, lang)
                    ]);

                    if (name) name_i18n[lang] = nameTr;
                    if (role) role_i18n[lang] = roleTr;
                    if (content) content_i18n[lang] = contentTr;
                } catch (err) {
                    logger.warn({ err, lang }, 'Failed to auto-translate testimonial');
                }
            }
        }

        const { data, error } = await supabase
            .from('testimonials')
            .insert([{
                ...req.body,
                name_i18n,
                role_i18n,
                content_i18n,
                approved: true,  // Auto-approve testimonials created by admin
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Failed to create testimonial');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update testimonial - Admin/Manager only
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, role, content } = req.body;
        const LANGUAGES = ['hi', 'ta', 'te'];

        // If updating content, regenerate translations
        let updateData = { ...req.body };

        if ((name || role || content) && (name !== undefined || role !== undefined || content !== undefined)) {
            const TranslationService = require('../services/translation.service');
            const name_i18n = {};
            const role_i18n = {};
            const content_i18n = {};

            for (const lang of LANGUAGES) {
                try {
                    const [nameTr, roleTr, contentTr] = await Promise.all([
                        TranslationService.translateText(name, lang),
                        TranslationService.translateText(role, lang),
                        TranslationService.translateText(content, lang)
                    ]);

                    if (name) name_i18n[lang] = nameTr;
                    if (role) role_i18n[lang] = roleTr;
                    if (content) content_i18n[lang] = contentTr;
                } catch (err) {
                    logger.warn({ err, lang }, 'Failed to auto-translate testimonial update');
                }
            }
            if (name) updateData.name_i18n = name_i18n;
            if (role) updateData.role_i18n = role_i18n;
            if (content) updateData.content_i18n = content_i18n;
        }

        const { data, error } = await supabase
            .from('testimonials')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, testimonialId: req.params.id, body: req.body }, 'Failed to update testimonial');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete testimonial - Admin/Manager only
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('testimonials')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, testimonialId: req.params.id }, 'Failed to delete testimonial');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
