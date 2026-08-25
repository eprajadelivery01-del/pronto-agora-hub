import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Singleton instances to be used globally outside React lifecycle
const ALERT_SOUND_URL = "/notification_sound.mp3";

let globalAudio: HTMLAudioElement | null = null;
let isUnlocked = false;
let vibrationInterval: any = null;
let activeNotification: Notification | null = null;

if (typeof window !== "undefined") {
  globalAudio = new Audio();
  globalAudio.src = ALERT_SOUND_URL + "?v=" + Date.now();
  globalAudio.load();

  let isUnlocking = false;
  const unlockGlobalAudio = () => {
    if (isUnlocked || isUnlocking || !globalAudio) return;
    isUnlocking = true;
    globalAudio.volume = 0;
    globalAudio.play()
      .then(() => {
        isUnlocked = true;
        isUnlocking = false;
        window.removeEventListener("click", unlockGlobalAudio);
        window.removeEventListener("touchstart", unlockGlobalAudio);
        window.removeEventListener("keydown", unlockGlobalAudio);
      })
      .catch(() => {
        isUnlocking = false;
      });
  };

  window.addEventListener("click", unlockGlobalAudio);
  window.addEventListener("touchstart", unlockGlobalAudio);
  window.addEventListener("keydown", unlockGlobalAudio);
}

/**
 * Dispara vibração física no dispositivo do usuário (Haptics)
 */
export function triggerDeviceVibration(pattern: number[] = [500, 200, 500, 200, 800]) {
  // Apenas vibra se estiver rodando nativo ou se o usuário já interagiu para destravar áudio/vibração,
  // evitando logs de intervenção do Chrome ("Intervention: Blocked call to navigator.vibrate...") em iframes (Lovable)
  const canVibrate = Capacitor.isNativePlatform() || isUnlocked;
  if (canVibrate && typeof navigator !== "undefined" && "vibrate" in navigator) {
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
  if (Capacitor.isNativePlatform()) {
    LocalNotifications.requestPermissions().then((res) => {
      if (res.display === "granted") {
        LocalNotifications.deleteChannel({ id: "default" }).catch(() => {});
        LocalNotifications.createChannel({
          id: "lojista_orders_v2",
          name: "Notificações do Lojista",
          description: "Avisos de novos pedidos e mensagens dos clientes",
          importance: 5,
          visibility: 1,
          vibration: true,
          sound: "notification_sound.mp3",
        }).catch(() => {});
      }
    }).catch(() => {});
  }
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

  // 2. Aciona Notificação Nativa do Celular (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      LocalNotifications.schedule({
        notifications: [
          {
            title: title || "Chegou um novo pedido!",
            body: options?.body || "Acesse o app para aceitar e começar a preparar",
            id: Math.floor(Math.random() * 100000),
            channelId: "lojista_orders_v2",
            sound: "notification_sound.mp3",
            extra: {
              tag: options?.tag || "epraja-new-order"
            }
          }
        ]
      }).catch((e) => {
        console.warn("[LocalNotifications] Erro ao agendar notificação nativa:", e);
      });
    } catch (e) {
      console.warn("[LocalNotifications] Erro nativo:", e);
    }
  }

  // 3. Aciona Notificação Nativa do Navegador (Desktop / PWA)
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        if (activeNotification) {
          activeNotification.close();
        }
        activeNotification = new Notification(title, {
          body: options?.body || "Acesse o app para aceitar e começar a preparar",
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
    window.dispatchEvent(new CustomEvent('epraja-order-alert-triggered'));
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
    window.dispatchEvent(new CustomEvent('epraja-order-alert-triggered'));
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
