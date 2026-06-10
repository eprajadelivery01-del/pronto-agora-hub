const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', 'express-lane-nexus', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.trim().match(/^([^=]+)="?(.*?)"?$/);
  if (match) { envVars[match[1]] = match[2]; }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env file!");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const migrationSql = fs.readFileSync(path.resolve(__dirname, 'supabase', 'migrations', '20260610144500_apple_account_deletion.sql'), 'utf8');

async function apply() {
  console.log("Applying Apple Account Deletion migration...");
  const { data, error } = await supabaseAdmin.rpc("exec_sql", { query: migrationSql });
  if (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } else {
    console.log("Migration applied successfully!");
  }
}

apply();
