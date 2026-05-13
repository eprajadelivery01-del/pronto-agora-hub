/**
 * Custom Supabase client pointing to the EXTERNAL project (shared DB).
 * This overrides the auto-generated client which points to the new Cloud project.
 * All app code should import from here: import { supabase } from "@/lib/supabaseClient";
 */
import { createClient } from "@supabase/supabase-js";

const EXTERNAL_URL = "https://nptkxlrhrlssdsevpgqe.supabase.co";
const EXTERNAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs";

export const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
