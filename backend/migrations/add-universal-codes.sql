-- Add unique codes to products and categories tables

-- 1. Products Table
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(100) UNIQUE;

CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.product_code IS NULL THEN
        -- Format: PROD-<First 3 chars of Name>-<Random 4 chars>
        NEW.product_code := 'PROD-' || 
                          UPPER(SUBSTRING(REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                          '-' || 
                          UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 4));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_product_code ON products;
CREATE TRIGGER trigger_generate_product_code
    BEFORE INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION generate_product_code();

-- Backpopulate products
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, title FROM products WHERE product_code IS NULL LOOP
        UPDATE products 
        SET product_code = 'PROD-' || 
                           UPPER(SUBSTRING(REGEXP_REPLACE(r.title, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                           '-' || 
                           UPPER(SUBSTRING(MD5(r.id::text || NOW()::text) FROM 1 FOR 4))
        WHERE id = r.id;
    END LOOP;
END $$;


-- 2. Categories Table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_code VARCHAR(100);
-- Note: category_code might not be unique globally if we have multiple types, but per type+name it is unique. 
-- Let's make it unique for simplicity or per constraint. 
-- Actually, categories table uses (name, type) as unique. Let's make category_code unique to be safe.
ALTER TABLE categories ADD CONSTRAINT categories_code_unique UNIQUE (category_code);

CREATE OR REPLACE FUNCTION generate_category_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.category_code IS NULL THEN
        -- Format: CAT-<First 3 chars of Name>-<Random 4 chars>
        NEW.category_code := 'CAT-' || 
                          UPPER(SUBSTRING(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                          '-' || 
                          UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 4));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_category_code ON categories;
CREATE TRIGGER trigger_generate_category_code
    BEFORE INSERT ON categories
    FOR EACH ROW
    EXECUTE FUNCTION generate_category_code();

-- Backpopulate categories
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, name FROM categories WHERE category_code IS NULL LOOP
        UPDATE categories 
        SET category_code = 'CAT-' || 
                            UPPER(SUBSTRING(REGEXP_REPLACE(r.name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                            '-' || 
                            UPPER(SUBSTRING(MD5(r.id::text || NOW()::text) FROM 1 FOR 4))
        WHERE id = r.id;
    END LOOP;
END $$;


-- 3. Blogs Table
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS blog_code VARCHAR(100) UNIQUE;

CREATE OR REPLACE FUNCTION generate_blog_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.blog_code IS NULL THEN
        -- Format: BLOG-<First 3 chars of Title>-<Random 4 chars>
        NEW.blog_code := 'BLOG-' || 
                          UPPER(SUBSTRING(REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                          '-' || 
                          UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 4));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_blog_code ON blogs;
CREATE TRIGGER trigger_generate_blog_code
    BEFORE INSERT ON blogs
    FOR EACH ROW
    EXECUTE FUNCTION generate_blog_code();

-- Backpopulate blogs
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, title FROM blogs WHERE blog_code IS NULL LOOP
        UPDATE blogs 
        SET blog_code = 'BLOG-' || 
                           UPPER(SUBSTRING(REGEXP_REPLACE(r.title, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3)) || 
                           '-' || 
                           UPPER(SUBSTRING(MD5(r.id::text || NOW()::text) FROM 1 FOR 4))
        WHERE id = r.id;
    END LOOP;
END $$;
