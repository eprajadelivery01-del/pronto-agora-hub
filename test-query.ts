import { supabase } from './src/lib/supabaseClient.ts'; async function test() { const res = await supabase.from('delivery_drivers').select('full_name').limit(1); console.log(res); } test();  
