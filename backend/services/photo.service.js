const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Delete photo from storage and photos table by image URL
 * @param {string} imageUrl - The full URL or path of the image
 * @returns {Promise<{success: boolean, photo?: object, error?: object}>}
 */
async function deletePhotoByUrl(imageUrl) {
    if (!imageUrl) {
        return { success: true };
    }

    try {
        logger.info({ data: imageUrl }, '🗑️  Attempting to delete photo:');

        // 1. Find photo record in database by matching the URL
        const { data: photos, error: fetchError } = await supabase
            .from('photos')
            .select('*');

        if (fetchError) {
            logger.error({ err: fetchError }, 'Error fetching photos:');
            throw fetchError;
        }

        // Find photo that matches the URL (handle both full URLs and paths)
        const photo = photos?.find(p => {
            const photoUrl = p.image_path;
            return photoUrl === imageUrl ||
                imageUrl.includes(photoUrl) ||
                photoUrl.includes(imageUrl.split('/').pop());
        });

        if (!photo) {
            logger.info({ data: imageUrl }, '📝 No photo record found in database for:');
            // Try to delete from storage anyway using the URL
            await attemptStorageDelete(imageUrl);
            return { success: true, message: 'No database record found' };
        }

        logger.info({ data: photo.id }, '✅ Found photo record:');

        // 2. Delete from storage
        const bucketName = photo.bucket_name || 'images';
        const filePath = photo.image_path;

        logger.info(`🗂️  Deleting from bucket "${bucketName}":`, filePath);

        const { error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

        if (storageError) {
            logger.error({ err: storageError }, '⚠️  Error deleting from storage:');
            // Continue with database deletion even if storage fails
        } else {
            logger.info('✅ Deleted from storage');
        }

        // 3. Delete from photos table
        const { error: dbError } = await supabase
            .from('photos')
            .delete()
            .eq('id', photo.id);

        if (dbError) {
            logger.error({ err: dbError }, '❌ Error deleting from photos table:');
            throw dbError;
        }

        logger.info({ data: photo.id }, '✅ Photo metadata deleted from database:');
        return { success: true, photo };

    } catch (error) {
        logger.error({ err: error }, '❌ Error in deletePhotoByUrl:');
        return { success: false, error };
    }
}

/**
 * Attempt to delete from storage using URL patterns
 * @param {string} imageUrl - The image URL
 */
async function attemptStorageDelete(imageUrl) {
    try {
        // Extract potential bucket name and file path from URL
        // URL format: https://...supabase.co/storage/v1/object/public/BUCKET/path/filename
        const urlParts = imageUrl.split('/');
        const publicIndex = urlParts.indexOf('public');

        if (publicIndex !== -1 && urlParts.length > publicIndex + 2) {
            const bucketName = urlParts[publicIndex + 1];
            const filePath = urlParts.slice(publicIndex + 2).join('/');

            logger.info(`🔍 Attempting storage delete - Bucket: ${bucketName}, Path: ${filePath}`);

            const { error } = await supabase.storage
                .from(bucketName)
                .remove([filePath]);

            if (error) {
                logger.error({ err: error }, '⚠️  Storage delete failed:');
            } else {
                logger.info('✅ File deleted from storage');
            }
        }
    } catch (error) {
        logger.error({ err: error }, '⚠️  Could not parse URL for storage deletion:');
    }
}

/**
 * Delete multiple photos by their URLs
 * @param {string[]} imageUrls - Array of image URLs
 * @returns {Promise<Array>}
 */
async function deletePhotosByUrls(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
        return [];
    }

    logger.info(`🗑️  Deleting ${imageUrls.length} photos...`);
    const results = await Promise.all(imageUrls.map(deletePhotoByUrl));
    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ Successfully deleted ${successCount}/${imageUrls.length} photos`);

    return results;
}

module.exports = {
    deletePhotoByUrl,
    deletePhotosByUrls
};
