const supabase = require('../config/supabase');
const logger = require('./logger');

/**
 * Upload base64 image to Supabase Storage
 * 
 * @param {string} base64Data - Base64 data URL (e.g., "data:image/png;base64,...")
 * @param {string} bucket - Supabase storage bucket name
 * @param {string} filename - Filename for the uploaded file
 * @returns {Promise<string>} Public URL of uploaded image
 */
async function uploadBase64Image(base64Data, bucket, filename) {
    try {
        // Extract base64 string from data URL
        const base64String = base64Data.split(';base64,').pop();

        if (!base64String) {
            throw new Error('Invalid base64 data');
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64String, 'base64');

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filename, imageBuffer, {
                contentType: 'image/png',
                upsert: true,
                cacheControl: '3600'
            });

        if (error) {
            logger.error({ err: error, bucket, filename }, '[UploadHelper] Supabase upload error');
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filename);

        logger.debug({ bucket, filename }, '[UploadHelper] Successfully uploaded base64 image');
        return publicUrl;
    } catch (error) {
        logger.error({ err: error, bucket, filename }, '[UploadHelper] Error uploading base64 image');
        throw new Error('Failed to upload image to storage');
    }
}

/**
 * Upload file from multer to Supabase Storage
 * 
 * @param {Object} file - Multer file object
 * @param {string} bucket - Supabase storage bucket name
 * @param {string} filename - Optional custom filename
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadFileToSupabase(file, bucket, filename = null) {
    try {
        const uploadFilename = filename || `${Date.now()}_${file.originalname}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(uploadFilename, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
                cacheControl: '3600'
            });

        if (error) {
            logger.error({ err: error, bucket, filename: uploadFilename }, '[UploadHelper] Supabase file upload error');
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadFilename);

        logger.debug({ bucket, filename: uploadFilename }, '[UploadHelper] Successfully uploaded file');
        return publicUrl;
    } catch (error) {
        logger.error({ err: error, bucket }, '[UploadHelper] Error uploading file');
        throw new Error('Failed to upload file to storage');
    }
}

/**
 * Delete file from Supabase Storage
 * 
 * @param {string} fileUrl - Full URL of the file to delete
 * @param {string} bucket - Supabase storage bucket name
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteFileFromSupabase(fileUrl, bucket) {
    try {
        // Extract filename from URL
        const urlParts = fileUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        const { error } = await supabase.storage
            .from(bucket)
            .remove([filename]);

        if (error) {
            logger.error({ err: error, bucket, filename }, '[UploadHelper] Error deleting file');
            return false;
        }

        logger.debug({ bucket, filename }, '[UploadHelper] Successfully deleted file');
        return true;
    } catch (error) {
        logger.error({ err: error, bucket, fileUrl }, '[UploadHelper] Error in deleteFileFromSupabase');
        return false;
    }
}

module.exports = {
    uploadBase64Image,
    uploadFileToSupabase,
    deleteFileFromSupabase
};
