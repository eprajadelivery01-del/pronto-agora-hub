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

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// Set global de IDs de pedidos já notificados para prevenir qualquer duplicata no dispositivo
const processedOrders = new Set<string>();

export function useOrderAlerts() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const { playAlert, startLoop, stopLoop } = useAudioAlert();
  const { companyId } = useCurrentCompany();

  // Solicita a permissão de notificações do celular/browser ao iniciar
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Configurar registro de Push Notifications se estiver em plataforma nativa (Android/iOS)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !companyId) return;

    let regListener: any = null;
    let errListener: any = null;
    let pushListener: any = null;

    PushNotifications.requestPermissions().then((result) => {
      if (result.receive === "granted") {
        PushNotifications.register().catch(e => 
          console.warn("[Push] Falha ao registrar push (safe):", e)
        );
      }
    }).catch(e => console.warn("[Push] Falha ao pedir permissões de push:", e));

    PushNotifications.addListener("registration", (token) => {
      console.log("[Push] Token FCM registrado:", token.value);
      supabase
        .from("companies")
        .update({ fcm_token: token.value })
        .eq("id", companyId)
        .then(({ error }) => {
          if (error) console.error("[Push] Erro ao persistir fcm_token no banco:", error);
          else console.log("[Push] fcm_token persistido com sucesso para a empresa:", companyId);
        });
    }).then(listener => { regListener = listener; });

    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("[Push] Erro no registro de Push:", error);
    }).then(listener => { errListener = listener; });

    // Ouvinte do FCM Push quando o app está aberto/foreground
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const orderId = notification.data?.order_id || notification.data?.orderId || notification.id;
      console.log("[FCM]", orderId);

      if (orderId && processedOrders.has(orderId)) {
        console.log("[FCM] Pedido já notificado previamente, ignorando duplicata nativa:", orderId);
        return;
      }

      if (orderId) {
        processedOrders.add(orderId);
      }

      playAlert();
      startLoop();

      toast.success(notification.title || "📦 Novo pedido recebido!", {
        description: notification.body || "Acesse o app para aceitar e começar a preparar.",
        duration: 10000
      });
    }).then(listener => { pushListener = listener; });

    return () => {
      if (regListener) regListener.remove();
      if (errListener) errListener.remove();
      if (pushListener) pushListener.remove();
    };
  }, [companyId, playAlert, startLoop]);

  // Admin Alerts (Toca uma vez só quando entra um novo pedido no sistema)
  useEffect(() => {
    if (!user) return;
    if (hasRole("admin")) {
      const channel = supabase
        .channel("admin-order-alerts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            const orderId = payload.new?.id;
            console.log("[REALTIME ADMIN]", orderId);
            
            if (orderId && processedOrders.has(orderId)) return;
            if (orderId) processedOrders.add(orderId);

            playAlert();
            triggerDeviceVibration();
            sendNativeDeviceNotification("📦 NOVO PEDIDO RECEBIDO! 🛎️", {
              body: "Novo pedido recebido no sistema marketplace.",
              tag: `order-${orderId}`,
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

  // Lojista Alerts - POLLING (15s): O polling serve EXCLUSIVAMENTE para garantir que o som da campainha continue tocando até que a loja aceite o pedido. O POLLING NUNCA CRIA NOTIFICAÇÕES VISUAIS DO SISTEMA!
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["orders-alert-check", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!companyId,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const hasPending = pendingOrders.length > 0;

  useEffect(() => {
    if (!companyId) return;

    if (hasPending) {
      pendingOrders.forEach((ord: any) => {
        console.log("[POLLING]", ord.id);
        // O Polling apenas registra o ID se não existir, mas NUNCA chama sendNativeDeviceNotification!
        processedOrders.add(ord.id);
      });
      startLoop();
    } else {
      stopLoop();
    }
  }, [hasPending, pendingOrders, startLoop, stopLoop, companyId]);

  // Ouve inserções e atualizações via Supabase Realtime para tocar som e atualizar a tela instantaneamente
  useEffect(() => {
    if (!companyId) return;

    const channelName = `company-order-alerts-${companyId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const order = payload.new;
          console.log("[REALTIME]", order.id);

          if (order.status === "pending") {
            const alreadyNotified = processedOrders.has(order.id);
            processedOrders.add(order.id);

            // Se ainda não foi notificado e NÃO estiver rodando via FCM nativo em app fechado/background, dispara notificação nativa com tag única
            if (!alreadyNotified) {
              if (!Capacitor.isNativePlatform()) {
                sendNativeDeviceNotification("📦 Novo pedido recebido!", {
                  body: "Acesse o app para aceitar e começar a preparar",
                  tag: `order-${order.id}`,
                });
              }

              toast.success("📦 Novo pedido recebido!", {
                description: "Acesse o app para aceitar e começar a preparar.",
                duration: 10000,
              });
            }
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
