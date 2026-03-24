const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// --- NEWSLETTER SUBSCRIBERS ---

// Get subscriber stats (MUST be before /subscribers/:id) - Admin/Manager only
router.get('/subscribers/stats', authenticateToken, checkPermission('can_manage_newsletter'), async (req, res) => {
    try {
        const { count: totalCount, error: allError } = await supabase
            .from('newsletter_subscribers')
            .select('*', { count: 'exact', head: true });

        const { count: activeCount, error: activeError } = await supabase
            .from('newsletter_subscribers')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (allError) throw allError;
        if (activeError) throw activeError;

        res.json({
            total: totalCount || 0,
            active: activeCount || 0,
            inactive: (totalCount || 0) - (activeCount || 0)
        });
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Stats Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Get all subscribers (with optional filter) - Admin/Manager only
router.get('/subscribers', authenticateToken, checkPermission('can_manage_newsletter'), async (req, res) => {
    try {
        const { active } = req.query;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('newsletter_subscribers')
            .select('*', { count: 'exact' })
            .range(from, to)
            .order('subscribed_at', { ascending: false });

        // Filter by active status for public users
        if (active !== undefined) {
            query = query.eq('is_active', active === 'true');
        }

        const { data, error, count } = await query;

        if (error) throw error;
        res.json({
            subscribers: data || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscribers Get Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Add a new subscriber - Public
router.post('/subscribers', async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email) {
            return res.status(400).json({ error: req.t('errors.validation.emailRequired') });
        }

        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .insert({
                email: email.toLowerCase().trim(),
                name: name?.trim() || null,
                is_active: true,
                subscribed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            // Check for duplicate email
            if (error.code === '23505') {
                return res.status(409).json({ error: req.t('errors.newsletter.alreadySubscribed') });
            }
            throw error;
        }

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscriber Create Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update a subscriber - Authenticated
router.put('/subscribers/:id', authenticateToken, checkPermission('can_manage_newsletter'), async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, is_active } = req.body;

        const updateData = {};
        if (email !== undefined) updateData.email = email.toLowerCase().trim();
        if (name !== undefined) updateData.name = name?.trim() || null;
        if (is_active !== undefined) {
            updateData.is_active = is_active;
            // Set unsubscribed_at if deactivating
            if (!is_active) {
                updateData.unsubscribed_at = new Date().toISOString();
            } else {
                updateData.unsubscribed_at = null;
            }
        }

        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: req.t('errors.newsletter.emailExists') });
            }
            throw error;
        }

        if (!data) {
            return res.status(404).json({ error: req.t('errors.newsletter.subscriberNotFound') });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscriber Update Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete a subscriber - Authenticated
router.delete('/subscribers/:id', authenticateToken, checkPermission('can_manage_newsletter'), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('newsletter_subscribers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscriber Delete Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// --- NEWSLETTER CONFIG ---

// Get newsletter configuration - Admin/Manager only
router.get('/config', authenticateToken, checkPermission('can_manage_newsletter'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('newsletter_config')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        // Return default if no config exists
        const config = data || {
            sender_name: 'Gau Gyaan Newsletter',
            sender_email: 'newsletter@gaugyan.com',
            footer_text: 'Thank you for subscribing to our newsletter.'
        };

        // Dynamic Data i18n
        const lang = req.language || req.query.lang || 'en';
        if (config.sender_name_i18n && config.sender_name_i18n[lang]) {
            config.sender_name = config.sender_name_i18n[lang];
        }
        if (config.footer_text_i18n && config.footer_text_i18n[lang]) {
            config.footer_text = config.footer_text_i18n[lang];
        }

        res.json(config);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Config Get Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Update newsletter configuration - Admin/Manager only
router.put('/config', authenticateToken, checkPermission('can_manage_newsletter'), async (req, res) => {
    try {
        const { sender_name, sender_email, footer_text } = req.body;

        // Check if config exists
        const { data: existing } = await supabase
            .from('newsletter_config')
            .select('id')
            .single();

        let result;
        if (existing) {
            // Update existing
            result = await supabase
                .from('newsletter_config')
                .update({
                    sender_name,
                    sender_email,
                    footer_text
                })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            // Insert new
            result = await supabase
                .from('newsletter_config')
                .insert({
                    sender_name,
                    sender_email,
                    footer_text
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        res.json(result.data);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Config Update Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
