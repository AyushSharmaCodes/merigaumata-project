const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('errors.upload.imagesOnly'), false);
        }
    }
});

const UPLOAD_TYPE_PERMISSIONS = {
    product: 'can_manage_products',
    event: 'can_manage_events',
    blog: 'can_manage_blogs',
    gallery: 'can_manage_gallery',
    team: 'can_manage_about_us',
    carousel: 'can_manage_carousel'
};

async function getManagerPermissions(userId) {
    const { data, error } = await supabaseAdmin
        .from('manager_permissions')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data || !data.is_active) {
        return null;
    }

    return data;
}

async function canManageUploadType(user, type) {
    if (!user) return false;
    if (user.role === 'admin') return true;

    if (type === 'profile' || type === 'testimonial') {
        return true;
    }

    if (user.role !== 'manager') {
        return false;
    }

    const requiredPermission = UPLOAD_TYPE_PERMISSIONS[type];
    if (!requiredPermission) {
        return false;
    }

    const permissions = await getManagerPermissions(user.id);
    return !!permissions?.[requiredPermission];
}

async function authorizeUploadType(req, res, next) {
    try {
        const uploadType = req.body.type || 'product';
        const isAllowed = await canManageUploadType(req.user, uploadType);

        if (!isAllowed) {
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
        }

        next();
    } catch (error) {
        logger.error({ err: error, uploadType: req.body.type, userId: req.user?.id }, 'Upload authorization failed');
        res.status(500).json({ error: getFriendlyMessage(error, 500) });
    }
}

async function authorizeAssetAccess(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: req.t('errors.auth.authenticationRequired') });
        }

        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.role === 'manager') {
            req.managerPermissions = await getManagerPermissions(req.user.id);

            if (!req.managerPermissions) {
                return res.status(403).json({ error: req.t('errors.auth.forbidden') });
            }

            return next();
        }

        return res.status(403).json({ error: req.t('errors.auth.forbidden') });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Asset access authorization failed');
        res.status(500).json({ error: getFriendlyMessage(error, 500) });
    }
}

function hasBucketPermission(req, bucketName, imagePath = '') {
    if (req.user?.role === 'admin') {
        return true;
    }

    if (req.user?.role !== 'manager' || !req.managerPermissions?.is_active) {
        return false;
    }

    const permissions = req.managerPermissions;

    if (bucketName === 'gallery') return !!permissions.can_manage_gallery;
    if (bucketName === 'team') return !!permissions.can_manage_about_us;
    if (bucketName === 'events') return !!permissions.can_manage_events;
    if (bucketName === 'blogs') return !!permissions.can_manage_blogs;
    if (bucketName === 'testimonial-user') return !!permissions.can_manage_testimonials;

    if (bucketName === 'profiles') {
        return imagePath.startsWith(`${req.user.id}/`);
    }

    if (bucketName === 'images') {
        if (imagePath.startsWith('products/')) return !!permissions.can_manage_products;
        if (imagePath.startsWith('carousel/')) return !!permissions.can_manage_carousel;
    }

    return false;
}

// Upload file endpoint - Admin/Manager/User (requires auth)
router.post('/', authenticateToken, upload.single('file'), authorizeUploadType, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: req.t('errors.upload.noFile') });
        }

        const file = req.file;
        logger.debug({ uploadType: req.body.type }, 'Upload request received');
        logger.debug({ fileName: file ? file.originalname : 'No file' }, 'Processing file');

        const userId = req.user?.id || 'anonymous';
        const type = req.body.type || 'product'; // product, event, blog, profile, gallery, team
        const folder = req.body.folder || ''; // For gallery
        const timestamp = Date.now();
        const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');

        let bucketName = 'images';
        let filePath = '';
        let isPublic = true;

        // Determine bucket and path based on type
        switch (type) {
            case 'event':
                bucketName = 'events';
                filePath = `${timestamp}-${cleanFileName}`;
                break;
            case 'blog':
                bucketName = 'blogs';
                filePath = `${timestamp}-${cleanFileName}`;
                break;
            case 'profile':
                bucketName = 'profiles';
                filePath = `${userId}/avatar-${timestamp}-${cleanFileName}`;
                isPublic = false;
                break;
            case 'gallery':
                bucketName = 'gallery';
                // If folder provided, use it, otherwise root
                filePath = folder ? `${folder}/${timestamp}-${cleanFileName}` : `${timestamp}-${cleanFileName}`;
                break;
            case 'team':
                bucketName = 'team';
                filePath = `${timestamp}-${cleanFileName}`;
                break;
            case 'carousel':
                bucketName = 'images';
                filePath = `carousel/${timestamp}-${cleanFileName}`;
                break;
            case 'product':
                bucketName = 'images';
                filePath = `products/${timestamp}-${cleanFileName}`;
                break;
            case 'testimonial':
                bucketName = 'testimonial-user';
                filePath = `avatar/${timestamp}-${cleanFileName}`;
                break;
            default:
                bucketName = 'images';
                filePath = `${userId}/${timestamp}-${cleanFileName}`;
                break;
        }

        // 1. Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (storageError) throw storageError;

        // 2. Get URL
        let finalUrl = '';
        if (isPublic) {
            const { data: { publicUrl } } = supabaseAdmin.storage
                .from(bucketName)
                .getPublicUrl(filePath);
            finalUrl = publicUrl;
        } else {
            // For private buckets (profiles), generate a signed URL valid for 1 hour (or longer)
            // Or just return the path and let frontend request signed URL when needed.
            // For simplicity in this flow, we'll return a signed URL.
            const { data, error } = await supabaseAdmin.storage
                .from(bucketName)
                .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days
            if (error) throw error;
            finalUrl = data.signedUrl;
        }

        // 3. Save metadata to photos table
        const { data: photoData, error: dbError } = await supabaseAdmin
            .from('photos')
            .insert([
                {
                    image_path: filePath,
                    bucket_name: bucketName,
                    title: file.originalname,
                    size: file.size,
                    mime_type: file.mimetype,
                    user_id: userId
                }
            ])
            .select()
            .single();

        if (dbError) {
            await supabaseAdmin.storage.from(bucketName).remove([filePath]);
            throw dbError;
        }

        res.status(201).json({
            message: req.t('success.upload.fileUploaded'),
            url: finalUrl,
            path: filePath,
            bucket: bucketName,
            id: photoData.id
        });

    } catch (error) {
        logger.error({ err: error }, 'Upload error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// List user images
router.get('/user/:userId', authenticateToken, async (req, res) => {
    try {
        const isSelf = req.user.id === req.params.userId;
        const isStaff = ['admin', 'manager'].includes(req.user.role);

        if (!isSelf && !isStaff) {
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
        }

        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('user_id', req.params.userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Generate signed URLs for all images if bucket is private
        // Or just return the public URLs
        const imagesWithUrls = await Promise.all(data.map(async (photo) => {
            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(photo.image_path);
            return {
                ...photo,
                url: publicUrl
            };
        }));

        res.json(imagesWithUrls);
    } catch (error) {
        logger.error({ err: error, userId: req.params.userId }, 'Failed to list user images');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete image by URL - MUST come before /:id route - Admin/Manager only
router.delete('/by-url', authenticateToken, authorizeAssetAccess, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: req.t('errors.upload.urlRequired') });
        }

        // Extract path from URL
        // URL format: https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
        const urlParts = url.split('/storage/v1/object/public/');
        if (urlParts.length < 2) {
            return res.status(400).json({ error: req.t('errors.upload.invalidUrl') });
        }

        const pathWithBucket = urlParts[1];
        const firstSlashIndex = pathWithBucket.indexOf('/');
        const bucketName = pathWithBucket.substring(0, firstSlashIndex);
        const imagePath = pathWithBucket.substring(firstSlashIndex + 1);

        if (!hasBucketPermission(req, bucketName, imagePath)) {
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
        }

        logger.debug({ bucket: bucketName }, 'Delete by URL - processing');

        // Find the photo record by path and bucket
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('photos')
            .select('id, image_path, bucket_name')
            .eq('image_path', imagePath)
            .eq('bucket_name', bucketName)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError }, 'Photo not found in DB:');
            // If photo not in DB, try to delete from storage anyway
            const { error: storageError } = await supabaseAdmin.storage
                .from(bucketName)
                .remove([imagePath]);

            if (storageError) {
                logger.error({ err: storageError }, 'Storage delete error:');
            } else {
                logger.info('Image deleted from storage (orphan record)');
            }

            return res.status(204).send();
        }

        // Delete from Storage
        const { error: storageError } = await supabaseAdmin.storage
            .from(bucketName)
            .remove([photo.image_path]);

        if (storageError) {
            logger.error({ err: storageError }, 'Storage delete error:');
        } else {
            logger.info('Image deleted from storage');
        }

        // Delete from DB
        const { error: dbError } = await supabaseAdmin
            .from('photos')
            .delete()
            .eq('id', photo.id);

        if (dbError) {
            logger.error({ err: dbError }, 'DB delete error:');
        } else {
            logger.info({ photoId: photo.id }, 'Image record deleted from DB');
        }

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error }, 'Delete by URL error:');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete image by ID - Admin/Manager only
router.delete('/:id', authenticateToken, authorizeAssetAccess, async (req, res) => {
    try {
        // 1. Get image path and bucket from DB
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('photos')
            .select('image_path, bucket_name')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        if (!hasBucketPermission(req, photo.bucket_name, photo.image_path)) {
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
        }

        // 2. Delete from Storage (use the correct bucket)
        const bucketName = photo.bucket_name || 'images';
        const { error: storageError } = await supabaseAdmin.storage
            .from(bucketName)
            .remove([photo.image_path]);

        if (storageError) throw storageError;

        // 3. Delete from DB
        const { error: dbError } = await supabaseAdmin
            .from('photos')
            .delete()
            .eq('id', req.params.id);

        if (dbError) throw dbError;

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, photoId: req.params.id }, 'Failed to delete image by id');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

module.exports = router;
module.exports.canManageUploadType = canManageUploadType;
module.exports.hasBucketPermission = hasBucketPermission;
