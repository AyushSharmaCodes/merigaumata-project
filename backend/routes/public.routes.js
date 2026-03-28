const express = require('express');
const supabase = require('../config/supabase');
const { optionalAuth } = require('../middleware/auth.middleware');
const { applyTranslations } = require('../utils/i18n.util');
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

router.get('/site-content', optionalAuth, async (req, res) => {
    try {
        const lang = resolveLanguage(req);
        const adminView = isAdminView(req);

        const [
            contactInfoResult,
            phonesResult,
            emailsResult,
            officeHoursResult,
            socialMediaResult,
            bankDetailsResult,
            aboutSettingsResult
        ] = await Promise.all([
            supabase.from('contact_info').select('*').maybeSingle(),
            (adminView
                ? supabase.from('contact_phones').select('*')
                : supabase.from('contact_phones').select('*').eq('is_active', true)
            ).order('display_order', { ascending: true }),
            (adminView
                ? supabase.from('contact_emails').select('*')
                : supabase.from('contact_emails').select('*').eq('is_active', true)
            ).order('display_order', { ascending: true }),
            supabase.from('contact_office_hours').select('*').order('display_order', { ascending: true }),
            (adminView
                ? supabase.from('social_media').select('*')
                : supabase.from('social_media').select('*').eq('is_active', true)
            ).order('display_order', { ascending: true }),
            (adminView
                ? supabase.from('bank_details').select('*')
                : supabase.from('bank_details').select('*').eq('is_active', true)
            ).order('display_order', { ascending: true }),
            supabase.from('about_settings').select('*').maybeSingle()
        ]);

        const results = [
            contactInfoResult,
            phonesResult,
            emailsResult,
            officeHoursResult,
            socialMediaResult,
            bankDetailsResult,
            aboutSettingsResult
        ];

        const firstError = results.find((result) => result.error && result.error.code !== 'PGRST116')?.error;
        if (firstError) {
            throw firstError;
        }

        const address = contactInfoResult.data ? applyTranslations(contactInfoResult.data, lang) : {};
        const phones = applyTranslations(phonesResult.data || [], lang);
        const emails = applyTranslations(emailsResult.data || [], lang);
        const socialMedia = applyTranslations(socialMediaResult.data || [], lang);
        const bankDetails = applyTranslations(bankDetailsResult.data || [], lang);
        const aboutSettings = aboutSettingsResult.data
            ? applyTranslations(aboutSettingsResult.data, lang)
            : {};

        res.json({
            contactInfo: {
                address,
                phones,
                emails,
                officeHours: officeHoursResult.data || []
            },
            socialMedia,
            bankDetails,
            about: {
                footerDescription: aboutSettings.footer_description || ''
            }
        });
    } catch (error) {
        logger.error({ err: error }, '[PublicRoutes] Failed to fetch site content');
        res.status(500).json({ error: req.t('errors.system.generic_error') });
    }
});

router.get('/homepage', async (req, res) => {
    try {
        const lang = resolveLanguage(req);
        const { data: homepageContent, error } = await supabase.rpc('get_public_homepage_content', {
            p_now: new Date().toISOString()
        });

        if (error) {
            logRouteQueryError('homepage', 'get_public_homepage_content', error, req);
            throw error;
        }

        const productsResult = { data: homepageContent?.products || [] };
        const eventsResult = { data: homepageContent?.events || [] };
        const blogsResult = { data: homepageContent?.blogs || [] };
        const testimonialsResult = { data: homepageContent?.testimonials || [] };
        const galleryItemsResult = { data: homepageContent?.galleryItems || [] };
        const carouselSlidesResult = { data: homepageContent?.carouselSlides || [] };

        const products = (productsResult.data || []).map((product) => localizeProductRecord(product, lang));
        const events = applyTranslations(eventsResult.data || [], lang);
        const blogs = (blogsResult.data || []).map((blog) => ({
            id: blog.id,
            title: localizeRecord(blog, lang, ['title']).title,
            excerpt: localizeRecord(blog, lang, ['excerpt']).excerpt,
            content: localizeRecord(blog, lang, ['content']).content,
            author: localizeRecord(blog, lang, ['author']).author,
            title_i18n: blog.title_i18n || {},
            excerpt_i18n: blog.excerpt_i18n || {},
            content_i18n: blog.content_i18n || {},
            author_i18n: blog.author_i18n || {},
            date: blog.date,
            image: blog.image,
            tags: (localizeRecord(blog, lang, ['tags']).tags) || [],
            tags_i18n: blog.tags_i18n || {},
            en_tags: blog.tags || [],
            published: blog.published,
            createdAt: blog.created_at,
            updatedAt: blog.updated_at
        }));
        const testimonials = (testimonialsResult.data || []).map((testimonial) =>
            localizeRecord({ ...testimonial }, lang, ['content', 'name', 'role'])
        );
        const galleryItems = (galleryItemsResult.data || []).map((item) =>
            localizeRecord({ ...item }, lang, ['title', 'description'])
        );
        const carouselSlides = (carouselSlidesResult.data || []).map((slide) => ({
            id: slide.id,
            image: slide.image || slide.image_url || '',
            title: localizeRecord(slide, lang, ['title']).title,
            subtitle: localizeRecord(slide, lang, ['subtitle']).subtitle,
            title_i18n: slide.title_i18n || {},
            subtitle_i18n: slide.subtitle_i18n || {},
            order: slide.order_index || 0,
            isActive: slide.is_active === true,
            createdAt: slide.created_at,
            updatedAt: slide.updated_at
        }));

        res.json({
            products,
            events,
            blogs,
            testimonials,
            galleryItems,
            carouselSlides,
            hasPartialData: false
        });
    } catch (error) {
        logger.error({ err: error }, '[PublicRoutes] Failed to fetch homepage content');
        res.status(500).json({ error: req.t('errors.system.generic_error') });
    }
});

module.exports = router;
