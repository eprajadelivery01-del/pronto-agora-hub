
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

async function check() {
  const userId = 'd4a62249-6d21-4c1f-97ed-ee8a6c910423';
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  
  console.log({ profile, roles });
}

check();
