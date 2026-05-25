
import React, { useState, useEffect } from "react";
import { Volume2, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useAudioAlert } from "@/hooks/useAudioAlert";

export function SoundEnabler() {
  const [isVisible, setIsVisible] = useState(false);
  const { unlockAudio } = useAudioAlert();

  useEffect(() => {
    // Check if we already have interaction in this session
    const soundEnabled = sessionStorage.getItem("epj_sound_enabled");
    if (!soundEnabled) {
      // Show after a short delay
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const enableSound = () => {
    unlockAudio();
    sessionStorage.setItem("epj_sound_enabled", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-foreground text-background p-5 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0 animate-bounce">
          <Volume2 className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black leading-tight">Ativar Alertas Sonoros?</p>
          <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest mt-1">Para ouvir novos pedidos e mensagens.</p>
        </div>
        <Button 
          onClick={enableSound}
          className="rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-[10px] uppercase tracking-widest h-10 px-6"
        >
          Ativar
        </Button>
        <button onClick={() => setIsVisible(false)} className="p-2 opacity-50 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
