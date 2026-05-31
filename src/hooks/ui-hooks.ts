import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * useNetworkStatus: Monitora se o usuário está online ou offline
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * useNotifications: Gerencia notificações do sistema
 */
export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    // Escuta por eventos de notificação (pode ser expandido conforme sua tabela de notificações)
    const channel = supabase
      .channel("system-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deliveries", filter: `driver_id=eq.${user.id}` },
        () => {
           // Lógica para disparar um alerta visual
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return { 
    sendNotification: async (userId: string, type: string, payload: any) => {
      console.log(`Notificação enviada para ${userId}: ${type}`, payload);
      // Aqui integraria com OneSignal/Firebase se necessário
    }
  };
}

/**
 * useAddresses: Gerencia endereços do cliente
 */
export function useAddresses() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: async () => {
       const { data, error } = await supabase.from("addresses").select("*").eq("user_id", user?.id);
       if (error) throw error;
       return data;
    },
    enabled: !!user?.id,
  });

  const createAddress = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("addresses").insert({ ...data, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return { ...query, createAddress };
}
