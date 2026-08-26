const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function check() {
  const { data, error } = await supabase.from('deliveries').select('id, status, driver_id, customer_name, address, company_id, city_id').eq('status', 'pending');
  console.log('Pendentes na tabela deliveries:', data?.length || 0);
  console.log(data);
}
check();
