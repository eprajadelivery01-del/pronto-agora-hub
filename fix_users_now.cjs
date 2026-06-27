const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('../express-lane-nexus/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?(.*?)"?$/);
  if (match) { envVars[match[1]] = match[2]; }
});

const supabaseAdmin = createClient(envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log("Fixing Andressa...");
  const { data: c1, error: e1 } = await supabaseAdmin.from('user_roles').upsert([
    { user_id: 'e6eddfb8-e947-4d09-8aa7-8e3fd8717804', role: 'company' }
  ], { onConflict: 'user_id,role' });
  if(e1) console.error("Err Andressa", e1);
  else console.log("Andressa fixed!");

  console.log("Fixing Tiago...");
  const { data: c2, error: e2 } = await supabaseAdmin.from('user_roles').upsert([
    { user_id: '11b1c53e-bf77-4761-bf88-861af5ff3ac3', role: 'driver' }
  ], { onConflict: 'user_id,role' });
  if(e2) console.error("Err Tiago", e2);
  else console.log("Tiago fixed!");
}

fix();
