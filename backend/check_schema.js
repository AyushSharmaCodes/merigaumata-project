const { supabaseAdmin } = require('./config/supabase');

async function checkSchema() {
    console.log('Checking returns table schema...');
    
    // Check columns
    const { data: columns, error: colError } = await supabaseAdmin.rpc('get_table_columns_info', { t_name: 'returns' });
    
    // Since get_table_columns_info might not exist, use a raw query if possible or just try to select 1
    const { data: sample, error: selectError } = await supabaseAdmin.from('returns').select('*').limit(1);
    
    if (selectError) {
        console.error('Error selecting from returns:', selectError);
    } else {
        console.log('Successfully selected from returns. Columns present:', Object.keys(sample[0] || {}));
    }

    // Try to get explicit column list from information_schema
    const { data: infoCols, error: infoError } = await supabaseAdmin
        .from('returns')
        .select('id')
        .limit(0); // This doesn't help much with other columns

    // Let's use a RPC or a query that PostgREST supports for introspection if available
    // Otherwise, we rely on the error messages.
}

checkSchema();
