const { supabaseAdmin } = require('../config/supabase');

const PRIVATE_BUCKETS = new Set(['return-request-media', 'invoice-documents']);

const BUCKET_MAP = {
    product: 'product-media',
    carousel: 'gallery-media',
    event: 'event-media',
    blog: 'blog-media',
    gallery: 'gallery-media',
    team: 'team-media',
    testimonial: 'testimonial-media',
    profile: 'profile-images',
    policy: 'policy-documents',
    return: 'return-request-media',
    return_order: 'return-request-media',
    invoice: 'invoice-documents',
    brand: 'media-assets'
};

const STORAGE_URL_MARKERS = [
    '/storage/v1/object/public/',
    '/storage/v1/object/sign/'
];

function normalizePathSegment(value) {
    return String(value || '').replace(/^\/+|\/+$/g, '');
}

function sanitizePathSegment(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '')
        .toLowerCase();
}

function sanitizeFolderPath(folderPath) {
    return String(folderPath || '')
        .split('/')
        .map((segment) => sanitizePathSegment(segment))
        .filter(Boolean)
        .join('/');
}

function buildStoragePath(...segments) {
    return segments
        .map(normalizePathSegment)
        .filter(Boolean)
        .join('/');
}

function sanitizeFileName(fileName) {
    return String(fileName || 'file')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');
}

function parseStorageUrl(url) {
    if (!url) {
        return null;
    }

    const matchedMarker = STORAGE_URL_MARKERS.find((marker) => url.includes(marker));
    if (!matchedMarker) {
        return null;
    }

    const [, pathWithBucket] = url.split(matchedMarker);
    if (!pathWithBucket) {
        return null;
    }

    const cleanPath = pathWithBucket.split('?')[0];
    const firstSlashIndex = cleanPath.indexOf('/');
    if (firstSlashIndex === -1) {
        return null;
    }

    return {
        bucketName: cleanPath.substring(0, firstSlashIndex),
        filePath: cleanPath.substring(firstSlashIndex + 1)
    };
}

/**
 * Normalizes a legacy or inconsistent storage URL to the current standardized bucket/structure
 */
function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // Phase 1: Legacy Plural/Explicit Names -> New Granular Names
    let normalized = url
        .replace(/\/carousel_slides\//g, '/gallery-media/')
        .replace(/\/product_images\//g, '/product-media/')
        .replace(/\/event_images\//g, '/event-media/')
        .replace(/\/blog_images\//g, '/blog-media/')
        .replace(/\/testimonial_images\//g, '/testimonial-media/')
        .replace(/\/gallery_uploads\//g, '/gallery-media/')
        .replace(/\/profile_images\//g, '/profile-images/')
        .replace(/\/brand_assets\//g, '/media-assets/')
        .replace(/\/return_images\//g, '/return-request-media/')
        .replace(/\/invoices\//g, '/invoice-documents/');

    // Phase 2: Intermediate Standard Names -> New Granular Names (if they differ)
    // This handles the transition from my previous "intermediate" plural system.
    normalized = normalized
        .replace(/\/images\/products\//g, '/product-media/')
        .replace(/\/images\/carousel\//g, '/gallery-media/')
        .replace(/\/images\//g, '/media-assets/') // Catch-all for logos/etc.
        .replace(/\/events\//g, '/event-media/')
        .replace(/\/blogs\//g, '/blog-media/')
        .replace(/\/gallery\//g, '/gallery-media/')
        .replace(/\/team\//g, '/team-media/')
        .replace(/\/testimonial-user\//g, '/testimonial-media/')
        .replace(/\/profiles\//g, '/profile-images/');
    
    return normalized;
}

function isPrivateBucket(bucketName) {
    return PRIVATE_BUCKETS.has(bucketName);
}

async function resolveAssetUrl({ bucketName, filePath, isPublic, signedUrlExpiresIn = 60 * 60 * 24 * 7 }) {
    if (isPublic) {
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return publicUrl;
    }

    const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUrl(filePath, signedUrlExpiresIn);

    if (error) {
        throw error;
    }

    return data.signedUrl;
}

async function uploadBuffer({
    bucketName,
    filePath,
    buffer,
    contentType,
    upsert = false,
    isPublic = !isPrivateBucket(bucketName),
    signedUrlExpiresIn
}) {
    const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(filePath, buffer, {
            contentType,
            upsert
        });

    if (error) {
        throw error;
    }

    const url = await resolveAssetUrl({
        bucketName,
        filePath,
        isPublic,
        signedUrlExpiresIn
    });

    return {
        bucketName,
        filePath,
        url
    };
}

async function deleteAsset({ bucketName, filePath }) {
    const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .remove([filePath]);

    if (error) {
        throw error;
    }
}

async function deleteAssetByUrl(url) {
    const parsed = parseStorageUrl(url);
    if (!parsed) {
        return null;
    }

    await deleteAsset(parsed);
    return parsed;
}

module.exports = {
    BUCKET_MAP,
    buildStoragePath,
    sanitizeFileName,
    sanitizePathSegment,
    sanitizeFolderPath,
    parseStorageUrl,
    normalizeImageUrl,
    isPrivateBucket,
    resolveAssetUrl,
    uploadBuffer,
    deleteAsset,
    deleteAssetByUrl
};
