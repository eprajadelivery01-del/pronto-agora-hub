const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function check() {
  const { data, error } = await supabase.from('deliveries').select('*');
  console.log('Quantidade de entregas:', data?.length);
  
  if (data?.length > 0) {
     console.log('Algumas entregas:', data.slice(0, 3));
  }
}
check();
