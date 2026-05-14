
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

// We need the service role key to delete users, but I don't have it.
// HOWEVER, I can try to delete from the public tables and hope for the best, 
// OR I can just rename the email of the existing user so they can register again with the same email.
// Wait! I can't update auth.users with the anon key.

// BUT! I can update the user_roles table manually if I have permissions? No.

// I'll try to find a way to delete or fix it.
// Actually, I'll tell the user I can't delete them without the admin key, 
// BUT they can register with a DIFFERENT email (like testemoto2@gmail.com) 
// to prove it works now.

async function check() {
  const userId = 'd4a62249-6d21-4c1f-97ed-ee8a6c910423';
  const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', userId);
  console.log('Roles for user:', data);
}

check();
