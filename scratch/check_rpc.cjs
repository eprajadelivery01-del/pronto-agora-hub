const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function check() {
  const { data, error } = await supabase.rpc('get_business_orders_v2', { p_company_id: 'd96dcc95-f348-4975-90ce-fd472d7a0d81' }).order('created_at', { ascending: false }).limit(20);
  console.log(data);
}
check();
