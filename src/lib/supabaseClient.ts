/**
 * Custom Supabase client pointing to the EXTERNAL project (shared DB).
 * This overrides the auto-generated client which points to the new Cloud project.
 * All app code should import from here: import { supabase } from "@/lib/supabaseClient";
 */
import { createClient } from "@supabase/supabase-js";

const EXTERNAL_URL = "https://mqhzlhuaxdntkupnkmdk.supabase.co";
const EXTERNAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaHpsaHVheGRudGt1cG5rbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Mzg2NDQsImV4cCI6MjA5MzMxNDY0NH0.i6v5Fep6_o51nFTtQwHUDzil0OGh5vaLYvAJNQbuSHk";

export const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
