const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('../express-lane-nexus/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?(.*?)"?$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'davinynsilva@gmail.com',
    password: 'password123' // Try a default password or we can just fetch the JWT if we had it.
  });
  
  if (authError) {
    console.log('Login failed:', authError.message);
    // Let's create a custom jwt using service role
    return;
  }
  
  const token = auth.session.access_token;
  
  console.log('Logged in!');
  
  const res = await supabase.functions.invoke('create-admin', {
    body: {
      email: 'testcompany123@test.com',
      password: 'password123',
      fullName: 'Test Company',
      phone: '11999999999',
      document: '12345678901',
      role: 'company',
      companyName: 'Test Company',
      address: 'Test Address',
      regionId: null,
      latitude: null,
      longitude: null
    }
  });
  
  console.log(res);
}

run();
