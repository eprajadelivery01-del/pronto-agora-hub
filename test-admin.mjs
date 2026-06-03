import { supabase } from './src/lib/supabaseClient.js'; async function test() { const res = await supabase.from('user_roles').select('*').eq('role', 'admin'); console.log(res); } test();  
