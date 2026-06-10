const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://mqhzlhuaxdntkupnkmdk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaHpsaHVheGRudGt1cG5rbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Mzg2NDQsImV4cCI6MjA5MzMxNDY0NH0.i6v5Fep6_o51nFTtQwHUDzil0OGh5vaLYvAJNQbuSHk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("Fetching all companies...");
  const { data: cos } = await supabase.from('companies').select('id, name, user_id, email, is_active');
  console.log("Companies in DB:", cos);

  console.log("\nFetching active deliveries...");
  const { data: dels, error: dError } = await supabase.from('deliveries')
    .select('id, customer_name, address, company_id, status, created_at, notes, order_id')
    .limit(40);
  console.log("Active deliveries in DB:", dels);
  console.log("dError:", dError);
}

run();
