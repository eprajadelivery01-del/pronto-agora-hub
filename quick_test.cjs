const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'testelojistaultra1@gmail.com',
    password: '12345678.'
  });
  if (error) {
    console.error("Login failed:", error);
    return;
  }
  console.log("Logged in:", data.user.id);
  
  const { data: delivery, error: delErr } = await supabase.from('deliveries').insert({
    company_id: data.user.id,
    customer_name: 'Cliente de Teste',
    address: 'Endereço 123',
    value: 10,
    commission: 2
  }).select().single();
  
  if (delErr) {
    console.error("Delivery insert failed:", delErr);
  } else {
    console.log("Delivery created:", delivery.id);
  }
}
test();
