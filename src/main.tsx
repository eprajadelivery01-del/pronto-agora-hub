// Polyfill obrigatório para crypto.randomUUID em WebViews legadas / Android 11 e anteriores
if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (typeof window.crypto.randomUUID !== "function") {
    window.crypto.randomUUID = function () {
      if (typeof window.crypto.getRandomValues === "function") {
        return ("" + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
          (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
        ) as `${string}-${string}-${string}-${string}-${string}`;
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeGlobalErrorHandlers, initializeInlineErrorMonitor, reportErrorToTelegram } from "@/services/logger";
import { silenceConsoleInProduction } from "@/lib/silenceConsole";
import { toast as sonnerToast } from "sonner";

// Console sempre limpo em produção (mantém o envio de erros para o monitoramento)
silenceConsoleInProduction();

initializeGlobalErrorHandlers("Painel Lojista");
initializeInlineErrorMonitor();


window.addEventListener("vite:preloadError", (event) => {
  console.warn("Vite preload error (chunk missing). Reloading page...");
  window.location.reload();
});

// Patch sonner toast.error globally to automatically capture all user-facing errors
const originalError = sonnerToast.error;
sonnerToast.error = function (message: any, options: any) {
  const text = typeof message === "string" ? message : JSON.stringify(message);
  
  if (text.includes("offline")) {
    return originalError.apply(this, arguments as any);
  }

  reportErrorToTelegram({
    error_message: `Alerta para o Usuário: ${text}`,
    stack_trace: `Sonner toast.error exibido na tela do lojista.`,
    url: window.location.href,
    additional_info: {
      isUserFacingAlert: true,
      options: options ? JSON.stringify(options) : ""
    }
  }, "Painel Lojista").catch(() => {});
  
  return originalError.apply(this, arguments as any);
};

createRoot(document.getElementById("root")!).render(<App />);
