const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { supabaseAdmin } = require(path.join(__dirname, '../backend/config/supabase'));

async function checkBlogsWithoutImages() {
    try {
        // Fetch all blogs
        const { data: blogs, error } = await supabaseAdmin
            .from('blogs')
            .select('id, title, image, published')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`Total blogs: ${blogs.length}`);

        const blogsWithoutImages = blogs.filter(blog => !blog.image || blog.image === '');
        console.log(`Blogs without images: ${blogsWithoutImages.length}\n`);

        if (blogsWithoutImages.length > 0) {
            console.log('Blogs missing images:');
            blogsWithoutImages.forEach((blog, index) => {
                console.log(`${index + 1}. [${blog.id}] ${blog.title} (Published: ${blog.published})`);
            });
        }

        return blogsWithoutImages;
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkBlogsWithoutImages().then(() => process.exit(0));
