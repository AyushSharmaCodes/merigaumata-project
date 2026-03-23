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

async function applyMigration() {
    try {
        console.log('📄 Reading migration file...');
        const migrationPath = path.join(__dirname, 'migrations', '20260219_update_invoice_status_enum.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Executing migration...');

        // Split SQL into statements and execute them individually because some environments don't support multi-statement execution via RPC
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            const { error: execError } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

            if (execError) {
                // Try fallback 'exec' if 'exec_sql' fails
                const { error: fallbackError } = await supabase.rpc('exec', { sql: statement + ';' });
                if (fallbackError) {
                    // Specific check for "already exists" errors which are fine
                    if (fallbackError.message.includes('already exists') || fallbackError.message.includes('duplicate')) {
                        console.log('✅ Statement skipped (already applied/exists)');
                        continue;
                    }
                    console.error('❌ Error executing statement:', fallbackError);
                    throw fallbackError;
                }
            }
        }

        console.log('✅ Migration executed successfully!');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

applyMigration();
