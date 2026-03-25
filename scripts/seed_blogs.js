#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require('../backend/lib/supabase');

const PART1_PATH = path.join(__dirname, 'blog_data_part1.json');
const PART2_PATH = path.join(__dirname, 'blog_data_part2.json');

async function seedBlogs() {
    console.log('Starting blog seeding process...');

    try {
        const part1 = JSON.parse(fs.readFileSync(PART1_PATH, 'utf8'));
        const part2 = JSON.parse(fs.readFileSync(PART2_PATH, 'utf8'));
        const allBlogs = [...part1, ...part2];

        console.log(`Loaded ${allBlogs.length} blog posts.`);

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const blog of allBlogs) {
            // Check if blog exists by English title
            const { data: existing, error: checkError } = await supabaseAdmin
                .from('blogs')
                .select('id')
                .eq('title', blog.title)
                .maybeSingle();

            if (checkError) {
                console.error(`Error checking existence of "${blog.title}":`, checkError.message);
                continue;
            }

            const blogPayload = {
                title: blog.title,
                author: blog.author,
                excerpt: blog.excerpt,
                content: blog.content,
                tags: blog.tags,
                title_i18n: blog.title_i18n,
                author_i18n: blog.author_i18n,
                excerpt_i18n: blog.excerpt_i18n,
                content_i18n: blog.content_i18n,
                tags_i18n: blog.tags_i18n,
                published: true,
                date: new Date().toISOString() // Or spread them out
            };

            if (existing) {
                console.log(`Blog "${blog.title}" already exists. Updating...`);
                const { error: updateError } = await supabaseAdmin
                    .from('blogs')
                    .update(blogPayload)
                    .eq('id', existing.id);

                if (updateError) {
                    console.error(`Error updating "${blog.title}":`, updateError.message);
                } else {
                    updatedCount++;
                }
            } else {
                console.log(`Inserting new blog: "${blog.title}"`);
                const { error: insertError } = await supabaseAdmin
                    .from('blogs')
                    .insert([blogPayload]);

                if (insertError) {
                    console.error(`Error inserting "${blog.title}":`, insertError.message);
                } else {
                    insertedCount++;
                }
            }
        }

        console.log('\nSeeding summary:');
        console.log(`Inserted: ${insertedCount}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log('Done.');

    } catch (err) {
        console.error('Fatal error during seeding:', err.message);
        process.exit(1);
    }
}

seedBlogs();
