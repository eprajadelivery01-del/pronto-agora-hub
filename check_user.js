
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

async function check() {
  const userId = '1330384d-3241-4405-ab7d-acf1cca5717e';
  
  const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const { data: roles, error: rErr } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  
  console.log("For user ID:", userId);
  console.log({ profile, roles, pErr, rErr });

  console.log("\nRecent profiles:");
  const { data: recentProfiles } = await supabase.from('profiles').select('*').limit(20);
  console.log(recentProfiles);
}

check();
