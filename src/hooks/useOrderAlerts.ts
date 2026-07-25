import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useAudioAlert,
  requestNotificationPermission,
  sendNativeDeviceNotification,
  triggerDeviceVibration
} from "@/hooks/useAudioAlert";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";

export function useOrderAlerts() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const { playAlert, startLoop, stopLoop } = useAudioAlert();
  const { companyId } = useCurrentCompany();

  // Solicita a permissão de notificações do celular/browser ao iniciar
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Admin Alerts (Toca uma vez só quando entra algo)
  useEffect(() => {
    if (!user) return;
    if (hasRole("admin")) {
      const channel = supabase
        .channel("admin-order-alerts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            console.log("[OrderAlerts] Novo pedido detectado (Admin)!");
            playAlert();
            triggerDeviceVibration();
            sendNativeDeviceNotification("📦 NOVO PEDIDO RECEBIDO! 🛎️", {
              body: "Novo pedido recebido no sistema marketplace.",
              tag: `admin-order-${payload.new?.id}`,
            });
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
  }, [user, hasRole, qc, playAlert]);

  // Lojista Alerts (Loop contínuo com som, vibração e notificação se houver pedido pendente)
  const { data: hasPending = false } = useQuery({
    queryKey: ["orders-alert-check", companyId],
    queryFn: async () => {
      if (!companyId) return false;
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "pending");
      return (count || 0) > 0;
    },
    enabled: !!companyId,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!companyId) return;
    if (hasPending) {
      sendNativeDeviceNotification("Chegou um novo pedido!", {
        body: "Acesse o app para aceitar e começar a preparar",
        tag: `company-pending-${companyId}`,
      });
      startLoop();
    } else {
      stopLoop();
    }
  }, [hasPending, startLoop, stopLoop, companyId]);

  // Ouve inserções e atualizações via Realtime para atualizar instantaneamente o estado
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`company-order-alerts-${companyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        (payload) => {
          if (payload.new.status === "pending") {
            sendNativeDeviceNotification("Chegou um novo pedido!", {
              body: "Acesse o app para aceitar e começar a preparar",
              tag: `order-${payload.new.id}`,
            });
            toast.success("Chegou um novo pedido!", {
              description: "Acesse o app para aceitar e começar a preparar.",
              duration: 10000,
            });
            startLoop();
          }
          qc.invalidateQueries({ queryKey: ["orders-alert-check", companyId] });
          qc.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        async (payload) => {
          qc.invalidateQueries({ queryKey: ["orders-alert-check", companyId] });
          qc.invalidateQueries({ queryKey: ["orders"] });
          
          if (payload.new.status !== "pending") {
            const { count } = await supabase
              .from("orders")
              .select("*", { count: "exact", head: true })
              .eq("company_id", companyId)
              .eq("status", "pending");
            if ((count || 0) === 0) {
              stopLoop();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc, startLoop, stopLoop]);
}
