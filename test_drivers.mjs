import { createClient } from '@supabase/supabase-js'; 
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env manually if needed or just rely on --env-file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey); 
supabase.from('delivery_drivers').select('id, full_name, profiles(full_name)').limit(5).then(res => {
  console.log("delivery_drivers", res);
});
supabase.from('profiles').select('id, full_name, role').eq('role', 'driver').limit(5).then(res => {
  console.log("profiles", res);
});
