const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

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
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Upload file endpoint - Admin/Manager/User (requires auth)
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: req.t('errors.upload.noFile') });
        }

        const file = req.file;
        logger.debug({ uploadType: req.body.type }, 'Upload request received');
        logger.debug({ fileName: file ? file.originalname : 'No file' }, 'Processing file');

        const userId = req.body.userId || 'anonymous';
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
                    // user_id: userId 
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
        res.status(500).json({ error: error.message });
    }
});

// List user images
router.get('/user/:userId', async (req, res) => {
    try {
        // This would normally be protected by auth
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            // .eq('user_id', req.params.userId) // Enable if we use user_id
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
        res.status(500).json({ error: error.message });
    }
});

// Delete image by URL - MUST come before /:id route - Admin/Manager only
router.delete('/by-url', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
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
        res.status(500).json({ error: error.message });
    }
});

// Delete image by ID - Admin/Manager only
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        // 1. Get image path and bucket from DB
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('photos')
            .select('image_path, bucket_name')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

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
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
