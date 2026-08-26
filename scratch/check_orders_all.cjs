const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function check() {
  const { data, error } = await supabase.from('orders').select('*');
  console.log('Quantidade de orders:', data?.length);
  
  if (data?.length > 0) {
     console.log('Algumas orders:', data.slice(0, 3));
  }
}
check();
