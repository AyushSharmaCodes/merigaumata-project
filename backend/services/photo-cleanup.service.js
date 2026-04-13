const { supabase, supabaseAdmin } = require('../lib/supabase');
const logger = require('../utils/logger');
const { deletePhotosByUrls } = require('./photo.service');
const { createModuleLogger } = require('../utils/logging-standards');
const { STORAGE_BUCKETS } = require('../constants/storage');

const log = createModuleLogger('PhotoCleanupService');

/**
 * Photo Cleanup Service
 * Identifies and removes orphan images from storage and the photos table.
 */
class PhotoCleanupService {
    /**
     * Identifies photos that are not referenced in any entity tables and deletes them.
     * Uses a 24-hour grace period for recently uploaded files.
     */
    static async cleanupOrphanPhotos() {
        log.info('START_CLEANUP', 'Starting orphan photo cleanup process');

        try {
            // 1. Collect all referenced image URLs/paths from all relevant tables
            const referencedUrls = await this.getAllReferencedUrls();
            log.info('REFERENCED_COLLECTED', `Collected ${referencedUrls.size} unique referenced image URLs`);

            // 2. Fetch all photo records older than 24 hours
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: photos, error: fetchError } = await supabaseAdmin
                .from('photos')
                .select('id, image_path, bucket_name')
                .lt('created_at', twentyFourHoursAgo);

            if (fetchError) throw fetchError;
            if (!photos || photos.length === 0) {
                log.info('NO_PHOTOS_TO_CHECK', 'No photos older than 24 hours found to check');
                return { processed: 0, deleted: 0 };
            }

            log.info('PHOTOS_FETCHED', `Checking ${photos.length} photos for orphan status`);

            // 3. Identify orphans
            const orphans = [];
            for (const photo of photos) {
                const isReferenced = this.isPhotoReferenced(photo, referencedUrls);
                if (!isReferenced) {
                    orphans.push(photo);
                }
            }

            if (orphans.length === 0) {
                log.info('NO_ORPHANS_FOUND', 'No orphan photos identified in this run');
                return { processed: photos.length, deleted: 0 };
            }

            log.info('ORPHANS_IDENTIFIED', `Found ${orphans.length} orphan photos to delete`);

            // 4. Delete orphans from storage and database
            let deleteCount = 0;
            for (const orphan of orphans) {
                try {
                    // Extract full URL or construct one to use existing deletePhotoByUrl logic
                    // Or just call supabase storage delete directly then delete from DB
                    const { error: storageError } = await supabaseAdmin.storage
                        .from(orphan.bucket_name || STORAGE_BUCKETS.MEDIA_ASSETS)
                        .remove([orphan.image_path]);

                    if (storageError) {
                        log.warn('STORAGE_DELETE_FAIL', `Failed to delete orphan file from storage: ${orphan.image_path}`, { error: storageError });
                    }

                    const { error: dbError } = await supabaseAdmin
                        .from('photos')
                        .delete()
                        .eq('id', orphan.id);

                    if (dbError) {
                        log.error('DB_DELETE_FAIL', `Failed to delete orphan record from photos table: ${orphan.id}`, { error: dbError });
                    } else {
                        deleteCount++;
                    }
                } catch (err) {
                    log.error('ORPHAN_DELETE_ERROR', `Error processing orphan ${orphan.id}`, { error: err.message });
                }
            }

            log.info('CLEANUP_COMPLETE', `Successfully cleaned up ${deleteCount} orphan photos`);
            return { processed: photos.length, deleted: deleteCount };

        } catch (error) {
            log.error('CLEANUP_FAILED', 'Orphan photo cleanup job failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Checks if a photo record is present in the set of referenced URLs
     */
    static isPhotoReferenced(photo, referencedUrls) {
        // We check if any referenced URL contains the image_path
        // Image paths in referencedUrls are usually full URLs: https://.../BUCKET/PATH
        // Our photo.image_path is just the PATH within the bucket.
        
        const path = photo.image_path;
        if (!path) return true; // Safety check

        for (const url of referencedUrls) {
            if (url && url.includes(path)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Queries all relevant tables to collect every referenced image URL/path.
     * @returns {Promise<Set<string>>} A set of unique URLs/paths
     */
    static async getAllReferencedUrls() {
        const urls = new Set();

        // Helper to add results to the set
        const addResults = (results, fieldName, isArray = false) => {
            if (!results) return;
            results.forEach(row => {
                const value = row[fieldName];
                if (isArray && Array.isArray(value)) {
                    value.forEach(v => v && urls.add(String(v)));
                } else if (value) {
                    urls.add(String(value));
                }
            });
        };

        // Fetch references from all tables in parallel
        const queries = [
            supabaseAdmin.from('products').select('images'),
            supabaseAdmin.from('product_variants').select('variant_image_url'),
            supabaseAdmin.from('profiles').select('avatar_url'),
            supabaseAdmin.from('blogs').select('image'),
            supabaseAdmin.from('return_items').select('images'),
            supabaseAdmin.from('gallery_items').select('image_url'),
            supabaseAdmin.from('team_members').select('image_url'),
            supabaseAdmin.from('testimonials').select('image'),
            supabaseAdmin.from('carousels').select('image_url')
        ];

        const results = await Promise.all(queries);

        addResults(results[0].data, 'images', true);
        addResults(results[1].data, 'variant_image_url');
        addResults(results[2].data, 'avatar_url');
        addResults(results[3].data, 'image');
        addResults(results[4].data, 'images', true);
        addResults(results[5].data, 'image_url');
        addResults(results[6].data, 'image_url');
        addResults(results[7].data, 'image');
        addResults(results[8].data, 'image_url');

        return urls;
    }
}

module.exports = PhotoCleanupService;
