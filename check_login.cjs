const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

const supabase = createClient(url, key);

async function checkUser() {
  // we can't query auth.users from client without service_role key.
  // wait, the service role key is in nexus_identity?
  // Let me just query public.profiles instead to see if the user exists.
  const { data, error } = await supabase.from('profiles').select('id, user_id, full_name, status').ilike('email', 'testelojistaultra1@gmail.com');
  console.log("Profiles check:", data, error);

  // let's try login
  const { data: sessionData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'testelojistaultra1@gmail.com',
    password: '12345678.'
  });
  console.log("Login check:", sessionData, loginErr);
}
checkUser();
