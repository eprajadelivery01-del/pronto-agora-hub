const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function check() {
  const { data, error } = await supabase.from('deliveries').select('id, status, driver_id, customer_name, address, company_id, city_id').order('created_at', { ascending: false }).limit(20);
  console.log('Todas as entregas:', data?.length);
  console.log(data);
}
check();
