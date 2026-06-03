import { supabase } from './src/lib/supabaseClient.ts'; async function test() { const res = await supabase.from('deliveries').select('payment_method').limit(1); console.log(res); } test();  
