import { useCallback } from "react";

// Singleton instances to be used globally outside React lifecycle
// This guarantees that the exact same Audio object unlocked by user interaction is the one we play later
const ALERT_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

let globalAudio: HTMLAudioElement | null = null;
let isUnlocked = false;

if (typeof window !== "undefined") {
  globalAudio = new Audio(ALERT_SOUND_URL);
  globalAudio.load();

  const unlockGlobalAudio = () => {
    if (isUnlocked || !globalAudio) return;
    globalAudio.volume = 0;
    globalAudio.play()
      .then(() => {
        isUnlocked = true;
        window.removeEventListener('click', unlockGlobalAudio);
        window.removeEventListener('touchstart', unlockGlobalAudio);
        window.removeEventListener('keydown', unlockGlobalAudio);
      })
      .catch(() => {
        // browser limitou
      });
  };

  window.addEventListener('click', unlockGlobalAudio);
  window.addEventListener('touchstart', unlockGlobalAudio);
  window.addEventListener('keydown', unlockGlobalAudio);
}

export function useAudioAlert() {
  const unlockAudio = useCallback(() => {
    if (globalAudio) {
      globalAudio.volume = 0; // Silent playback to unlock context
      globalAudio.play()
        .then(() => {
          // audio unlocked silently
        })
        .catch((e) => {
          if (import.meta.env.DEV) console.warn("[AudioAlert] Falha ao destravar áudio:", e);
        });
    }
  }, []);

  const playAlert = useCallback(() => {
    if (globalAudio) {
      globalAudio.currentTime = 0;
      globalAudio.volume = 1.0;
      globalAudio.play().catch(e => {
        console.warn("[AudioAlert] Falha ao tocar alerta sonoro. O usuário interagiu com a página?", e);
      });
    }
    
    // Backup: Vibration API if available
    if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  const startLoop = useCallback(() => {
    if (globalAudio) {
      globalAudio.loop = true;
      globalAudio.volume = 1.0;
      globalAudio.play().catch(e => {
        console.warn("[AudioAlert] Falha ao tocar alerta sonoro.", e);
      });
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.currentTime = 0;
      globalAudio.loop = false;
    }
  }, []);

  return { unlockAudio, playAlert, startLoop, stopLoop };
}
