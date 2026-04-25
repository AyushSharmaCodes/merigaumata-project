require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabase');
async function r() { 
  const {data} = await supabaseAdmin.from('email_notifications').select('*').order('created_at', {ascending: false}).limit(5); 
  console.log(JSON.stringify(data, null, 2)); 
}
r();
