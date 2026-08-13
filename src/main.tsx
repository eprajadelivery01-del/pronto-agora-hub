import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeGlobalErrorHandlers, reportErrorToTelegram } from "@/services/logger";
import { silenceConsoleInProduction } from "@/lib/silenceConsole";
import { toast as sonnerToast } from "sonner";

// Console sempre limpo em produção (mantém o envio de erros para o monitoramento)
silenceConsoleInProduction();

initializeGlobalErrorHandlers("Painel Lojista");


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
