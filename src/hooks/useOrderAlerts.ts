
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ALERT_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export function useOrderAlerts() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND);
    audioRef.current.load();
  }, []);

  const playAlert = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.warn("[OrderAlerts] Audio blocked. User needs to interact.", e);
      });
    }
  };

  useEffect(() => {
    if (!user) return;

    // Listen for new orders if admin
    if (hasRole("admin")) {
      const channel = supabase
        .channel("admin-order-alerts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            console.log("[OrderAlerts] Novo pedido detectado!");
            playAlert();
            toast.success("📦 NOVO PEDIDO RECEBIDO!", {
              description: "Acesse o painel para gerenciar.",
              duration: 10000,
            });
            qc.invalidateQueries({ queryKey: ["orders"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, hasRole, qc]);
}
