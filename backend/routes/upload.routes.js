const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const sharp = require('sharp');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth.middleware');
const { uploadWriteRateLimit } = require('../middleware/rateLimit.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');
const { STORAGE_BUCKETS } = require('../constants/storage');
const {
    createImageUploadMiddleware,
    handleImageUpload
} = require('../utils/image-upload');
const {
    buildStoragePath,
    deleteAsset,
    parseStorageUrl,
    resolveAssetUrl,
    sanitizeFileName,
    uploadBuffer
} = require('../services/storage-asset.service');

const upload = createImageUploadMiddleware();

const UPLOAD_TYPE_PERMISSIONS = {
    product: 'can_manage_products',
    event: 'can_manage_events',
    blog: 'can_manage_blogs',
    gallery: 'can_manage_gallery',
    team: 'can_manage_about_us',
    carousel: 'can_manage_carousel'
};

async function insertPhotoMetadata({
    imagePath,
    bucketName,
    title,
    size,
    mimeType,
    userId
}) {
    // CRIT-06 FIX: Single INSERT with correct column names from authoritative schema.
    // The `photos` table has both `created_by` and `user_id` columns (see baseline:1329-1340).
    const { data, error } = await supabaseAdmin
        .from('photos')
        .insert([{
            image_path: imagePath,
            bucket_name: bucketName,
            title,
            size,
            mime_type: mimeType,
            created_by: userId,
            user_id: userId
        }])
        .select()
        .single();

    return { data, error };
}

async function insertPhotoMetadataWithFallback(payload) {
    const primaryResult = await insertPhotoMetadata(payload);

    if (!primaryResult.error?.message?.includes('bucket_name')) {
        return {
            data: primaryResult.data || null,
            error: primaryResult.error || null
        };
    }

    const { imagePath, title, size, mimeType, userId } = payload;
    const { data, error } = await supabaseAdmin
        .from('photos')
        .insert([{
            image_path: imagePath,
            title,
            size,
            mime_type: mimeType,
            user_id: userId
        }])
        .select()
        .single();

    return { data: data || null, error: error || null };
}

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

    if (type === 'profile' || type === 'testimonial' || type === 'return' || type === 'return_order') {
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

        if (req.user.role === 'customer') {
            return next();
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

    if (bucketName === STORAGE_BUCKETS.RETURN_REQUEST_MEDIA) {
        return imagePath.startsWith(`returns/${req.user?.id}/`);
    }

    if (req.user?.role !== 'manager' || !req.managerPermissions?.is_active) {
        return false;
    }

    const permissions = req.managerPermissions;

    if (bucketName === STORAGE_BUCKETS.GALLERY_MEDIA) return !!permissions.can_manage_gallery;
    if (bucketName === STORAGE_BUCKETS.TEAM_MEDIA) return !!permissions.can_manage_about_us;
    if (bucketName === STORAGE_BUCKETS.EVENT_MEDIA) return !!permissions.can_manage_events;
    if (bucketName === STORAGE_BUCKETS.BLOG_MEDIA) return !!permissions.can_manage_blogs;
    if (bucketName === STORAGE_BUCKETS.TESTIMONIAL_MEDIA) return !!permissions.can_manage_testimonials;

    if (bucketName === STORAGE_BUCKETS.PROFILE_IMAGES) {
        return imagePath.startsWith(`${req.user.id}/`);
    }

    if (bucketName === STORAGE_BUCKETS.MEDIA_ASSETS) {
        if (imagePath.startsWith('products/')) return !!permissions.can_manage_products;
        if (imagePath.startsWith('carousel/')) return !!permissions.can_manage_carousel;
    }

    return false;
}

// Upload file endpoint - Admin/Manager/User (requires auth)
router.post('/', uploadWriteRateLimit, authenticateToken, handleImageUpload(upload, 'file'), requestLock(req => `upload-create:${req.file?.originalname || 'default'}`), authorizeUploadType, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: req.t('errors.upload.noFile') });
        }

        const file = req.file;
        try {
            await sharp(file.buffer, { failOn: 'error' }).metadata();
        } catch {
            return res.status(400).json({ error: req.t('errors.upload.invalidImage') || 'Invalid image file' });
        }

        logger.debug({ uploadType: req.body.type }, 'Upload request received');
        logger.debug({ fileName: file ? file.originalname : 'No file' }, 'Processing file');

        const userId = req.user?.id || 'anonymous';
        const type = req.body.type || 'product'; // product, event, blog, profile, gallery, team
        // CRIT-04 FIX: Sanitize folder to prevent path traversal attacks
        const rawFolder = req.body.folder || '';
        const folder = rawFolder.replace(/\.\./g, '').replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
        const timestamp = Date.now();
        const cleanFileName = sanitizeFileName(file.originalname);

        let bucketName = STORAGE_BUCKETS.MEDIA_ASSETS;
        let filePath = '';
        let isPublic = true;

        // Determine bucket and path based on type
        switch (type) {
            case 'event':
                bucketName = STORAGE_BUCKETS.EVENT_MEDIA;
                filePath = buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'blog':
                bucketName = STORAGE_BUCKETS.BLOG_MEDIA;
                filePath = buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'profile':
                bucketName = STORAGE_BUCKETS.PROFILE_IMAGES;
                filePath = buildStoragePath(userId, `avatar-${timestamp}-${cleanFileName}`);
                break;
            case 'gallery':
                bucketName = STORAGE_BUCKETS.GALLERY_MEDIA;
                filePath = folder
                    ? buildStoragePath(folder, `${timestamp}-${cleanFileName}`)
                    : buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'team':
                bucketName = STORAGE_BUCKETS.TEAM_MEDIA;
                filePath = buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'carousel':
                bucketName = STORAGE_BUCKETS.MEDIA_ASSETS;
                filePath = buildStoragePath('carousel', `${timestamp}-${cleanFileName}`);
                break;
            case 'product':
                bucketName = STORAGE_BUCKETS.MEDIA_ASSETS;
                filePath = buildStoragePath('products', `${timestamp}-${cleanFileName}`);
                break;
            case 'testimonial':
                bucketName = STORAGE_BUCKETS.TESTIMONIAL_MEDIA;
                filePath = buildStoragePath('avatar', `${timestamp}-${cleanFileName}`);
                break;
            case 'return':
            case 'return_order':
                bucketName = STORAGE_BUCKETS.RETURN_REQUEST_MEDIA;
                filePath = folder
                    ? buildStoragePath('returns', userId, folder, `${timestamp}-${cleanFileName}`)
                    : buildStoragePath('returns', userId, `${timestamp}-${cleanFileName}`);
                break;
            default:
                bucketName = STORAGE_BUCKETS.MEDIA_ASSETS;
                filePath = buildStoragePath(userId, `${timestamp}-${cleanFileName}`);
                break;
        }

        const uploadedAsset = await uploadBuffer({
            bucketName,
            filePath,
            buffer: file.buffer,
            contentType: file.mimetype,
            upsert: false,
            isPublic,
            signedUrlExpiresIn: 60 * 60 * 24 * 7
        });

        // 3. Save metadata to photos table
        const { data: photoData, error: dbError } = await insertPhotoMetadata({
            imagePath: filePath,
            bucketName,
            title: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            userId
        });

        if (dbError) {
            logger.warn({ err: dbError, bucketName, filePath }, 'Upload metadata insert failed; continuing with storage asset only');
        }

        res.status(201).json({
            message: req.t('success.upload.fileUploaded'),
            url: uploadedAsset.url,
            path: filePath,
            bucket: bucketName,
            id: photoData?.id || filePath
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
            const bucketName = photo.bucket_name || STORAGE_BUCKETS.MEDIA_ASSETS;
            const url = await resolveAssetUrl({
                bucketName,
                filePath: photo.image_path,
                isPublic: bucketName !== STORAGE_BUCKETS.POLICY_DOCUMENTS && bucketName !== STORAGE_BUCKETS.INVOICE_DOCUMENTS
            });

            return {
                ...photo,
                url
            };
        }));

        res.json(imagesWithUrls);
    } catch (error) {
        logger.error({ err: error, userId: req.params.userId }, 'Failed to list user images');
        res.status(error.status || 500).json({ error: getFriendlyMessage(error, error.status || 500) });
    }
});

// Delete image by URL - MUST come before /:id route - Admin/Manager only
router.delete('/by-url', uploadWriteRateLimit, authenticateToken, requestLock(req => `upload-delete-by-url:${req.body.url || 'default'}`), idempotency(), authorizeAssetAccess, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: req.t('errors.upload.urlRequired') });
        }

        const parsedUrl = parseStorageUrl(url);
        if (!parsedUrl) {
            return res.status(400).json({ error: req.t('errors.upload.invalidUrl') });
        }

        const { bucketName, filePath } = parsedUrl;

        if (!hasBucketPermission(req, bucketName, filePath)) {
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
        }

        logger.debug({ bucket: bucketName }, 'Delete by URL - processing');

        // Find the photo record by path and bucket
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('photos')
            .select('id, image_path, bucket_name')
            .eq('image_path', filePath)
            .eq('bucket_name', bucketName)
            .maybeSingle();

        if (fetchError) {
            logger.error({ err: fetchError }, 'Photo not found in DB:');
            // If photo not in DB, try to delete from storage anyway
            try {
                await deleteAsset({ bucketName, filePath });
                logger.info('Image deleted from storage (orphan record)');
            } catch (storageError) {
                logger.error({ err: storageError }, 'Storage delete error:');
            }

            return res.status(204).send();
        }

        if (!photo) {
            try {
                await deleteAsset({ bucketName, filePath });
                logger.info('Image deleted from storage without matching DB row');
            } catch (storageError) {
                logger.error({ err: storageError }, 'Storage delete error:');
            }

            return res.status(204).send();
        }

        // Delete from Storage
        try {
            await deleteAsset({ bucketName, filePath: photo.image_path });
            logger.info('Image deleted from storage');
        } catch (storageError) {
            logger.error({ err: storageError }, 'Storage delete error:');
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
router.delete('/:id', uploadWriteRateLimit, authenticateToken, requestLock((req) => `upload-delete:${req.params.id}`), idempotency(), authorizeAssetAccess, async (req, res) => {
    try {
        // 1. Get image path and bucket from DB
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('photos')
            .select('image_path, bucket_name')
            .eq('id', req.params.id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!photo) {
            return res.status(204).send();
        }

        if (!hasBucketPermission(req, photo.bucket_name, photo.image_path)) {
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
        }

        // 2. Delete from Storage (use the correct bucket)
        const bucketName = photo.bucket_name || STORAGE_BUCKETS.MEDIA_ASSETS;
        await deleteAsset({ bucketName, filePath: photo.image_path });

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
module.exports.insertPhotoMetadata = insertPhotoMetadata;
module.exports.insertPhotoMetadataWithFallback = insertPhotoMetadataWithFallback;
