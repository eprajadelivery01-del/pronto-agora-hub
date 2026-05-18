const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://nptkxlrhrlssdsevpgqe.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== Testing profiles SELECT ===");
  const res1 = await supabase.from('profiles').select('id,full_name,avatar_url,phone,status,role').eq('user_id', '5c68f901-d69a-4265-a3bf-ff523088fa7d');
  console.log("profiles error:", JSON.stringify(res1.error, null, 2));
  console.log("profiles data length:", res1.data ? res1.data.length : null);

  console.log("\n=== Testing delivery_drivers SELECT ===");
  const res2 = await supabase.from('delivery_drivers').select('*').limit(5);
  console.log("delivery_drivers error:", JSON.stringify(res2.error, null, 2));

  console.log("\n=== Testing deliveries SELECT ===");
  const res3 = await supabase.from('deliveries').select('*,companies(name,phone),delivery_drivers(id,user_id,full_name,phone,vehicle_type,vehicle_plate)').limit(5);
  console.log("deliveries error:", JSON.stringify(res3.error, null, 2));
}

run();
