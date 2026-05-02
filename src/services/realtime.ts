import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export function useDeliveriesRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    // Fallback para ambientes sem crypto.randomUUID (como HTTP não seguro)
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 11);

    const channel = supabase
      .channel(`deliveries-all-${uuid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => {
          console.log("[Realtime] Mudança em deliveries detectada. Invalidando queries...");
          qc.invalidateQueries({ queryKey: ["deliveries"] });
          qc.invalidateQueries({ queryKey: ["delivery-stats"] });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status da inscrição (deliveries): ${status}`);
      });

    return () => {
      console.log(`[Realtime] Removendo canal: deliveries-all-${uuid}`);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useDriversRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 11);

    const channel = supabase
      .channel(`drivers-all-${uuid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_drivers" },
        () => {
          console.log("[Realtime] Mudança em drivers detectada. Invalidando queries...");
          qc.invalidateQueries({ queryKey: ["drivers"] });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status da inscrição (drivers): ${status}`);
      });

    return () => {
      console.log(`[Realtime] Removendo canal: drivers-all-${uuid}`);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useOrdersRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 11);

    const channel = supabase
      .channel(`orders-all-${uuid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("[Realtime] Mudança em orders detectada. Invalidando queries...");
          qc.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status da inscrição (orders): ${status}`);
      });

    return () => {
      console.log(`[Realtime] Removendo canal: orders-all-${uuid}`);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useAllRealtime() {
  useDeliveriesRealtime();
  useDriversRealtime();
  useOrdersRealtime();
}

/**
 * useAdminRealtime
 * Centralized hook for Admin Panel to monitor everything.
 * Ensures one single channel per table with proper cleanup.
 */
export function useAdminRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    console.log("[Realtime] Iniciando canais administrativos...");

    // Unique ID for this session to identify channels in Supabase logs
    const sessionId = Math.random().toString(36).substring(2, 8);

    const deliverablesChannel = supabase
      .channel(`admin-deliveries-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        (payload) => {
          console.log("[Realtime] Mudança em deliveries:", payload.eventType);
          qc.invalidateQueries({ queryKey: ["deliveries"] });
          qc.invalidateQueries({ queryKey: ["orders"] });
          qc.invalidateQueries({ queryKey: ["delivery-stats"] });
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(`admin-orders-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("[Realtime] Mudança em orders detectada.");
          qc.invalidateQueries({ queryKey: ["orders"] });
          qc.invalidateQueries({ queryKey: ["deliveries"] });
        }
      )
      .subscribe();

    const driversChannel = supabase
      .channel(`admin-drivers-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_drivers" },
        () => {
          console.log("[Realtime] Mudança em motoristas detectada.");
          qc.invalidateQueries({ queryKey: ["drivers"] });
        }
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel(`admin-notifications-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["system-stats"] });
        }
      )
      .subscribe();

    return () => {
      console.log("[Realtime] Encerrando canais administrativos...");
      supabase.removeChannel(deliverablesChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(driversChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [qc]);
}
