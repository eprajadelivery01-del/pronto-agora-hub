
import { supabase } from './src/lib/supabaseClient';

async function checkTable() {
  const { data, error } = await supabase.from('coupon_products').select('*').limit(1);
  if (error) {
    console.error('Table coupon_products does not exist or error:', error.message);
  } else {
    console.log('Table coupon_products exists!');
  }
}

checkTable();
