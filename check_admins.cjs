const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
let SUPABASE_URL, SUPABASE_KEY;

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) SUPABASE_KEY = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAdmins() {
  const { data: roles } = await supabase.from('user_roles').select('*').eq('role', 'admin');
  console.log("Admins in user_roles:", roles);

  const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'admin');
  console.log("Admins in profiles:", profiles);
  
  const { data: allProfiles } = await supabase.from('profiles').select('*').ilike('full_name', '%davinyn%');
  console.log("Profiles matching 'davinyn':", allProfiles);
}

checkAdmins();
