require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('deliveries')
    .select('id, created_at, customer_name, value')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(data || error);
}
run();
