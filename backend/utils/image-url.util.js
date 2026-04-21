const { resolveAssetUrl, normalizeImageUrl, parseStorageUrl } = require('../services/storage-asset.service');
const logger = require('./logger');

/**
 * Ensures an image URL is a valid absolute public URL.
 * Handles legacy paths by normalizing and prepending Supabase Storage URL if needed.
 * 
 * @param {string} url - The URL or path to fix
 * @param {string} defaultBucket - Fallback bucket if not detected in path
 * @returns {Promise<string>} - Absolute public URL
 */
async function fixImageUrl(url, defaultBucket = 'media-assets') {
    if (!url || typeof url !== 'string') return url;

    const trimmedUrl = url.trim();
    const normalizedUrl = normalizeImageUrl(trimmedUrl);

    // Step 1: Normalize absolute Supabase storage URLs too so legacy bucket names
    // still resolve after bucket migrations.
    if (/^https?:\/\//i.test(trimmedUrl)) {
        const parsed = parseStorageUrl(normalizedUrl);

        if (!parsed?.bucketName || !parsed?.filePath) {
            return trimmedUrl;
        }

        try {
            return await resolveAssetUrl({
                bucketName: parsed.bucketName,
                filePath: parsed.filePath,
                isPublic: true
            });
        } catch (error) {
            logger.warn({ err: error, url: trimmedUrl, bucket: parsed.bucketName, path: parsed.filePath }, '[ImageUrlUtil] Failed to resolve absolute asset URL');
            return trimmedUrl;
        }
    }

    // Step 2: Normalize relative storage paths / legacy bucket segments.
    const normalized = normalizedUrl.replace(/^\/+|\/+$/g, '');

    // Step 3: Extract bucket if present in path (e.g. "gallery-media/img.jpg")
    let bucket = defaultBucket;
    let path = normalized;
    
    const parts = normalized.split('/');
    const knownBuckets = [
        'gallery-media', 'product-media', 'event-media', 'blog-media', 
        'team-media', 'testimonial-media', 'profile-images', 'media-assets',
        'policy-documents', 'return-request-media', 'invoice-documents'
    ];

    if (parts.length > 1 && knownBuckets.includes(parts[0])) {
        bucket = parts[0];
        path = parts.slice(1).join('/');
    }

    try {
        return await resolveAssetUrl({
            bucketName: bucket,
            filePath: path,
            isPublic: true
        });
    } catch (error) {
        logger.warn({ err: error, url, bucket, path }, '[ImageUrlUtil] Failed to resolve asset URL');
        return url; // Fallback to original if resolution fails
    }
}

module.exports = {
    fixImageUrl
};
