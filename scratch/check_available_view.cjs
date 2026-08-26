const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function check() {
  const { data, error } = await supabase.from('available_deliveries').select('*');
  console.log('Available deliveries em view:', data?.length || 0);
  console.log(data);
}
check();
