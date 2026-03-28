const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole, checkPermission, optionalAuth } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

function isStaffUser(user) {
    return !!user && (user.role === 'admin' || user.role === 'manager');
}

function canViewAdminTestimonials(req) {
    return req.query.isAdmin === 'true' && isStaffUser(req.user);
}

function normalizeLocalizedTextMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.entries(value).reduce((acc, [lang, text]) => {
        if (typeof text === 'string') {
            const normalized = text.trim();
            if (normalized) {
                acc[lang] = normalized;
            }
        }
        return acc;
    }, {});
}

async function buildLocalizedTextMap(baseValue, providedTranslations = {}) {
    const normalizedBaseValue = typeof baseValue === 'string' ? baseValue.trim() : '';
    const normalizedTranslations = normalizeLocalizedTextMap(providedTranslations);
    const languagesToFill = ['hi', 'ta', 'te'].filter((lang) => !normalizedTranslations[lang] && normalizedBaseValue);

    if (languagesToFill.length === 0) {
        return normalizedTranslations;
    }

    const TranslationService = require('../services/translation.service');

    await Promise.all(languagesToFill.map(async (lang) => {
        try {
            const translatedText = await TranslationService.translateText(normalizedBaseValue, lang);
            if (typeof translatedText === 'string' && translatedText.trim()) {
                normalizedTranslations[lang] = translatedText.trim();
            }
        } catch (err) {
            logger.warn({ err, lang, baseValue: normalizedBaseValue }, 'Failed to auto-translate testimonial field');
        }
    }));

    return normalizedTranslations;
}

async function canManageTestimonials(user) {
    if (!isStaffUser(user)) return false;
    if (user.role === 'admin') return true;

    const { data, error } = await supabase
        .from('manager_permissions')
        .select('can_manage_testimonials, is_active')
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        logger.warn({ err: error, userId: user?.id }, 'Failed to resolve testimonial permissions');
        return false;
    }

    return data.is_active !== false && data.can_manage_testimonials === true;
}

// Get all testimonials
router.get('/', optionalAuth, async (req, res) => {
    try {
        const isAdminView = canViewAdminTestimonials(req);

        let query = supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false });

        if (!isAdminView) {
            query = query.eq('approved', true);
        }

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
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        let query = supabase
            .from('testimonials')
            .select('*')
            .eq('id', req.params.id);

        const isAdminView = isStaffUser(req.user);
        if (!isAdminView) {
            query = query.eq('approved', true);
        }

        const { data, error } = await query.single();

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

// Create testimonial - Authenticated users can submit, admins/managers auto-approve
router.post('/', authenticateToken, requestLock('testimonial-create'), idempotency(), async (req, res) => {
    try {
        const { role, content, rating, image } = req.body;
        const isStaff = isStaffUser(req.user);
        const canManage = isStaff ? await canManageTestimonials(req.user) : false;
        const suppliedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const suppliedEmail = typeof req.body.email === 'string' ? req.body.email.trim() : '';
        const name = (canManage && suppliedName)
            || req.user.name
            || req.user.firstName
            || req.user.email?.split('@')[0]
            || 'Anonymous';
        const email = (canManage && suppliedEmail) || req.user.email;
        const suppliedNameI18n = canManage ? req.body.name_i18n : undefined;
        const suppliedRoleI18n = canManage ? req.body.role_i18n : undefined;
        const suppliedContentI18n = canManage ? req.body.content_i18n : undefined;
        const [name_i18n, role_i18n, content_i18n] = await Promise.all([
            buildLocalizedTextMap(name, suppliedNameI18n),
            buildLocalizedTextMap(role, suppliedRoleI18n),
            buildLocalizedTextMap(content, suppliedContentI18n),
        ]);

        const { data, error } = await supabase
            .from('testimonials')
            .insert([{
                user_id: req.user.id,
                email,
                name,
                role,
                content,
                rating,
                image,
                name_i18n,
                role_i18n,
                content_i18n,
                approved: canManage ? req.body.approved !== false : false,
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
router.put('/:id', authenticateToken, checkPermission('can_manage_testimonials'), requestLock((req) => `testimonial-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        const { name, role, content } = req.body;
        let updateData = { ...req.body };

        if ((name || role || content) && (name !== undefined || role !== undefined || content !== undefined)) {
            const [name_i18n, role_i18n, content_i18n] = await Promise.all([
                buildLocalizedTextMap(name, req.body.name_i18n),
                buildLocalizedTextMap(role, req.body.role_i18n),
                buildLocalizedTextMap(content, req.body.content_i18n),
            ]);

            if (name !== undefined) updateData.name_i18n = name_i18n;
            if (role !== undefined) updateData.role_i18n = role_i18n;
            if (content !== undefined) updateData.content_i18n = content_i18n;
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
router.delete('/:id', authenticateToken, checkPermission('can_manage_testimonials'), requestLock((req) => `testimonial-delete:${req.params.id}`), async (req, res) => {
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
module.exports.isStaffUser = isStaffUser;
module.exports.canViewAdminTestimonials = canViewAdminTestimonials;
module.exports.canManageTestimonials = canManageTestimonials;
