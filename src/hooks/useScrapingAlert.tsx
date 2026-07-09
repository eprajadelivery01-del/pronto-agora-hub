import { useEffect } from "react";
import { reportErrorToTelegram } from "@/services/logger";
import { useAuth } from "@/contexts/AuthContext";

export function useScrapingAlert() {
  const { user } = useAuth();
  
  useEffect(() => {
    const handleCopy = () => {
      const selection = window.getSelection();
      const copiedText = selection ? selection.toString() : "";
      
      if (copiedText.length > 500) {
        reportErrorToTelegram({
          error_message: `🚨 ALERTA DE SCRAPING: Extração de dados massiva detectada.`,
          stack_trace: `Tamanho: ${copiedText.length} caracteres.\nResumo do conteúdo:\n${copiedText.substring(0, 300)}...`,
          url: window.location.href,
          additional_info: {
            textLength: copiedText.length,
            userId: user?.id || "N/A",
            userEmail: user?.email || "N/A",
            isScrapingAlert: true
          }
        }, "Sistema de Segurança");
      }
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, [user]);
}

export function GlobalScrapingListener() {
  useScrapingAlert();
  return null;
}
