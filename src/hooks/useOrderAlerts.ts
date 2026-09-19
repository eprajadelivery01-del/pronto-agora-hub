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
    let actionListener: any = null;

    // Solicita todas as permissões no iOS e Android (alert, badge, sound)
    const initPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== "granted" && (permStatus as any).display !== "granted") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === "granted" || (permStatus as any).display === "granted") {
          await PushNotifications.register();
          console.log("[Push iOS/Android] Registrado no serviço de notificações nativas");
        } else {
          console.warn("[Push iOS/Android] Permissões não concedidas pelo usuário:", permStatus);
        }
      } catch (e) {
        console.warn("[Push iOS/Android] Erro ao inicializar push nativo:", e);
      }
    };

    initPush();

    PushNotifications.addListener("registration", async (token) => {
      console.log("[Push Lojista] Token registrado:", token.value);
      localStorage.setItem("@epraja_lojista_push_token", token.value);
      localStorage.setItem("fcm_token", token.value);

      // 1. Salva na empresa (companies.fcm_token)
      try {
        const { error: compErr } = await supabase
          .from("companies")
          .update({ fcm_token: token.value })
          .eq("id", companyId);
        if (compErr) console.error("[Push] Erro ao salvar token em companies:", compErr);
        else console.log("[Push] Token salvo com sucesso na empresa:", companyId);
      } catch (e) {
        console.warn("[Push] Falha ao persistir em companies:", e);
      }

      // 2. Salva no perfil do usuário logado (profiles.fcm_token)
      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({ fcm_token: token.value, updated_at: new Date().toISOString() })
            .eq("id", user.id);
        } catch (e) {
          console.warn("[Push] Falha ao persistir em profiles:", e);
        }
      }

      // 3. Registra na tabela device_tokens com identidade explícita do Lojista
      try {
        await supabase
          .from("device_tokens" as any)
          .upsert(
            {
              token: token.value,
              user_id: user?.id || null,
              platform: Capacitor.getPlatform(),
              app: "lojista",
              bundle_id: "br.com.epraja.lojista",
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "token" }
          );
      } catch (e) {
        console.warn("[Push] Falha ao persistir em device_tokens:", e);
      }

      // 4. Registra via Edge Function send-push (para garantir sincronização no backend)
      try {
        await supabase.functions.invoke("send-push", {
          body: {
            action: "register_token",
            token: token.value,
            userId: user?.id,
            companyId: companyId,
            platform: Capacitor.getPlatform(),
            app: "lojista",
            bundleId: "br.com.epraja.lojista",
          },
        });
      } catch (e) {
        console.warn("[Push] Falha ao chamar edge function register_token:", e);
      }
    }).then(listener => { regListener = listener; });

    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("[Push iOS/Android] Erro no registro de Push:", error);
    }).then(listener => { errListener = listener; });

    // Ouvinte do Push quando o app está aberto/foreground
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const orderId = notification.data?.order_id || notification.data?.orderId || notification.id;
      console.log("[Push Recebido em Foreground]", orderId, notification);

      if (orderId && processedOrders.has(orderId)) {
        console.log("[Push] Pedido já notificado previamente, ignorando duplicata nativa:", orderId);
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

    // Ouvinte de clique na notificação na Central do iPhone/Android quando o app estava fechado ou em background
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[Push Ação/Clique]", action);
      stopLoop();
      const targetRoute = action.notification.data?.route || "/business/orders";
      if (window.location.pathname !== targetRoute) {
        window.location.href = targetRoute;
      }
    }).then(listener => { actionListener = listener; });

    return () => {
      if (regListener) regListener.remove();
      if (errListener) errListener.remove();
      if (pushListener) pushListener.remove();
      if (actionListener) actionListener.remove();
    };
  }, [companyId, user?.id, playAlert, startLoop, stopLoop]);

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
          window.dispatchEvent(new CustomEvent('epraja-order-alert-triggered'));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        async (payload) => {
          qc.invalidateQueries({ queryKey: ["orders-alert-check", companyId] });
          qc.invalidateQueries({ queryKey: ["orders"] });
          window.dispatchEvent(new CustomEvent('epraja-order-alert-triggered'));
          
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
