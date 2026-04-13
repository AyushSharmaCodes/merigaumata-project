const { supabaseAdmin } = require('../lib/supabase');
const { PRIVATE_BUCKETS: PRIVATE_BUCKET_LIST } = require('../constants/storage');

const PRIVATE_BUCKETS = new Set(PRIVATE_BUCKET_LIST);
const STORAGE_URL_MARKERS = [
    '/storage/v1/object/public/',
    '/storage/v1/object/sign/'
];

function normalizePathSegment(value) {
    return String(value || '').replace(/^\/+|\/+$/g, '');
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
    buildStoragePath,
    sanitizeFileName,
    parseStorageUrl,
    isPrivateBucket,
    resolveAssetUrl,
    uploadBuffer,
    deleteAsset,
    deleteAssetByUrl
};
