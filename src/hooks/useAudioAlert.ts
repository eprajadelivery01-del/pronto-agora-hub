import { useCallback } from "react";

// Singleton instances to be used globally outside React lifecycle
const ALERT_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

let globalAudio: HTMLAudioElement | null = null;
let isUnlocked = false;
let vibrationInterval: any = null;
let activeNotification: Notification | null = null;

if (typeof window !== "undefined") {
  globalAudio = new Audio(ALERT_SOUND_URL);
  globalAudio.load();

  const unlockGlobalAudio = () => {
    if (isUnlocked || !globalAudio) return;
    globalAudio.volume = 0;
    globalAudio.play()
      .then(() => {
        isUnlocked = true;
        window.removeEventListener("click", unlockGlobalAudio);
        window.removeEventListener("touchstart", unlockGlobalAudio);
        window.removeEventListener("keydown", unlockGlobalAudio);
      })
      .catch(() => {});
  };

  window.addEventListener("click", unlockGlobalAudio);
  window.addEventListener("touchstart", unlockGlobalAudio);
  window.addEventListener("keydown", unlockGlobalAudio);
}

/**
 * Dispara vibração física no dispositivo do usuário (Haptics)
 */
export function triggerDeviceVibration(pattern: number[] = [500, 200, 500, 200, 800]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("[Vibration] Vibração não suportada:", e);
    }
  }
}

/**
 * Solicita a permissão do sistema para Notificações Nativas do Aparelho (Central de Notificações do Celular/PC)
 */
export function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((perm) => {
          console.log("[Notification] Permissão de notificação nativa:", perm);
        })
        .catch((e) => {
          console.warn("[Notification] Erro ao solicitar permissão de notificação:", e);
        });
    }
  }
}

/**
 * Envia uma notificação nativa diretamente na barra/central de notificações do sistema operacional do celular ou desktop
 */
export function sendNativeDeviceNotification(
  title: string,
  options?: { body?: string; tag?: string; icon?: string }
) {
  // 1. Aciona vibração no dispositivo
  triggerDeviceVibration();

  // 2. Aciona Notificação Nativa na Barra de Notificações do Aparelho
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        if (activeNotification) {
          activeNotification.close();
        }
        activeNotification = new Notification(title, {
          body: options?.body || "Novo pedido no marketplace! Acesse a gestão para aceitar.",
          icon: options?.icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: options?.tag || "epraja-new-order",
          requireInteraction: true, // Mantém fixa na central de notificações até o usuário clicar
        });

        activeNotification.onclick = () => {
          try {
            window.focus();
          } catch {}
          activeNotification?.close();
          activeNotification = null;
        };
      } catch (e) {
        console.warn("[Notification] Erro ao instanciar notificação nativa:", e);
      }
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          sendNativeDeviceNotification(title, options);
        }
      });
    }
  }
}

export function useAudioAlert() {
  const unlockAudio = useCallback(() => {
    requestNotificationPermission();
    if (globalAudio) {
      globalAudio.volume = 0; // Silent playback to unlock context
      globalAudio.play()
        .then(() => {})
        .catch((e) => {
          if (import.meta.env.DEV) console.warn("[AudioAlert] Falha ao destravar áudio:", e);
        });
    }
  }, []);

  const playAlert = useCallback(() => {
    if (globalAudio) {
      globalAudio.currentTime = 0;
      globalAudio.volume = 1.0;
      globalAudio.play().catch((e) => {
        console.warn("[AudioAlert] Falha ao tocar alerta sonoro:", e);
      });
    }
    triggerDeviceVibration();
  }, []);

  const startLoop = useCallback(() => {
    if (globalAudio) {
      globalAudio.loop = true;
      globalAudio.volume = 1.0;
      globalAudio.play().catch((e) => {
        console.warn("[AudioAlert] Falha ao tocar alerta sonoro em loop:", e);
      });
    }

    // Inicia repetição de vibração no celular enquanto o pedido estritamente pendente persistir
    if (!vibrationInterval) {
      triggerDeviceVibration();
      vibrationInterval = setInterval(() => {
        triggerDeviceVibration();
      }, 3500);
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.currentTime = 0;
      globalAudio.loop = false;
    }

    if (vibrationInterval) {
      clearInterval(vibrationInterval);
      vibrationInterval = null;
    }

    if (activeNotification) {
      activeNotification.close();
      activeNotification = null;
    }
  }, []);

  return { unlockAudio, playAlert, startLoop, stopLoop };
}
