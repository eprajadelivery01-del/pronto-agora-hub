const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY 
);

async function fix() {
  const { data, error } = await supabase.rpc('get_business_orders_v2', { p_company_id: 'd96dcc95-f348-4975-90ce-fd472d7a0d81' });
  if (error) {
    console.error(error);
    return;
  }
  
  // Encontrar os pedidos problemáticos
  const badOrders = data.filter(o => o.id.toLowerCase().includes('6830e9') || o.id.toLowerCase().includes('7232a951') || o.id.toLowerCase().includes('7a0e93e4') || o.id.toLowerCase().includes('9e36f7fc'));
  
  for(const o of badOrders) {
     console.log('Cancelando:', o.id);
     const { error: updErr } = await supabase.from('orders').update({status: 'cancelled'}).eq('id', o.id);
     if (updErr) console.error('Erro update:', updErr);
     else console.log('Cancelado via client key!');
  }
}
fix();
