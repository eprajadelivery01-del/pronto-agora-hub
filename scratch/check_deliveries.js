const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

async function inspect() {
  const driverUserId = 'f0d9f0a4-37d7-4182-b452-f0f652ba6377';
  
  // 1. Get driver record
  const { data: driver, error: dErr } = await supabase
    .from('delivery_drivers')
    .select('*')
    .eq('user_id', driverUserId)
    .maybeSingle();
    
  console.log("DRIVER RECORD:", { driver, dErr });
  
  if (driver) {
    // 2. Get active deliveries for this driver
    const { data: activeDeliveries, error: delErr } = await supabase
      .from('deliveries')
      .select('*')
      .eq('driver_id', driver.id);
      
    console.log("\nDELIVERIES FOR DRIVER:", activeDeliveries);
    if (delErr) console.error("Deliveries Error:", delErr);
    
    // 3. Get corresponding orders
    if (activeDeliveries && activeDeliveries.length > 0) {
      const deliveryIds = activeDeliveries.map(d => d.id);
      const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('id, delivery_id, status')
        .in('delivery_id', deliveryIds);
        
      console.log("\nORDERS CORRESPONDING TO DELIVERIES:", orders);
      if (ordErr) console.error("Orders Error:", ordErr);
    }
  }
}

inspect();
