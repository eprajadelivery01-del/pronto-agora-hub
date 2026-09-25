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
    autoRefreshToken: true,
  },
});

// Garantir que todos os query builders do Postgrest (select, update, insert, delete, rpc)
// implementem .catch() e .finally() como uma Promise padrão
try {
  const builders = [
    (supabase.from as any)('_dummy_patch_').select(),
    (supabase.from as any)('_dummy_patch_').insert({}),
    (supabase.from as any)('_dummy_patch_').update({}),
    (supabase.from as any)('_dummy_patch_').delete(),
    (supabase.from as any)('_dummy_patch_').upsert({}),
    (supabase as any).rpc('_dummy_patch_')
  ];

  for (const b of builders) {
    let proto = Object.getPrototypeOf(b);
    while (proto && proto !== Object.prototype) {
      if (!proto.catch) {
        proto.catch = function (onRejected: any) {
          return this.then(undefined, onRejected);
        };
      }
      if (!proto.finally) {
        proto.finally = function (onFinally: any) {
          return this.then(
            (val: any) => {
              if (onFinally) onFinally();
              return val;
            },
            (err: any) => {
              if (onFinally) onFinally();
              throw err;
            }
          );
        };
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
} catch (e) {
  // Ignora erros de inicialização de patch
}

// Handle token refresh errors gracefully by NOT logging the user out immediately.
// The user should remain logged in until an explicit API call fails with 401 Unauthorized,
// or until they manually click 'sair'.
supabase.auth.onAuthStateChange((event, session) => {
  if (import.meta.env.DEV) {
    console.log(`[Supabase Auth Event] ${event}`);
  }
});

export const resetLocalAuthSession = async () => {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  clearSupabaseAuthStorage();
};

/** Detecta erros de token expirado/inválido vindos do PostgREST/GoTrue. */
export const isJwtExpiredError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number };
  if (e.status === 401) return true;
  return (
    e.code === "PGRST301" ||
    e.code === "PGRST302" ||
    e.code === "PGRST303" ||
    /jwt|token is expired|invalid jwt|jwt expired|jwt not provided|invalid claim|signature|unauthorized|session_not_found|auth session/i.test(
      e.message ?? ""
    )
  );
};

type SupabaseResultWithError = { error: unknown | null };
let sessionRefreshPromise: Promise<boolean> | null = null;

/**
 * Tenta renovar a sessão atual. Retorna true se conseguiu renovar.
 * Se o refresh token também estiver inválido, limpa a sessão local.
 */
export const refreshSessionSafely = async (): Promise<boolean> => {
  // Polling, foco da janela e Realtime podem detectar o mesmo token expirado
  // simultaneamente. Uma única renovação evita que refresh tokens rotativos sejam
  // consumidos em paralelo e invalidados entre abas/consultas concorrentes.
  if (sessionRefreshPromise) return sessionRefreshPromise;

  sessionRefreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) {
        await resetLocalAuthSession();
        return false;
      }
      return true;
    } catch {
      await resetLocalAuthSession();
      return false;
    } finally {
      sessionRefreshPromise = null;
    }
  })();

  return sessionRefreshPromise;
};

/** Executa uma operação e, somente para JWT expirado, renova uma vez e repete. */
export const withSessionRetry = async <T extends SupabaseResultWithError>(
  operation: () => PromiseLike<T>,
): Promise<T> => {
  let result = await operation();
  if (!isJwtExpiredError(result.error)) return result;

  const refreshed = await refreshSessionSafely();
  if (!refreshed) return result;

  result = await operation();
  return result;
};

