import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type DriverWithProfile = {
  id: string;
  user_id: string;
  vehicle?: string;
  vehicle_type?: string;
  vehicle_plate?: string;
  online?: boolean;
  is_online?: boolean;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  current_latitude?: number | null;
  current_longitude?: number | null;
  license_plate?: string | null;
  commission_rate?: number;
  created_at?: string;
  profiles?: { full_name: string; phone: string | null; avatar_url: string | null } | null;
  [key: string]: any;
};

export async function fetchDrivers() {
  const { data: drivers, error: driversError } = await supabase
    .from("delivery_drivers")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (driversError) throw driversError;
  if (!drivers) return [];

  const userIds = drivers.map(d => d.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, avatar_url")
    .in("user_id", userIds);

  if (profilesError) {
    console.error("Erro ao buscar perfis dos motoristas:", profilesError);
    return drivers as unknown as DriverWithProfile[];
  }

  return drivers.map(driver => ({
    ...driver,
    profiles: profiles?.find(p => p.user_id === driver.user_id) || null
  })) as unknown as DriverWithProfile[];
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
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, avatar_url")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Erro ao buscar perfis dos motoristas online:", profilesError);
        return drivers as unknown as DriverWithProfile[];
      }

      return drivers.map(driver => ({
        ...driver,
        profiles: profiles?.find(p => p.user_id === driver.user_id) || null
      })) as unknown as DriverWithProfile[];
    },
  });
}

export function useToggleDriverOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driverId, isOnline }: { driverId: string; isOnline: boolean }) => {
      const { error } = await supabase
        .from("delivery_drivers")
        .update({ online: isOnline, is_online: isOnline } as any)
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useAvailableDeliveries(regionId?: string) {
  return useQuery({
    queryKey: ["deliveries", "available", regionId],
    queryFn: async () => {
      let query: any = supabase
        .from("deliveries")
        .select("*, companies(name)")
        .eq("status", "pending")
        .is("driver_id", null);
      
      // region_id doesn't exist on deliveries table. Use city_id if applicable.
      if (regionId) {
        // Fallback resilient query
        query = query.or(`city_id.eq.${regionId}`);
      }

      const { data, error } = await query;
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
          status: "accepted",
          accepted_at: new Date().toISOString() as any
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
