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

const migrationSql = fs.readFileSync(path.resolve('./supabase/migrations/20260610113000_fix_driver_delivery_acceptance.sql'), 'utf8');

async function apply() {
  console.log("Applying migration...");
  const { data, error } = await supabaseAdmin.rpc("exec_sql", { query: migrationSql });
  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log("Migration applied successfully!");
  }
}

apply();
