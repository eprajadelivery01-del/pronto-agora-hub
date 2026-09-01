import { supabase } from "@/lib/supabaseClient";

export interface ErrorPayload {
  error_message: string;
  stack_trace?: string;
  url?: string;
  additional_info?: Record<string, any>;
}

let isReporting = false;
const recentlyReported = new Map<string, number>();
const REPORT_DEDUP_WINDOW_MS = 60_000;

const isExpectedAuthLifecycleError = (message: string) =>
  /pgrst303|jwt expired|invalid jwt|token is expired|invalid refresh token|refresh token not found/i.test(message);

export async function reportErrorToTelegram(payload: ErrorPayload, appName = "Painel Lojista") {
  if (isReporting) return;
  
  // Ignore errors from Lovable preview environments to avoid false alarms
  const currentUrl = payload.url || window.location.href;
  if (currentUrl.includes("lovableproject.com")) {
    return;
  }

  // Ignore specific harmless user-facing errors
  const rawMessage = `${payload.error_message || ""} ${JSON.stringify(payload.additional_info || {})}`;
  const msg = rawMessage.toLowerCase();
  // Expiração/renovação de sessão faz parte do ciclo normal de autenticação.
  // A UI tenta renovar e, se necessário, redireciona ao login; não é incidente sistêmico.
  if (isExpectedAuthLifecycleError(rawMessage)) return;

  if (
    msg.includes("corrida já foi aceita") || 
    msg.includes("senha") || 
    msg.includes("inválida") ||
    msg.includes("credenciais") ||
    msg.includes("offline") ||
    msg.includes("não encontrada") ||
    msg.includes("acesso negado") ||
    msg.includes("exclusivo para entregadores") ||
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network request failed")
  ) {
    return;
  }

  const dedupKey = `${appName}:${payload.error_message}`.slice(0, 1200);
  const now = Date.now();
  const lastReportedAt = recentlyReported.get(dedupKey) ?? 0;
  if (now - lastReportedAt < REPORT_DEDUP_WINDOW_MS) return;
  recentlyReported.set(dedupKey, now);

  for (const [key, timestamp] of recentlyReported) {
    if (now - timestamp > REPORT_DEDUP_WINDOW_MS) recentlyReported.delete(key);
  }
  
  isReporting = true;

  try {
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    
    const requestBody = {
      app_name: appName,
      error_message: payload.error_message,
      stack_trace: payload.stack_trace || new Error().stack || "",
      user_id: user?.id || "Não autenticado",
      user_email: user?.email || "Anônimo",
      url: payload.url || window.location.pathname,
      additional_info: {
        userAgent: navigator.userAgent,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`,
        time: new Date().toISOString(),
        ...payload.additional_info
      }
    };

    // Invoke the Supabase Edge Function
    await supabase.functions.invoke("telegram-logger", {
      body: requestBody
    });
  } catch (err) {
    console.error("Failed to report error to Telegram:", err);
  } finally {
    isReporting = false;
  }
}

/**
 * Reporta um erro exibido inline na UI (fora de toasts/console),
 * para que o monitoramento capture também mensagens renderizadas em componentes.
 */
export function reportUserFacingError(message: string, source = "InlineUI") {
  if (!message || message.length < 4) return;
  reportErrorToTelegram({
    error_message: `Erro exibido na tela: ${message.slice(0, 800)}`,
    stack_trace: `Capturado via ${source}.`,
    url: typeof window !== "undefined" ? window.location.href : "",
    additional_info: { isInlineUserFacingError: true, source }
  }, "Painel Lojista").catch(() => {});
}

const INLINE_ERROR_KEYWORDS = /erro|falha|inválid|não foi possível|indisponív|expirad/i;

/**
 * Observa o DOM e reporta textos de erro renderizados inline
 * (ex: elementos com role="alert" ou classes de erro do design system).
 */
export function initializeInlineErrorMonitor() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;

  const seen = new Set<string>();
  const checkNode = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    const candidates: HTMLElement[] = [];
    if (node.matches('[role="alert"], .text-destructive, [data-error]')) candidates.push(node);
    node.querySelectorAll?.('[role="alert"], [data-error]').forEach((el) => {
      if (el instanceof HTMLElement) candidates.push(el);
    });
    for (const el of candidates) {
      const text = (el.textContent || "").trim();
      if (text.length < 8 || text.length > 1000) continue;
      if (!INLINE_ERROR_KEYWORDS.test(text)) continue;
      const key = text.slice(0, 300);
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > 200) seen.clear();
      reportUserFacingError(text, "InlineErrorMonitor");
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(checkNode);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initializeGlobalErrorHandlers(appName: string) {
  if (typeof window === "undefined") return;

  window.onerror = (message, source, lineno, colno, error) => {
    const errorMsg = String(message);
    if (errorMsg === 'Script error.') return false;

    reportErrorToTelegram({
      error_message: errorMsg,
      stack_trace: error?.stack || `At ${source}:${lineno}:${colno}`,
      url: window.location.href,
      additional_info: { source, lineno, colno }
    }, appName);
    return false;
  };

  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const reasonMsg = reason?.message || String(reason);

    if (isExpectedAuthLifecycleError(reasonMsg)) return;

    reportErrorToTelegram({
      error_message: `Unhandled Rejection: ${reason?.message || reason}`,
      stack_trace: reason?.stack || "No stack trace available",
      url: window.location.href,
      additional_info: {
        reason: typeof reason === "object" ? JSON.stringify(reason) : String(reason)
      }
    }, appName);
  };

  // Intercept programmatic console.error calls (including accessibility radix-ui warnings)
  const originalConsoleError = console.error;
  console.error = function (...args) {
    // Format error message cleanly
    const msg = args.map(a => {
      if (a instanceof Error) return a.message + "\n" + a.stack;
      return typeof a === "object" ? JSON.stringify(a) : String(a);
    }).join(" ");

    // Invoke original console logger
    originalConsoleError.apply(console, args);

    // Skip nested reporting to prevent loops
    if (isReporting || isExpectedAuthLifecycleError(msg)) return;

    reportErrorToTelegram({
      error_message: `[Console Error] ${msg.slice(0, 1000)}`,
      stack_trace: new Error().stack || "Logged via console.error",
      url: window.location.href,
      additional_info: {
        isConsoleError: true
      }
    }, appName).catch(() => {});
  };
}
