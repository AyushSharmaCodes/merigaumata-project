const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { getFriendlyMessage } = require('../utils/error-messages');

const { authenticateToken, checkPermission, optionalAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');

// Get all FAQs (public - only active FAQs, admin - all FAQs)
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { category, isAdmin } = req.query;
        const isAdminUser = req.user && (req.user.role === 'admin' || req.user.role === 'manager');
        const lang = req.language || req.query.lang || 'en';

        // Use RPC for public view
        if (!isAdminUser || isAdmin !== 'true') {
            try {
                const { data, error } = await supabase.rpc('get_faqs_v2', {
                    p_lang: lang,
                    p_category_id: category || null
                });

                if (error) throw error;
                
                // Map category_data to category for frontend compatibility (handles old RPC versions)
                const mappedData = (data || []).map(faq => {
                    if (faq.category_data && !faq.category) {
                        faq.category = faq.category_data;
                    }
                    return faq;
                });
                
                return res.json(mappedData);
            } catch (rpcError) {
                logger.warn({ err: rpcError }, '[FaqRoutes] get_faqs_v2 RPC failed, falling back to manual query');
                // Fallback to manual query logic
                let query = supabase
                    .from('faqs')
                    .select(`
                        *,
                        category:categories!faqs_category_id_fkey (
                            id,
                            name,
                            name_i18n
                        )
                    `)
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (category) {
                    query = query.eq('category_id', category);
                }

                const { data: manualData, error: manualError } = await query;
                if (manualError) throw manualError;

                // Localize manually in fallback
                const localizedData = (manualData || []).map(faq => {
                    const localized = { ...faq };
                    if (faq.question_i18n && faq.question_i18n[lang]) {
                        localized.question = faq.question_i18n[lang];
                    }
                    if (faq.answer_i18n && faq.answer_i18n[lang]) {
                        localized.answer = faq.answer_i18n[lang];
                    }
                    if (faq.category) {
                        localized.category = {
                            id: faq.category.id,
                            name: (faq.category.name_i18n && faq.category.name_i18n[lang]) || faq.category.name
                        };
                    }
                    return localized;
                });

                return res.json(localizedData);
            }
        }

        // Admin view logic stays manual for all fields access
        let query = supabase
            .from('faqs')
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name,
          name_i18n
        )
      `)
            .order('display_order', { ascending: true });

        // Filter by category if provided
        if (category) {
            query = query.eq('category_id', category);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching FAQs');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get single FAQ by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('faqs')
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name,
          name_i18n
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: req.t('errors.faq.notFound') });
        }

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        if (data.question_i18n && data.question_i18n[lang]) {
            data.question = data.question_i18n[lang];
        }
        if (data.answer_i18n && data.answer_i18n[lang]) {
            data.answer = data.answer_i18n[lang];
        }

        if (data.category && data.category.name_i18n && data.category.name_i18n[lang]) {
            data.category_name = data.category.name_i18n[lang];
        } else if (data.category) {
            data.category_name = data.category.name;
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error fetching FAQ');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Create new FAQ (admin only)
router.post('/', authenticateToken, checkPermission('can_manage_faqs'), requestLock('faq-create'), idempotency(), async (req, res) => {
    try {
        const { question, question_i18n, answer, answer_i18n, category_id, display_order, is_active } = req.body;

        // Validation
        if (!question || !answer || !category_id) {
            return res.status(400).json({
                error: req.t('errors.faq.missingFields')
            });
        }

        const { data, error } = await supabase
            .from('faqs')
            .insert([{
                question,
                question_i18n: question_i18n || { en: question },
                answer,
                answer_i18n: answer_i18n || { en: answer },
                category_id,
                display_order: display_order || 0,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name,
          name_i18n
        )
      `)
            .single();

        if (error) throw error;

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        if (data.category && data.category.name_i18n && data.category.name_i18n[lang]) {
            data.category_name = data.category.name_i18n[lang];
        } else if (data.category) {
            data.category_name = data.category.name;
        }

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating FAQ');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update FAQ (admin only)
router.put('/:id', authenticateToken, checkPermission('can_manage_faqs'), requestLock((req) => `faq-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;
        const { question, question_i18n, answer, answer_i18n, category_id, display_order, is_active } = req.body;

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (question !== undefined) updateData.question = question;
        if (question_i18n !== undefined) updateData.question_i18n = question_i18n;
        if (answer !== undefined) updateData.answer = answer;
        if (answer_i18n !== undefined) updateData.answer_i18n = answer_i18n;
        if (category_id !== undefined) updateData.category_id = category_id;
        if (display_order !== undefined) updateData.display_order = display_order;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('faqs')
            .update(updateData)
            .eq('id', id)
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name,
          name_i18n
        )
      `)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: req.t('errors.faq.notFound') });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error updating FAQ');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Toggle FAQ active status (admin only)
router.patch('/:id/toggle-active', authenticateToken, checkPermission('can_manage_faqs'), requestLock((req) => `faq-toggle-active:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { id } = req.params;

        // Get current status
        const { data: currentFaq, error: fetchError } = await supabase
            .from('faqs')
            .select('is_active')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!currentFaq) {
            return res.status(404).json({ error: req.t('errors.faq.notFound') });
        }

        // Toggle status
        const { data, error } = await supabase
            .from('faqs')
            .update({
                is_active: !currentFaq.is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name,
          name_i18n
        )
      `)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error toggling FAQ status');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete FAQ (admin only)
router.delete('/:id', authenticateToken, checkPermission('can_manage_faqs'), requestLock((req) => `faq-delete:${req.params.id}`), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('faqs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: req.t('success.faq.deleted') });
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error deleting FAQ');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Reorder FAQs (admin only)
router.put('/reorder/bulk', authenticateToken, checkPermission('can_manage_faqs'), requestLock('faq-reorder'), idempotency(), async (req, res) => {
    try {
        const { faqs } = req.body;

        if (!Array.isArray(faqs)) {
            return res.status(400).json({ error: req.t('errors.faq.arrayRequired') });
        }

        // OPTIMIZED: Use reorder_faqs_v1 RPC to update all display orders in a single database call
        const { error: rpcError } = await supabase.rpc('reorder_faqs_v1', {
            p_faq_ids: faqs.map(f => f.id)
        });

        if (rpcError) throw rpcError;

        res.json({ message: req.t('success.faq.reordered') });
    } catch (error) {
        logger.error({ err: error }, 'Error reordering FAQs');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
