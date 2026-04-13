const supabase = require('../lib/supabase');
const logger = require('../utils/logger');
const { STORAGE_BUCKETS } = require('../constants/storage');

function stripQuery(url) {
    if (!url) return '';
    return url.split('?')[0];
}

function extractStorageCandidates(imageUrl) {
    if (!imageUrl) return [];

    const cleanUrl = stripQuery(imageUrl);
    const candidates = new Set([imageUrl, cleanUrl]);

    try {
        const parsedUrl = new URL(cleanUrl);
        const publicMarker = '/storage/v1/object/public/';
        const signedMarker = '/storage/v1/object/sign/';
        const marker = parsedUrl.pathname.includes(publicMarker) ? publicMarker : signedMarker;

        if (parsedUrl.pathname.includes(marker)) {
            const storagePath = decodeURIComponent(parsedUrl.pathname.split(marker)[1]);
            if (storagePath) {
                const [bucketName, ...pathParts] = storagePath.split('/');
                const filePath = pathParts.join('/');
                if (bucketName && filePath) {
                    candidates.add(filePath);
                    candidates.add(`${bucketName}/${filePath}`);
                    // Add version without folder if applicable
                    if (pathParts.length > 1) {
                        candidates.add(pathParts[pathParts.length - 1]);
                    }
                }
            }
        }
    } catch {
        // Non-URL input is fine, we keep the original candidate.
    }

    return Array.from(candidates).filter(Boolean);
}

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

        const candidates = extractStorageCandidates(imageUrl);
        const exactPathCandidates = candidates.filter(candidate => !candidate.startsWith('http'));
        const fileName = imageUrl.split('/').pop()?.split('?')[0];

        let photo = null;

        if (exactPathCandidates.length > 0) {
            const { data, error: fetchByPathError } = await supabase
                .from('photos')
                .select('*')
                .in('image_path', exactPathCandidates)
                .limit(1)
                .maybeSingle();

            if (fetchByPathError) {
                logger.error({ err: fetchByPathError, imageUrl }, 'Error fetching photo by exact path');
                throw fetchByPathError;
            }

            photo = data || null;
        }

        if (!photo && fileName) {
            const { data: fallbackMatches, error: fallbackError } = await supabase
                .from('photos')
                .select('*')
                .ilike('image_path', `%${fileName}`)
                .limit(5);

            if (fallbackError) {
                logger.error({ err: fallbackError, imageUrl }, 'Error fetching photo by filename fallback');
                throw fallbackError;
            }

            photo = (fallbackMatches || []).find((candidate) =>
                candidates.some((value) => value.includes(candidate.image_path) || candidate.image_path.includes(value))
            ) || fallbackMatches?.[0] || null;
        }

        if (!photo) {
            logger.info({ data: imageUrl }, '📝 No photo record found in database for:');
            // Try to delete from storage anyway using the URL
            await attemptStorageDelete(imageUrl);
            return { success: true, message: 'No database record found' };
        }

        logger.info({ data: photo.id }, '✅ Found photo record:');

        // 2. Delete from storage
        const bucketName = photo.bucket_name || STORAGE_BUCKETS.MEDIA_ASSETS;
        const filePath = photo.image_path;

        logger.info({ bucketName, filePath }, '🗂️  Deleting from bucket:');

        const { data: removeData, error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

        if (storageError) {
            logger.error({ err: storageError }, '⚠️  Error deleting from storage:');
            // Continue with database deletion even if storage fails
        } else if (removeData && removeData.length > 0) {
            logger.info({ bucketName, filePath }, '✅ Deleted from storage');
        } else {
            logger.warn({ bucketName, filePath }, '⚠️  Storage record existed, but literal path was not found in bucket. Trying exhaustive search...');
            await attemptStorageDelete(imageUrl);
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
        const cleanUrl = stripQuery(imageUrl);
        const urlParts = cleanUrl.split('/');
        const publicIndex = urlParts.indexOf('public');

        if (publicIndex !== -1 && urlParts.length > publicIndex + 2) {
            const bucketName = decodeURIComponent(urlParts[publicIndex + 1]);
            
            // Generate exhaustive candidates for this bucket
            const candidates = extractStorageCandidates(imageUrl);
            const bucketSpecificPaths = candidates.filter(c => !c.startsWith('http') && !c.includes(bucketName + '/'));
            const fullPaths = candidates.filter(c => c.includes(bucketName + '/')).map(c => c.split(bucketName + '/')[1]);
            
            const allPaths = Array.from(new Set([...bucketSpecificPaths, ...fullPaths])).filter(Boolean);

            logger.info({ bucketName, allPaths }, `🔍 Exhaustive storage delete attempt:`);

            const { data, error } = await supabase.storage
                .from(bucketName)
                .remove(allPaths);

            if (error) {
                logger.error({ err: error, bucketName }, '⚠️  Exhaustive storage delete failed:');
            } else if (data && data.length > 0) {
                logger.info({ bucketName, deletedCount: data.length, paths: data.map(d => d.name) }, '✅ Successfully removed file(s) from storage');
            } else {
                logger.warn({ bucketName, searchedPaths: allPaths }, '⚠️  Exhaustive search finished but no files were removed. The file likely does not exist in this bucket.');
            }
        } else {
            logger.warn({ imageUrl }, '⚠️  Could not parse URL parts for storage deletion');
        }
    } catch (error) {
        logger.error({ err: error, imageUrl }, '⚠️ Error in attemptStorageDelete:');
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
