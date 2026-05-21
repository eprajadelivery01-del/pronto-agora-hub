import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type DriverWithProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  online?: boolean | null;
  is_online?: boolean | null;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  current_latitude?: number | null;
  current_longitude?: number | null;
  avatar_url?: string | null;
  status?: string | null;
  created_at?: string;
  profiles?: {
    full_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    document?: string | null;
  } | null;
};

export async function fetchDrivers() {
  // 1. Fetch from delivery_drivers (main table)
  const { data: drivers, error: driversError } = await supabase
    .from("delivery_drivers")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (driversError) throw driversError;

  // 2. Fetch from motoboys (legacy/fallback table)
  const { data: legacyDrivers } = await supabase
    .from("motoboys")
    .select("*");

  const userIds = (drivers || []).map(d => d.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, avatar_url, document")
    .in("user_id", userIds);

  // Merge and Flatten delivery_drivers
  const mainDrivers = (drivers || []).map(driver => {
    const profile = profiles?.find(p => p.user_id === driver.user_id);
    return {
      ...driver,
      full_name: profile?.full_name || driver.full_name || "—",
      avatar_url: profile?.avatar_url || driver.avatar_url,
      phone: profile?.phone || driver.phone,
      document: profile?.document || driver.document,
    };
  });

  // Convert legacy motoboys to the same format
  const formattedLegacy = (legacyDrivers || []).map(m => ({
    id: m.id,
    user_id: m.id, // Fallback
    full_name: m.name || "Entregador Legado",
    is_online: m.is_online,
    vehicle_type: "motorcycle", // Default for legacy
    status: "active",
    rating: 5.0,
    created_at: m.created_at
  }));

  // Combine and deduplicate if necessary (though IDs should be unique)
  return [...mainDrivers, ...formattedLegacy] as unknown as DriverWithProfile[];
}

export function useDrivers() {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
  });
}

export function useOnlineDrivers() {
  return useQuery({
    queryKey: ["drivers", "online"],
    queryFn: async () => {
      const { data: drivers, error: driversError } = await supabase
        .from("delivery_drivers")
        .select("*")
        .eq("is_online", true);
      
      if (driversError) throw driversError;
      if (!drivers) return [];

      const userIds = drivers.map(d => d.user_id);
      if (userIds.length === 0) return [];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, avatar_url, document")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Erro ao buscar perfis dos motoristas online:", profilesError);
        return drivers as unknown as DriverWithProfile[];
      }

      return (drivers || []).map(driver => {
        const profile = profiles?.find(p => p.user_id === driver.user_id);
        return {
          ...driver,
          full_name: profile?.full_name || driver.full_name || "—",
          avatar_url: profile?.avatar_url || driver.avatar_url,
          phone: profile?.phone || driver.phone,
          document: profile?.document || driver.document,
        };
      }) as unknown as DriverWithProfile[];
    },
  });
}

export function useToggleDriverOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driverId, isOnline }: { driverId: string; isOnline: boolean }) => {
      const { error } = await supabase
        .from("delivery_drivers")
        .update({ is_online: isOnline } as any)
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useAvailableDeliveries() {
  return useQuery({
    queryKey: ["deliveries", "available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, companies(name)")
        .eq("status", "pending")
        .is("driver_id", null);

      if (error) throw error;
      return data;
    },
  });
}

export function useAcceptDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .update({ 
          driver_id: driverId, 
          status: "accepted" as any,
          accepted_at: new Date().toISOString()
        })
        .eq("id", deliveryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
  });
}
