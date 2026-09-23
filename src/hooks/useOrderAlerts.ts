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
import { FirebaseMessaging } from "@capacitor-firebase/messaging";

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
    if (!Capacitor.isNativePlatform()) return;

    let regListener: any = null;
    let errListener: any = null;
    let pushListener: any = null;
    let actionListener: any = null;

    const syncToken = async (tokenValue: string) => {
      if (!tokenValue) return;

      const masked = tokenValue.length > 12 
        ? `${tokenValue.slice(0, 8)}...${tokenValue.slice(-4)}` 
        : tokenValue;
      console.log("[FCM][LOJISTA] registration recebido:", masked);

      localStorage.setItem("@epraja_lojista_push_token", tokenValue);
      localStorage.setItem("fcm_token", tokenValue);

      if (user?.id) {
        console.log("[FCM][LOJISTA] user_id encontrado:", user.id);
      }

      const app = "lojista";
      const bundle_id = "br.com.epraja.lojista";
      const platform = Capacitor.getPlatform();

      // 1. Registra diretamente na tabela device_tokens
      console.log("[FCM][LOJISTA] salvando device_tokens");
      try {
        const { error: devErr } = await supabase
          .from("device_tokens" as any)
          .upsert(
            {
              token: tokenValue,
              user_id: user?.id || null,
              platform,
              app,
              bundle_id,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "token" }
          );

        if (devErr) {
          console.warn("[FCM][LOJISTA] aviso ao salvar device_tokens:", devErr.message);
        } else {
          console.log("[FCM][LOJISTA] device_tokens salvo com sucesso");
        }
      } catch (e: any) {
        console.warn("[FCM][LOJISTA] aviso ao salvar device_tokens:", e?.message || e);
      }

      // 2. Salva na empresa (companies.fcm_token) se houver companyId
      if (companyId) {
        try {
          const { error: compErr } = await supabase
            .from("companies")
            .update({ fcm_token: tokenValue })
            .eq("id", companyId);
          if (compErr) console.error("[Push] Erro ao salvar token em companies:", compErr.message);
          else console.log("[Push] Token salvo com sucesso na empresa:", companyId);
        } catch (e) {
          console.warn("[Push] Falha ao persistir em companies:", e);
        }
      }

      // 3. Salva no perfil do usuário logado (profiles.fcm_token)
      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({ fcm_token: tokenValue, updated_at: new Date().toISOString() })
            .eq("id", user.id);
        } catch (e) {
          console.warn("[Push] Falha ao persistir em profiles:", e);
        }
      }

      // 4. Registra via Edge Function send-push (sincronização no backend com service role)
      try {
        await supabase.functions.invoke("send-push", {
          body: {
            action: "register_token",
            token: tokenValue,
            userId: user?.id,
            companyId: companyId || undefined,
            platform,
            app,
            bundleId: bundle_id,
          },
        });
      } catch (e) {
        console.warn("[Push] Falha ao chamar edge function register_token:", e);
      }
    };

    // 1. Registra ouvintes do FirebaseMessaging (FCM)
    let isRegistering = false;
    const listeners: any[] = [];

    const setupPush = async () => {
      if (isRegistering) return;
      isRegistering = true;

      try {
        const tokenListener = await FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
          if (token) {
            console.log("[FCM][LOJISTA] tokenReceived:", token.slice(0, 12));
            syncToken(token);
          }
        });
        listeners.push(tokenListener);

        const notifListener = await FirebaseMessaging.addListener("notificationReceived", ({ notification }) => {
          const notifData = (notification.data ?? {}) as Record<string, any>;
          const orderId = notifData.order_id || notifData.orderId || notification.id;
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
        });
        listeners.push(notifListener);

        const actionListener = await FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => {
          console.log("[Push Ação/Clique]", notification);
          stopLoop();
          const targetRoute = ((notification.data ?? {}) as Record<string, any>).route || "/business/orders";
          if (window.location.pathname !== targetRoute) {
            window.location.href = targetRoute;
          }
        });
        listeners.push(actionListener);

        // Cria canal para Android com som oficial e prioridade máxima
        if (Capacitor.getPlatform() === "android") {
          await FirebaseMessaging.createChannel({
            id: "lojista_orders_v2",
            name: "Novos Pedidos do Lojista",
            description: "Alertas sonoros para novos pedidos recebidos na loja",
            importance: 5,
            visibility: 1,
            sound: "notification_sound",
            vibration: true,
          }).catch(() => {});
        }

        // Solicita permissões via FirebaseMessaging
        let permStatus = await FirebaseMessaging.checkPermissions();
        if (permStatus.receive !== "granted") {
          permStatus = await FirebaseMessaging.requestPermissions();
        }

        if (permStatus.receive === "granted") {
          // Obtém o token FCM oficial do Firebase
          try {
            const { token } = await FirebaseMessaging.getToken();
            if (token) {
              console.log("[FCM][LOJISTA] Token obtido via getToken:", token.slice(0, 12));
              syncToken(token);
            }
          } catch (errToken: any) {
            console.warn("[FCM][LOJISTA] Aviso ao obter token:", errToken?.message || errToken);
          }
        } else {
          console.warn("[FCM][LOJISTA] Permissão de notificação negada pelo usuário.");
        }
      } catch (errInit: any) {
        console.warn("[FCM][LOJISTA] Erro ao inicializar notificações:", errInit?.message || errInit);
      } finally {
        isRegistering = false;
      }
    };

    // Sincroniza token em cache se já existir
    const cachedToken = localStorage.getItem("@epraja_lojista_push_token") || localStorage.getItem("fcm_token");
    if (cachedToken) {
      syncToken(cachedToken);
    }

    setupPush();

    return () => {
      listeners.forEach(l => {
        try { l.remove(); } catch {}
      });
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
