/**
 * Supabase Storage Migration Utility
 * Date: 2026-04-14
 * Description: Recursively copies files from legacy buckets to new granular buckets.
 *              Includes batch processing (limit 5) and path transformation logic.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MIGRATION_CONFIG = [
    { sourceBucket: 'product_images', targetBucket: 'product-media' },
    { sourceBucket: 'images', sourcePath: 'products/', targetBucket: 'product-media', stripPrefix: 'products/' },
    { sourceBucket: 'images', sourcePath: 'carousel/', targetBucket: 'gallery-media', prefixInTarget: 'carousel/' },
    { sourceBucket: 'carousel_slides', targetBucket: 'gallery-media', prefixInTarget: 'carousel/' },
    { sourceBucket: 'event_images', targetBucket: 'event-media' },
    { sourceBucket: 'events', targetBucket: 'event-media' },
    { sourceBucket: 'blog_images', targetBucket: 'blog-media' },
    { sourceBucket: 'blogs', targetBucket: 'blog-media' },
    { sourceBucket: 'gallery_uploads', targetBucket: 'gallery-media' },
    { sourceBucket: 'gallery', targetBucket: 'gallery-media' },
    { sourceBucket: 'profiles', targetBucket: 'profile-images' },
    { sourceBucket: 'profile_images', targetBucket: 'profile-images' },
    { sourceBucket: 'invoices', targetBucket: 'invoice-documents' },
    { sourceBucket: 'return_images', targetBucket: 'return-request-media' },
    { sourceBucket: 'returns', targetBucket: 'return-request-media' },
    { sourceBucket: 'brand_assets', targetBucket: 'media-assets' }
];

const BATCH_SIZE = 5;

async function listAllFiles(bucket, folder = '') {
    let allFiles = [];
    const { data: items, error } = await supabase.storage.from(bucket).list(folder);

    if (error) {
        console.error(`Error listing files in ${bucket}/${folder}:`, error.message);
        return [];
    }

    for (const item of items) {
        const itemPath = folder ? `${folder}/${item.name}` : item.name;
        if (item.id === null) {
            // It's a folder
            const subFiles = await listAllFiles(bucket, itemPath);
            allFiles = allFiles.concat(subFiles);
        } else {
            // It's a file
            allFiles.push(itemPath);
        }
    }

    return allFiles;
}

async function migrateFile(sourceBucket, targetBucket, sourceFilePath, config) {
    try {
        let targetFilePath = sourceFilePath;

        // 1. Handle Source Path Filtering
        if (config.sourcePath && !sourceFilePath.startsWith(config.sourcePath)) {
            return { skipped: true };
        }

        // 2. Handle Path Transformations
        if (config.stripPrefix) {
            targetFilePath = targetFilePath.replace(config.stripPrefix, '');
        }
        if (config.prefixInTarget) {
            targetFilePath = `${config.prefixInTarget}${targetFilePath}`;
        }

        // 3. Download from Source
        const { data: blob, error: downloadError } = await supabase.storage
            .from(sourceBucket)
            .download(sourceFilePath);

        if (downloadError) {
            throw new Error(`Download failed: ${downloadError.message}`);
        }

        // 4. Upload to Target
        const { error: uploadError } = await supabase.storage
            .from(targetBucket)
            .upload(targetFilePath, blob, {
                upsert: true,
                contentType: blob.type
            });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        return { success: true, source: `${sourceBucket}/${sourceFilePath}`, target: `${targetBucket}/${targetFilePath}` };
    } catch (err) {
        return { success: false, error: err.message, source: `${sourceBucket}/${sourceFilePath}` };
    }
}

async function runMigration() {
    console.log('--- Starting Storage Migration ---');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Concurrency Limit: ${BATCH_SIZE}`);
    console.log('----------------------------------\n');

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const config of MIGRATION_CONFIG) {
        console.log(`Scanning Bucket: ${config.sourceBucket}${config.sourcePath ? ` (folder: ${config.sourcePath})` : ''}...`);
        
        const files = await listAllFiles(config.sourceBucket, config.sourcePath || '');
        console.log(`Found ${files.length} files to migrate to ${config.targetBucket}.`);

        // Batch processing
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(file => migrateFile(config.sourceBucket, config.targetBucket, file, config))
            );

            for (const res of results) {
                if (res.success) {
                    totalSuccess++;
                    console.log(`[SUCCESS] Copied ${res.source} -> ${res.target}`);
                } else if (res.skipped) {
                    totalSkipped++;
                } else {
                    totalFailed++;
                    console.error(`[FAILURE] Failed ${res.source}: ${res.error}`);
                }
            }
        }
    }

    console.log('\n----------------------------------');
    console.log('--- Migration Summary ---');
    console.log(`Total Success: ${totalSuccess}`);
    console.log(`Total Failed:  ${totalFailed}`);
    console.log(`Total Skipped: ${totalSkipped}`);
    console.log('----------------------------------');
}

runMigration().catch(err => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
});
