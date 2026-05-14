
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

async function check() {
  const email = 'testemoto1@gmail.com';
  
  // We can't search auth.users with anon key, but we can search profiles if they exist
  const { data: profile } = await supabase.from('profiles').select('*').limit(5).order('created_at', { ascending: false });
  console.log('Recent profiles:', profile);
  
  const { data: roles } = await supabase.from('user_roles').select('*, profiles(full_name)').limit(5).order('id', { ascending: false });
  console.log('Recent roles:', roles);
}

check();
