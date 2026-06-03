import { supabase } from './src/lib/supabaseClient.ts'; async function test() { const res = await supabase.from('customers').select('*').limit(1); console.log(res); } test();  
