const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('c:/Users/antho/.gemini/antigravity-ide/scratch/eprajadelivery01-del/pronto-agora-hub/.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*)"/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.from('companies').select('name, is_open, active, is_active, show_in_marketplace, banner_url, logo_url').ilike('name', '%Teste%');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
