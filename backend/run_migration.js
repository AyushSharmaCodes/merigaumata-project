#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('📄 Reading migration file...');
        const migrationPath = path.join(__dirname, 'migrations', '20260216_add_variant_size_label_i18n.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Executing migration...');
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // If exec_sql RPC doesn't exist, try direct execution
            console.log('⚠️  exec_sql RPC not found, trying direct execution...');

            // Split SQL into statements and execute them
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
                const { error: execError } = await supabase.rpc('exec', { sql: statement + ';' });
                if (execError) {
                    console.error('❌ Error executing statement:', execError);
                    throw execError;
                }
            }
        }

        console.log('✅ Migration executed successfully!');

        // Verify the column was added
        console.log('\n🔍 Verifying migration...');
        const { data: columns, error: verifyError } = await supabase
            .from('product_variants')
            .select('*')
            .limit(1);

        if (verifyError) {
            console.error('❌ Verification error:', verifyError);
        } else {
            console.log('✅ Verification successful - product_variants table accessible');
            if (columns && columns[0]) {
                const hasI18nField = 'size_label_i18n' in columns[0];
                console.log(`   size_label_i18n field: ${hasI18nField ? '✅ Present' : '❌ Missing'}`);
            }
        }

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
