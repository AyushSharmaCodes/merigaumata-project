const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth.middleware');
const { uploadWriteRateLimit } = require('../middleware/rateLimit.middleware');
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { getFriendlyMessage } = require('../utils/error-messages');
const {
    BUCKET_MAP,
    buildStoragePath,
    deleteAsset,
    parseStorageUrl,
    resolveAssetUrl,
    sanitizeFileName,
    uploadBuffer
} = require('../services/storage-asset.service');

const GENERIC_UPLOAD_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // Strict 5MB limit

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: GENERIC_UPLOAD_FILE_SIZE_LIMIT,
    },
    fileFilter: (req, file, cb) => {
        // Expanded list to handle common browser/OS variations (e.g. image/jpg, image/x-png)
        const allowedMimeTypes = [
            'image/jpeg', 'image/jpg', 'image/pjpeg',
            'image/png', 'image/x-png',
            'image/webp', 'image/gif', 'image/svg+xml',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        const mimetype = (file.mimetype || '').toLowerCase();
        
        if (allowedMimeTypes.includes(mimetype)) {
            cb(null, true);
        } else {
            const error = new Error('errors.upload.invalidFileType');
            error.status = 400; // Explicit status to prevent 500 in global handler
            cb(error, false);
        }
    }
});

const UPLOAD_TYPE_PERMISSIONS = {
    product: 'can_manage_products',
    event: 'can_manage_events',
    blog: 'can_manage_blogs',
    gallery: 'can_manage_gallery',
    carousel: 'can_manage_gallery', // Carousel now managed via gallery
    team: 'can_manage_about_us',
    policy: 'can_manage_policies'
};

async function insertPhotoMetadataWithFallback({
    imagePath,
    bucketName,
    title,
    size,
    mimeType,
    userId
}) {
    // Current schema uses user_id, but we trial both common patterns to be robust
    const payloads = [
        {
            image_path: imagePath,
            bucket_name: bucketName,
            title,
            size,
            mime_type: mimeType,
            user_id: userId !== 'anonymous' ? userId : null
        },
        {
            image_path: imagePath,
            bucket_name: bucketName,
            title,
            size,
            mime_type: mimeType,
            created_by: userId !== 'anonymous' ? userId : null
        }
    ];

    let lastError = null;

    for (const payload of payloads) {
        const { data, error } = await supabaseAdmin
            .from('photos')
            .insert([payload])
            .select()
            .single();

        if (!error) {
            return { data, error: null };
        }

        lastError = error;
        // If it's a "missing column" error, we try the next payload
        if (error.code !== 'PGRST204' && error.code !== '42703') {
            break; 
        }
    }

    // Final fallback: Insert with minimum fields if possible
    if (lastError) {
        const { data, error } = await supabaseAdmin
            .from('photos')
            .insert([{
                image_path: imagePath,
                bucket_name: bucketName,
                title,
                size,
                mime_type: mimeType
            }])
            .select()
            .single();
            
        if (!error) return { data, error: null };
        return { data: null, error };
    }

    return { data: null, error: lastError };
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

    if (bucketName === 'return-request-media') {
        return imagePath.startsWith(`${req.user?.id}/`) || imagePath.startsWith(`returns/${req.user?.id}/`);
    }

    if (req.user?.role !== 'manager' || !req.managerPermissions?.is_active) {
        return false;
    }

    const permissions = req.managerPermissions;

    if (bucketName === 'gallery-media') return !!permissions.can_manage_gallery;
    if (bucketName === 'team-media') return !!permissions.can_manage_about_us;
    if (bucketName === 'event-media') return !!permissions.can_manage_events;
    if (bucketName === 'blog-media') return !!permissions.can_manage_blogs;
    if (bucketName === 'testimonial-media') return !!permissions.can_manage_testimonials;
    if (bucketName === 'policy-documents') return !!permissions.can_manage_policies;

    if (bucketName === 'profile-images') {
        return imagePath.startsWith(`${req.user.id}/`);
    }

    if (bucketName === 'product-media') return !!permissions.can_manage_products;
    if (bucketName === 'media-assets') return true; // General assets usually manageable

    return false;
}

// Upload file endpoint - Admin/Manager/User (requires auth)
router.post('/', uploadWriteRateLimit, authenticateToken, upload.single('file'), requestLock(req => `upload-create:${req.body?.type || 'product'}:${req.file?.originalname || 'default'}`), authorizeUploadType, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: req.t('errors.upload.noFile') });
        }

        const file = req.file;
        // Sharp processing removed to prevent memory spikes on 1GB RAM environment
        // Images are now uploaded directly as received, adhering to the 5MB file limit.

        logger.debug({ uploadType: req.body.type }, 'Upload request received');
        logger.debug({ fileName: file ? file.originalname : 'No file' }, 'Processing file');

        const userId = req.user?.id || 'anonymous';
        const type = req.body.type || 'product';
        const folder = req.body.folder || '';
        const timestamp = Date.now();
        const cleanFileName = sanitizeFileName(file.originalname);

        let bucketName = BUCKET_MAP[type] || 'media-assets';
        let filePath = '';
        let isPublic = !['profile', 'return', 'return_order', 'invoice'].includes(type);

        // Determine path based on type
        switch (type) {
            case 'event':
            case 'blog':
            case 'team':
            case 'testimonial':
            case 'policy':
                filePath = buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'profile':
                filePath = buildStoragePath(userId, `avatar-${timestamp}-${cleanFileName}`);
                break;
            case 'gallery':
                filePath = folder
                    ? buildStoragePath(folder, `${timestamp}-${cleanFileName}`)
                    : buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'carousel':
                filePath = buildStoragePath('carousel', `${timestamp}-${cleanFileName}`);
                break;
            case 'product':
                filePath = buildStoragePath(`${timestamp}-${cleanFileName}`);
                break;
            case 'invoice':
                filePath = buildStoragePath(userId, `invoice-${timestamp}-${cleanFileName}`);
                break;
            case 'return':
            case 'return_order':
                filePath = folder
                    ? buildStoragePath(userId, folder, `${timestamp}-${cleanFileName}`)
                    : buildStoragePath(userId, `${timestamp}-${cleanFileName}`);
                break;
            default:
                filePath = buildStoragePath(userId, `${timestamp}-${cleanFileName}`);
                break;
        }

        // Private uploads: never upsert to prevent overwriting another user's files.
        // Public content uploads: upsert:true so re-submitting a form with the same file
        // (e.g. editing an event without changing the image) doesn't cause a 409 Conflict.
        const isPrivateUpload = ['profile', 'return', 'return_order', 'invoice'].includes(type);

        const uploadedAsset = await uploadBuffer({
            bucketName,
            filePath,
            buffer: file.buffer,
            contentType: file.mimetype,
            upsert: !isPrivateUpload,
            isPublic,
            signedUrlExpiresIn: 60 * 60 * 24 * 7
        });

        // 3. Save metadata to photos table
        const { data: photoData, error: dbError } = await insertPhotoMetadataWithFallback({
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
            const bucketName = photo.bucket_name || 'images';
            const url = await resolveAssetUrl({
                bucketName,
                filePath: photo.image_path,
                isPublic: bucketName !== 'profiles'
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
        const bucketName = photo.bucket_name || 'images';
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
module.exports.insertPhotoMetadataWithFallback = insertPhotoMetadataWithFallback;
