require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  await supabaseAdmin.auth.admin.updateUserById('42ff935c-6084-4386-b76f-8ea6759f93c3', {
    password: 'Password123!'
  });
  const { data } = await supabase.auth.signInWithPassword({
    email: 'lu5cxkfghx@ozsaip.com', password: 'Password123!'
  });
  console.log(data.session.access_token);
}
run();
