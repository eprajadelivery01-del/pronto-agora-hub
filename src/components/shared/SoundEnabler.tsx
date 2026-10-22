import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioAlert, requestNotificationPermission, isAudioUnlocked } from "@/hooks/useAudioAlert";

export function SoundEnabler() {
  const [isBlocked, setIsBlocked] = useState(false);
  const [unlocked, setUnlocked] = useState(() => (typeof window !== "undefined" ? isAudioUnlocked() : false));
  const [dismissed, setDismissed] = useState(false);
  const [testPlaying, setTestPlaying] = useState(false);
  const { unlockAudio, playAlert } = useAudioAlert();

  useEffect(() => {
    const handleBlocked = () => {
      setIsBlocked(true);
      setUnlocked(false);
      setDismissed(false); // Sempre reabre se o som foi bloqueado
    };

    const handleUnlocked = () => {
      setIsBlocked(false);
      setUnlocked(true);
    };

    window.addEventListener("epraja-audio-blocked", handleBlocked);
    window.addEventListener("epraja-audio-unlocked", handleUnlocked);

    // Se já estiver destravado, atualiza
    if (isAudioUnlocked()) {
      setUnlocked(true);
    }

    return () => {
      window.removeEventListener("epraja-audio-blocked", handleBlocked);
      window.removeEventListener("epraja-audio-unlocked", handleUnlocked);
    };
  }, []);

  const enableSound = () => {
    unlockAudio();
    requestNotificationPermission();
    setUnlocked(true);
    setIsBlocked(false);
  };

  const handleTestSound = () => {
    enableSound();
    playAlert();
    setTestPlaying(true);
    setTimeout(() => setTestPlaying(false), 2000);
  };

  // Se já foi desbloqueado e não está bloqueado, ou usuário dispensou (sem bloqueio ativo)
  if ((unlocked && !isBlocked) || (dismissed && !isBlocked)) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-lg animate-in slide-in-from-bottom-6 duration-300">
      <div
        className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md transition-all ${
          isBlocked
            ? "bg-red-600 text-white border-red-400 animate-pulse"
            : "bg-foreground text-background border-border"
        }`}
      >
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isBlocked ? "bg-white text-red-600" : "bg-primary text-white"
          }`}
        >
          {isBlocked ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6 animate-bounce" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-black leading-tight">
            {isBlocked ? "Som bloqueado pelo navegador!" : "Ativar Alertas Sonoros?"}
          </p>
          <p
            className={`text-[11px] font-medium leading-tight mt-0.5 ${
              isBlocked ? "text-white/90 font-bold" : "text-muted-foreground"
            }`}
          >
            {isBlocked
              ? "Clique para liberar o som dos novos pedidos."
              : "Clique para garantir o som da campainha e mensagens."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={enableSound}
            size="sm"
            className={`font-black text-xs uppercase tracking-wider h-9 px-3 sm:px-4 rounded-xl shadow-md ${
              isBlocked
                ? "bg-white text-red-600 hover:bg-white/90"
                : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            {isBlocked ? "Liberar Som" : "Ativar"}
          </Button>
          <Button
            onClick={handleTestSound}
            variant="outline"
            size="sm"
            className={`text-xs font-bold h-9 px-2 sm:px-3 rounded-xl border ${
              isBlocked
                ? "border-white/50 text-white hover:bg-white/10"
                : "border-border text-foreground hover:bg-muted"
            }`}
            title="Testar som da campainha"
          >
            {testPlaying ? "Tocando..." : "Testar"}
          </Button>
          {!isBlocked && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 opacity-50 hover:opacity-100 transition-opacity ml-1"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
