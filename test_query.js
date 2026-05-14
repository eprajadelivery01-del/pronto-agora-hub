const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://nptkxlrhrlssdsevpgqe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs');
async function run() {
  const { data, error } = await supabase.from('conversations').select('*, messages(content, created_at)').limit(1);
  console.log(error);
}
run();
