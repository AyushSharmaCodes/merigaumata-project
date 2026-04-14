const express = require('express');
const supabase = require('../config/supabase');
const { optionalAuth } = require('../middleware/auth.middleware');
const { applyTranslations } = require('../utils/i18n.util');
const { mapToFrontend } = require('../services/event.utils');
const logger = require('../utils/logger');

const router = express.Router();

function resolveLanguage(req) {
    return req.language || req.query.lang || 'en';
}

function isAdminView(req) {
    return req.query.isAdmin === 'true'
        && req.user
        && (req.user.role === 'admin' || req.user.role === 'manager');
}

function localizeRecord(record, lang, fields) {
    if (!record) return record;

    const localized = { ...record };
    fields.forEach((field) => {
        const i18nField = `${field}_i18n`;
        if (localized[i18nField] && localized[i18nField][lang]) {
            localized[field] = localized[i18nField][lang];
        }
    });

    return localized;
}

function localizeProductRecord(product, lang) {
    if (!product) return product;

    const englishTags = Array.isArray(product.tags) ? [...product.tags] : [];
    const localizedProduct = applyTranslations(product, lang, false);
    localizedProduct.en_tags = englishTags;
    localizedProduct.tags = englishTags;

    return localizedProduct;
}

function logRouteQueryError(routeName, queryName, error, req) {
    logger.error({
        module: 'PublicRoutes',
        operation: routeName,
        req,
        queryName,
        err: error
    }, `[PublicRoutes] ${routeName} query failed: ${queryName}`);
}

async function fetchHomepageEvents(nowIso) {
    const [ongoingResult, upcomingResult] = await Promise.all([
        supabase
            .from('events')
            .select('*')
            .neq('status', 'cancelled')
            .neq('status', 'completed')
            .lte('start_date', nowIso)
            .or(`end_date.gte.${nowIso},end_date.is.null`)
            .order('start_date', { ascending: true })
            .limit(5),
        supabase
            .from('events')
            .select('*')
            .neq('status', 'cancelled')
            .neq('status', 'completed')
            .gt('start_date', nowIso)
            .order('start_date', { ascending: true })
            .limit(5)
    ]);

    if (ongoingResult.error) {
        throw ongoingResult.error;
    }

    if (upcomingResult.error) {
        throw upcomingResult.error;
    }

    return [
        ...(ongoingResult.data || []),
        ...(upcomingResult.data || [])
    ];
}

router.get('/site-content', optionalAuth, async (req, res) => {
    try {
        const lang = resolveLanguage(req);
        
        // Use the optimized RPC for a single round-trip database call
        const { data, error } = await supabase.rpc('get_site_content_v2', {
            p_lang: lang
        });

        if (error) {
            logger.warn({ err: error }, '[PublicRoutes] site-content RPC failed, falling back to manual fetch');
            const manualData = await fetchSiteContentManualRaw(lang);
            return res.json(manualData);
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, '[PublicRoutes] Failed to fetch site content');
        res.status(500).json({ error: req.t('errors.system.generic_error') });
    }
});

router.get('/homepage', async (req, res) => {
    try {
        const lang = resolveLanguage(req);
        const nowIso = new Date().toISOString();

        const [slidesRes, productsRes, blogsRes, events] = await Promise.all([
            supabase
                .from('gallery_items')
                .select(`
                    id, image_url, title, title_i18n, description, description_i18n, order_index,
                    gallery_folders!inner(is_home_carousel, is_active)
                `)
                .eq('gallery_folders.is_home_carousel', true)
                .eq('gallery_folders.is_active', true)
                .order('order_index', { ascending: true }),
            supabase.from('products').select('*').limit(8),
            supabase.from('blogs').select('*').eq('published', true).order('created_at', { ascending: false }).limit(6),
            fetchHomepageEvents(nowIso).catch(() => [])
        ]);

        const slides = (slidesRes.data || []).map(s => ({
            id: s.id,
            title: (s.title_i18n && s.title_i18n[lang]) || s.title,
            subtitle: (s.description_i18n && s.description_i18n[lang]) || s.description,
            image: s.image_url,
            order: s.order_index
        }));
        const products = productsRes.data || [];
        const blogs = blogsRes.data || [];

        res.json({
            carouselSlides: slides,
            products: products.map(p => localizeProductRecord(p, lang)),
            blogs: blogs.map(b => ({
                ...localizeRecord(b, lang, ['title', 'excerpt']),
                slug: b.blog_code || b.id
            })),
            events: (events || []).map(e => ({
                ...localizeRecord(e, lang, ['title', 'description']),
                slug: e.event_code || e.id,
                ...mapToFrontend(e)
            })),
            hasPartialData: !!(slidesRes.error || productsRes.error || blogsRes.error)
        });
    } catch (error) {
        logger.error({ err: error }, '[PublicRoutes] Failed to fetch homepage content');
        res.status(500).json({ error: req.t('errors.system.generic_error') });
    }
});

router.get('/debug-settings', async (req, res) => {
    try {
        const { data: settings, error } = await supabase.from('store_settings').select('*');
        res.json({ settings, error });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/init-payload', async (req, res) => {
    try {
        const lang = resolveLanguage(req);
        
        // Use the optimized RPC for a single round-trip database call
        const { data: payload, error } = await supabase.rpc('get_app_initial_payload_v4', {
            p_lang: lang
        });

        if (error) {
            logger.error({ 
                module: 'PublicRoutes', 
                operation: 'INIT_PAYLOAD_RPC', 
                err: error 
            }, '[PublicRoutes] RPC fetch failed, falling back to manual fetch');
            
            // OPTIONAL: Fallback to manual if RPC fails (e.g. if migration not applied)
            return manualInitPayload(req, res, lang);
        }

        res.json(payload);
    } catch (error) {
        logger.error({ err: error }, '[PublicRoutes] Failed to fetch optimized init payload');
        res.status(500).json({ error: req.t('errors.system.generic_error') });
    }
});

// Shared manual fetching helper for Site Content
async function fetchSiteContentManualRaw(lang) {
    const nowIso = new Date().toISOString();
    const [
        contactRes, phonesRes, emailsRes, bankRes, aboutRes, couponsRes,
        categoriesRes, settingsRes, policiesRes, socialRes, hoursRes
    ] = await Promise.all([
        supabase.from('contact_info').select('*').limit(1),
        supabase.from('contact_phones').select('*').eq('is_active', true).order('is_primary', { ascending: false }),
        supabase.from('contact_emails').select('*').eq('is_active', true).order('is_primary', { ascending: false }),
        supabase.from('bank_details').select('*').eq('is_active', true).order('display_order', { ascending: true }),
        supabase.from('about_settings').select('*').limit(1),
        supabase.from('coupons').select('*').eq('is_active', true).lte('valid_from', nowIso).or(`valid_until.gte.${nowIso},valid_until.is.null`),
        supabase.from('categories').select('*'),
        supabase.from('store_settings').select('*'),
        supabase.from('policy_pages').select('*'),
        supabase.from('social_media').select('*').eq('is_active', true).order('display_order', { ascending: true }),
        supabase.from('contact_office_hours').select('*').order('display_order', { ascending: true })
    ]);

    const settingsMap = (settingsRes.data || []).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

    return {
        categories: (categoriesRes.data || []).map(c => ({
            id: c.id,
            name: (c.name_i18n && c.name_i18n[lang]) || c.name,
            type: c.type
        })),
        settings: settingsMap,
        contactInfo: {
            address: contactRes.data?.[0] || null,
            phones: (phonesRes.data || []).map(p => localizeRecord(p, lang, ['label'])),
            emails: (emailsRes.data || []),
            officeHours: (hoursRes.data || [])
        },
        policies: (policiesRes.data || []).map(p => ({
            id: p.id,
            slug: p.type || p.id,
            title: (p.title_i18n && p.title_i18n[lang]) || p.title
        })),
        socialMedia: (socialRes.data || []).map(s => ({
            id: s.id,
            platform: s.platform,
            url: s.url,
            icon: s.icon_url || s.icon
        })),
        bankDetails: (bankRes.data || []),
        about: {
            footerDescription: aboutRes.data?.[0]?.footer_description || ""
        },
        coupons: (couponsRes.data || []).filter(c => !c.usage_limit || c.usage_count < c.usage_limit)
    };
}

// For safety, keeping the robust manual logic as a fallback
async function manualInitPayload(req, res, lang) {
    try {
        const nowIso = new Date().toISOString();
        const [
            siteContent, slidesRes, mobileSlidesRes, productsRes, blogsRes, events,
            testimonialsRes, galleryRes
        ] = await Promise.all([
            fetchSiteContentManualRaw(lang),
            supabase
                .from('gallery_items')
                .select(`
                    id, image_url, title, title_i18n, description, description_i18n, order_index,
                    gallery_folders!inner(is_home_carousel, is_active)
                `)
                .eq('gallery_folders.is_home_carousel', true)
                .eq('gallery_folders.is_active', true)
                .order('order_index', { ascending: true }),
            supabase
                .from('gallery_items')
                .select(`
                    id, image_url, title, title_i18n, description, description_i18n, order_index,
                    gallery_folders!inner(is_mobile_carousel, is_active)
                `)
                .eq('gallery_folders.is_mobile_carousel', true)
                .eq('gallery_folders.is_active', true)
                .order('order_index', { ascending: true }),
            supabase.from('products').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('blogs').select('*').eq('published', true).order('created_at', { ascending: false }).limit(10),
            fetchHomepageEvents(nowIso).catch(() => []),
            supabase.from('testimonials').select('*').eq('approved', true).limit(10),
            supabase.from('gallery_items').select('*').limit(12)
        ]);

        const payload = {
            siteContent,
            homepage: {
                carouselSlides: (slidesRes.data || []).map(s => ({
                    id: s.id,
                    title: (s.title_i18n && s.title_i18n[lang]) || s.title,
                    subtitle: (s.description_i18n && s.description_i18n[lang]) || s.description,
                    image: s.image_url,
                    order: s.order_index
                })),
                mobileCarouselSlides: (mobileSlidesRes.data || []).map(s => ({
                    id: s.id,
                    title: (s.title_i18n && s.title_i18n[lang]) || s.title,
                    subtitle: (s.description_i18n && s.description_i18n[lang]) || s.description,
                    image: s.image_url,
                    order: s.order_index
                })),
                products: (productsRes.data || []).map(p => {

                    const lp = localizeProductRecord(p, lang);
                    return {
                        ...lp,
                        primary_image: lp.primary_image || (Array.isArray(p.images) && p.images[0]) || ""
                    };
                }),
                blogs: (blogsRes.data || []).map(b => ({
                    ...localizeRecord(b, lang, ['title', 'excerpt']),
                    slug: b.blog_code || b.id
                })),
                events: (events || []).map(e => ({
                    ...localizeRecord(e, lang, ['title', 'description']),
                    slug: e.event_code || e.id,
                    ...mapToFrontend(e)
                })),
                testimonials: (testimonialsRes.data || []).map(t => ({
                    ...localizeRecord(t, lang, ['content']),
                    name: t.name || t.author_name,
                    image: t.image || t.author_image
                })),
                galleryItems: (galleryRes.data || []).map(g => ({
                    ...g,
                    image: g.image_url || g.image
                }))
            },
            timestamp: nowIso
        };

        res.json(payload);
    } catch (error) {
        logger.error({ err: error }, '[PublicRoutes] Manual fallback failed');
        res.status(500).json({ error: req.t('errors.system.generic_error') });
    }
}

module.exports = router;
