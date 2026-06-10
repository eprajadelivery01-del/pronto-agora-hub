const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nptkxlrhrlssdsevpgqe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("Fetching profiles...");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('user_id, full_name, role');
  console.log("Profiles in DB:", profiles);
  console.log("pError:", pError);

  console.log("\nFetching user_roles...");
  const { data: roles, error: rError } = await supabase.from('user_roles').select('*');
  console.log("User Roles in DB:", roles);
  console.log("rError:", rError);
}

run();
