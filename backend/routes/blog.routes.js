const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, checkPermission } = require('../middleware/auth.middleware');
const { deletePhotoByUrl } = require('../services/photo.service');

// Helper to map snake_case DB object to camelCase frontend object
const mapToFrontend = (blog, lang = 'en') => {
    if (!blog) return null;

    // Helper to get localized value with fallback
    const getLocalized = (field, i18nField) => {
        return (blog[i18nField] && blog[i18nField][lang]) || blog[field];
    };

    return {
        id: blog.id,
        title: getLocalized('title', 'title_i18n'),
        excerpt: getLocalized('excerpt', 'excerpt_i18n'),
        content: getLocalized('content', 'content_i18n'),
        author: getLocalized('author', 'author_i18n'),
        title_i18n: blog.title_i18n || {},
        excerpt_i18n: blog.excerpt_i18n || {},
        content_i18n: blog.content_i18n || {},
        author_i18n: blog.author_i18n || {},
        date: blog.date,
        image: blog.image,
        tags: getLocalized('tags', 'tags_i18n') || [],
        tags_i18n: blog.tags_i18n || {},
        en_tags: blog.tags || [], // Keep base tags for filtering
        published: blog.published,
        createdAt: blog.created_at,
        updatedAt: blog.updated_at
    };
};

// Helper to map camelCase frontend object to snake_case DB object
const mapToDb = (blog) => {
    const dbBlog = {
        title: blog.title,
        title_i18n: blog.title_i18n,
        excerpt: blog.excerpt,
        excerpt_i18n: blog.excerpt_i18n,
        content: blog.content,
        content_i18n: blog.content_i18n,
        author: blog.author,
        author_i18n: blog.author_i18n,
        date: blog.date,
        image: blog.image,
        tags: blog.tags,
        tags_i18n: blog.tags_i18n,
        published: blog.published,
        updated_at: new Date().toISOString()
    };

    // Remove undefined fields
    Object.keys(dbBlog).forEach(key => dbBlog[key] === undefined && delete dbBlog[key]);

    return dbBlog;
};


// Get all blogs (with optional pagination and search)
router.get('/', async (req, res) => {
    try {
        const { page, limit, search } = req.query;

        let query = supabase
            .from('blogs')
            .select('*', { count: 'exact' });

        // Apply search if provided
        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        // Apply pagination if provided
        if (page && limit) {
            const from = (page - 1) * limit;
            const to = from + parseInt(limit) - 1;
            query = query.range(from, to);
        }

        const { data, count, error } = await query
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        const formattedBlogs = data.map(b => mapToFrontend(b, req.language));

        // If pagination was requested, return object with data and total
        if (page && limit) {
            res.json({
                blogs: formattedBlogs,
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            });
        } else {
            // Backward compatibility: return array
            res.json(formattedBlogs);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single blog
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json(mapToFrontend(data, req.language));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create blog - Admin/Manager only
router.post('/', authenticateToken, checkPermission('can_manage_blogs'), async (req, res) => {
    try {
        const dbBlog = mapToDb(req.body);
        // Add created_at for new records
        dbBlog.created_at = new Date().toISOString();
        // Set date if not provided
        if (!dbBlog.date) dbBlog.date = new Date().toISOString();

        const { data, error } = await supabase
            .from('blogs')
            .insert([dbBlog])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(mapToFrontend(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update blog - Admin/Manager only
router.put('/:id', authenticateToken, checkPermission('can_manage_blogs'), async (req, res) => {
    try {
        const dbBlog = mapToDb(req.body);

        const { data, error } = await supabase
            .from('blogs')
            .update(dbBlog)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(mapToFrontend(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete blog - Admin/Manager only
router.delete('/:id', authenticateToken, checkPermission('can_manage_blogs'), async (req, res) => {
    try {
        // 1. Get blog to find image URL
        const { data: blog, error: fetchError } = await supabase
            .from('blogs')
            .select('image')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Delete blog from database first
        const { error } = await supabase
            .from('blogs')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        // 3. Clean up blog image from storage and photos table
        if (blog && blog.image) {
            // Don't await - let cleanup happen asynchronously
            deletePhotoByUrl(blog.image).catch(err =>
                logger.error('Error cleaning up blog image:', err)
            );
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
