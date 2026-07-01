const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function testEdge() {
  const email = `testcompany_${Date.now()}@example.com`;
  console.log(`Creating company via edge function: ${email}`);
  const res = await supabase.functions.invoke('create-admin', {
    body: {
      email: email,
      password: 'password123',
      fullName: 'Edge Test Company',
      phone: '11999999999',
      document: '12345678901',
      role: 'company',
      companyName: 'Edge Test Company',
      address: 'Edge Test Address',
      regionId: null,
      latitude: null,
      longitude: null
    }
  });
  
  console.log('Result:', res.data || res.error);
}

testEdge();
