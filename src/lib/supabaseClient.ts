/**
 * Custom Supabase client pointing to the EXTERNAL project (shared DB).
 * This overrides the auto-generated client which points to the new Cloud project.
 * All app code should import from here: import { supabase } from "@/lib/supabaseClient";
 */
import { createClient } from "@supabase/supabase-js";

const EXTERNAL_URL = "https://nptkxlrhrlssdsevpgqe.supabase.co";
const EXTERNAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs";
const AUTH_STORAGE_KEY = "epj-lojista-auth";
const LEGACY_AUTH_PREFIX = "sb-nptkxlrhrlssdsevpgqe-auth-token";

export const clearSupabaseAuthStorage = () => {
  if (typeof window === "undefined") return;

  const shouldRemove = (key: string) =>
    key === AUTH_STORAGE_KEY ||
    key.startsWith(`${AUTH_STORAGE_KEY}-`) ||
    key === LEGACY_AUTH_PREFIX ||
    key.startsWith(`${LEGACY_AUTH_PREFIX}-`);

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage).forEach((key) => {
      if (shouldRemove(key)) storage.removeItem(key);
    });
  });
};

export const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
  auth: {
    storage: localStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: false,
  },
});

// Handle token refresh errors globally – log out and clean storage
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESH_ERROR' || event === 'SIGNED_OUT') {
    supabase.auth.signOut().then(() => {
      clearSupabaseAuthStorage();
      // Redirect to login page – adjust path if needed
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    });
  }
});

export const resetLocalAuthSession = async () => {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  clearSupabaseAuthStorage();
};
