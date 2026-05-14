
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

async function check() {
  const userId = 'f0d9f0a4-37d7-4182-b452-f0f652ba6377';
  
  // Checking user_roles
  const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  console.log('Roles for user:', roles);
  
  // Checking profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  console.log('Profile for user:', profile);
}

check();
