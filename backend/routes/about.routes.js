const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { getFriendlyMessage } = require('../utils/error-messages');
const multer = require('multer');
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const {
    buildStoragePath,
    deleteAssetByUrl,
    sanitizeFileName,
    uploadBuffer
} = require('../services/storage-asset.service');

const { applyTranslations } = require('../utils/i18n.util');

const ABOUT_TEAM_IMAGE_LIMIT = parseInt(process.env.ABOUT_TEAM_IMAGE_LIMIT_MB || '5', 10) * 1024 * 1024;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: ABOUT_TEAM_IMAGE_LIMIT
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype?.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error(req.t('errors.upload.imagesOnly')));
        }
    }
});

// --- GET ALL CONTENT ---
router.get('/', async (req, res) => {
    try {
        const [
            { data: cards },
            { data: impactStats },
            { data: timeline },
            { data: teamMembers },
            { data: futureGoals },
            { data: settings }
        ] = await Promise.all([
            supabase.from('about_cards').select('*').order('display_order'),
            supabase.from('about_impact_stats').select('*').order('display_order'),
            supabase.from('about_timeline').select('*').order('display_order'),
            supabase.from('about_team_members').select('*').order('display_order'),
            supabase.from('about_future_goals').select('*').order('display_order'),
            supabase.from('about_settings').select('*').maybeSingle()
        ]);

        // If settings is null (first run), return default structure
        const finalSettings = settings || {
            footer_description: '',
            section_visibility: {
                missionVision: true,
                impactStats: true,
                ourStory: true,
                team: true,
                futureGoals: true,
                callToAction: true
            }
        };

        const lang = req.language || req.query.lang || 'en';

        // Base mapping for frontend format before applying translations
        const mappedCards = (cards || []).map(c => ({ ...c, order: c.display_order }));
        const mappedStats = (impactStats || []).map(s => ({ ...s, order: s.display_order }));
        const mappedTimeline = (timeline || []).map(t => ({ ...t, order: t.display_order }));
        const mappedTeam = (teamMembers || []).map(m => ({ ...m, image: m.image_url, order: m.display_order }));
        const mappedGoals = (futureGoals || []).map(g => ({ ...g, order: g.display_order }));

        res.json({
            cards: applyTranslations(mappedCards, lang),
            impactStats: applyTranslations(mappedStats, lang),
            timeline: applyTranslations(mappedTimeline, lang),
            teamMembers: applyTranslations(mappedTeam, lang),
            futureGoals: applyTranslations(mappedGoals, lang),
            footerDescription: applyTranslations(finalSettings, lang).footer_description || '',
            sectionVisibility: finalSettings.section_visibility || {
                missionVision: true,
                impactStats: true,
                ourStory: true,
                team: true,
                futureGoals: true,
                callToAction: true
            }
        });
    } catch (error) {
        logger.error({ err: error }, '[About] Error fetching content:');
        res.status(500).json({ error: req.t('errors.about.fetchFailed') });
    }
});

// --- CARDS (Mission/Vision) ---
router.post('/cards', authenticateToken, checkPermission('can_manage_about_us'), requestLock('about-cards-create'), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }

        // Fallback for i18n fields
        if (req.body.title && !req.body.title_i18n) req.body.title_i18n = { en: req.body.title };
        if (req.body.description && !req.body.description_i18n) req.body.description_i18n = { en: req.body.description };

        const { data, error } = await supabase
            .from('about_cards')
            .insert(req.body)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.put('/cards/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-cards-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }
        const { data, error } = await supabase
            .from('about_cards')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        logger.error({ err: error }, 'Card Update Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.delete('/cards/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-cards-delete:${req.params.id}`), async (req, res) => {
    try {
        const { error } = await supabase
            .from('about_cards')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// --- IMPACT STATS ---
router.post('/stats', authenticateToken, checkPermission('can_manage_about_us'), requestLock('about-stats-create'), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }

        // Fallback for i18n fields
        if (req.body.label && !req.body.label_i18n) req.body.label_i18n = { en: req.body.label };

        const { data, error } = await supabase
            .from('about_impact_stats')
            .insert(req.body)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        logger.error({ err: error }, 'Impact Stat Create Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.put('/stats/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-stats-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }
        const { data, error } = await supabase
            .from('about_impact_stats')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.delete('/stats/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-stats-delete:${req.params.id}`), async (req, res) => {
    try {
        const { error } = await supabase
            .from('about_impact_stats')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// --- TIMELINE ---
router.post('/timeline', authenticateToken, checkPermission('can_manage_about_us'), requestLock('about-timeline-create'), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }

        // Fallback for i18n fields
        if (req.body.title && !req.body.title_i18n) req.body.title_i18n = { en: req.body.title };
        if (req.body.description && !req.body.description_i18n) req.body.description_i18n = { en: req.body.description };

        const { data, error } = await supabase
            .from('about_timeline')
            .insert(req.body)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.put('/timeline/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-timeline-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }
        const { data, error } = await supabase
            .from('about_timeline')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.delete('/timeline/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-timeline-delete:${req.params.id}`), async (req, res) => {
    try {
        const { error } = await supabase
            .from('about_timeline')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// --- TEAM MEMBERS ---
router.post('/team', authenticateToken, checkPermission('can_manage_about_us'), requestLock('about-team-create'), upload.single('image'), async (req, res) => {
    try {
        const memberData = JSON.parse(req.body.data || '{}');

        // Map frontend fields to DB fields
        if (memberData.order !== undefined) {
            memberData.display_order = memberData.order;
            delete memberData.order;
        }

        // Fallback for i18n fields
        if (memberData.name && !memberData.name_i18n) memberData.name_i18n = { en: memberData.name };
        if (memberData.role && !memberData.role_i18n) memberData.role_i18n = { en: memberData.role };
        if (memberData.bio && !memberData.bio_i18n) memberData.bio_i18n = { en: memberData.bio };

        // Handle image field mismatch
        if (memberData.image && !req.file) {
            memberData.image_url = memberData.image;
        }
        delete memberData.image;

        if (req.file) {
            const filename = buildStoragePath('team', `${Date.now()}_${sanitizeFileName(req.file.originalname)}`);
            const uploadedAsset = await uploadBuffer({
                bucketName: 'team',
                filePath: filename,
                buffer: req.file.buffer,
                contentType: req.file.mimetype,
                upsert: true,
                isPublic: true
            });
            memberData.image_url = uploadedAsset.url;
        }

        const { data, error } = await supabase
            .from('about_team_members')
            .insert(memberData)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            image: data.image_url,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        logger.error({ err: error }, 'Team create error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.put('/team/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-team-update:${req.params.id}`), upload.single('image'), async (req, res) => {
    try {
        logger.info({ data: req.params.id }, '[Team Update] Starting update for ID:');
        const memberData = JSON.parse(req.body.data || '{}');
        logger.info({ data: memberData }, '[Team Update] Parsed member data:');

        // Map frontend fields to DB fields
        if (memberData.order !== undefined) {
            memberData.display_order = memberData.order;
            delete memberData.order;
        }

        // i18n fields are passed directly in memberData

        // Handle image field mismatch
        if (memberData.image && !req.file) {
            memberData.image_url = memberData.image;
        }
        delete memberData.image;

        logger.info({ data: memberData }, '[Team Update] Processed member data:');

        if (req.file) {
            logger.info({ data: req.file.originalname }, '[Team Update] New image detected:');
            // Fetch existing member to get old image URL
            const { data: existing, error: fetchError } = await supabase
                .from('about_team_members')
                .select('image_url')
                .eq('id', req.params.id)
                .single();

            if (fetchError) {
                logger.error({ err: fetchError }, '[Team Update] Error fetching existing member:');
                throw new Error(`Failed to fetch existing member: ${fetchError.message}`);
            }

            if (existing && existing.image_url) {
                logger.info({ data: existing.image_url }, '[Team Update] Deleting old image:');
                await deleteAssetByUrl(existing.image_url).catch((cleanupError) => {
                    logger.warn({ err: cleanupError, teamMemberId: req.params.id }, '[Team Update] Failed to delete old image from storage');
                });
            }

            const filename = buildStoragePath('team', `${Date.now()}_${sanitizeFileName(req.file.originalname)}`);
            const uploadedAsset = await uploadBuffer({
                bucketName: 'team',
                filePath: filename,
                buffer: req.file.buffer,
                contentType: req.file.mimetype,
                upsert: true,
                isPublic: true
            });
            memberData.image_url = uploadedAsset.url;
            logger.info({ data: uploadedAsset.url }, '[Team Update] Uploaded new image:');
        }

        logger.info('[Team Update] Attempting database update...');
        const { data, error } = await supabase
            .from('about_team_members')
            .update(memberData)
            .eq('id', req.params.id)
            .select();

        if (error) {
            logger.error({ err: error }, '[Team Update] Database error:');
            throw error;
        }

        if (!data || data.length === 0) {
            logger.error('[Team Update] No rows returned - record may not exist or RLS blocked the update');
            throw new Error(`Team member with ID ${req.params.id} not found or update not permitted`);
        }

        logger.info({ data: data[0] }, '[Team Update] Successfully updated team member:');

        // Map DB fields to frontend format
        const mappedData = {
            ...data[0],
            image: data[0].image_url,
            order: data[0].display_order
        };

        res.json(mappedData);
    } catch (error) {
        logger.error({ err: error }, '[Team Update] Update failed:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.delete('/team/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-team-delete:${req.params.id}`), async (req, res) => {
    try {
        logger.info({ data: req.params.id }, '[Team Delete] Attempting to delete team member:');

        // Fetch existing member to get image URL
        const { data: existing, error: fetchError } = await supabase
            .from('about_team_members')
            .select('image_url')
            .eq('id', req.params.id)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError }, '[Team Delete] Error fetching team member:');
            throw fetchError;
        }

        logger.info({ data: existing?.image_url }, '[Team Delete] Found member with image_url:');

        if (existing && existing.image_url) {
            await deleteAssetByUrl(existing.image_url).catch((cleanupError) => {
                logger.warn({ err: cleanupError, teamMemberId: req.params.id }, '[Team Delete] Failed to delete image from storage');
            });
        }

        const { error } = await supabase
            .from('about_team_members')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            logger.error({ err: error }, '[Team Delete] Error deleting from database:');
            throw error;
        }

        logger.info({ data: req.params.id }, '[Team Delete] Successfully deleted team member:');
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, '[Team Delete] Delete failed:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// --- FUTURE GOALS ---
router.post('/goals', authenticateToken, checkPermission('can_manage_about_us'), requestLock('about-goals-create'), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }

        // Fallback for i18n fields
        if (req.body.title && !req.body.title_i18n) req.body.title_i18n = { en: req.body.title };
        if (req.body.description && !req.body.description_i18n) req.body.description_i18n = { en: req.body.description };

        const { data, error } = await supabase
            .from('about_future_goals')
            .insert(req.body)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        logger.error({ err: error }, 'Future Goal Create Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.put('/goals/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-goals-update:${req.params.id}`), idempotency(), async (req, res) => {
    try {
        if (req.body.order !== undefined) {
            req.body.display_order = req.body.order;
            delete req.body.order;
        }
        const { data, error } = await supabase
            .from('about_future_goals')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        // Map DB fields to frontend format
        const mappedData = {
            ...data,
            order: data.display_order
        };

        res.json(mappedData);
    } catch (error) {
        logger.error({ err: error }, 'Future Goal Update Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

router.delete('/goals/:id', authenticateToken, checkPermission('can_manage_about_us'), requestLock((req) => `about-goals-delete:${req.params.id}`), async (req, res) => {
    try {
        const { error } = await supabase
            .from('about_future_goals')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// --- SETTINGS (Footer & Visibility) ---
router.put('/settings', authenticateToken, checkPermission('can_manage_about_us'), requestLock('about-settings-update'), idempotency(), async (req, res) => {
    try {
        // Map camelCase to snake_case for database
        const dbData = {};
        if (req.body.footer_description !== undefined) {
            dbData.footer_description = req.body.footer_description;
        }
        if (req.body.footer_description_i18n !== undefined) {
            dbData.footer_description_i18n = req.body.footer_description_i18n;
        }
        if (req.body.section_visibility !== undefined) {
            dbData.section_visibility = req.body.section_visibility;
        }

        // Fallback
        if (dbData.footer_description && !dbData.footer_description_i18n) {
            dbData.footer_description_i18n = { en: dbData.footer_description };
        }

        // First check if settings exist
        const { data: existing } = await supabase
            .from('about_settings')
            .select('id')
            .single();

        let result;
        if (existing) {
            result = await supabase
                .from('about_settings')
                .update(dbData)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('about_settings')
                .insert(dbData)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        // Map response back to camelCase for frontend
        const response = {
            ...result.data,
            footerDescription: result.data.footer_description,
            sectionVisibility: result.data.section_visibility
        };
        delete response.footer_description;
        delete response.section_visibility;

        res.json(response);
    } catch (error) {
        logger.error({ err: error }, 'Settings Update Error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
