import { supabase } from "@/lib/supabaseClient";

export interface ErrorPayload {
  error_message: string;
  stack_trace?: string;
  url?: string;
  additional_info?: Record<string, any>;
}

let isReporting = false;

export async function reportErrorToTelegram(payload: ErrorPayload, appName = "Painel Lojista") {
  if (isReporting) return;
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

export function initializeGlobalErrorHandlers(appName: string) {
  if (typeof window === "undefined") return;

  window.onerror = (message, source, lineno, colno, error) => {
    const errorMsg = String(message);
    if (errorMsg.includes("Failed to fetch") || errorMsg.includes("refreshAccessToken") || errorMsg.includes("AuthSessionMissingError") || errorMsg.includes("Lock broken") || errorMsg.includes("steal") || errorMsg.includes("offline") || errorMsg.includes("NetworkError")) {
      return false;
    }

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
    
    if (reasonMsg.includes("Failed to fetch") || reasonMsg.includes("refreshAccessToken") || reasonMsg.includes("AuthSessionMissingError") || reasonMsg.includes("Lock broken") || reasonMsg.includes("steal") || reasonMsg.includes("offline") || reasonMsg.includes("NetworkError")) {
      event.preventDefault();
      return;
    }

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

    // Skip nested reporting to prevent loops
    if (isReporting) return;

    // Ignore expected Supabase token refresh network errors
    if (msg.includes("Failed to fetch") || msg.includes("refreshAccessToken") || msg.includes("AuthSessionMissingError") || msg.includes("Lock broken") || msg.includes("steal") || msg.includes("offline") || msg.includes("NetworkError")) {
      return;
    }

    // Invoke original console logger
    originalConsoleError.apply(console, args);

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
