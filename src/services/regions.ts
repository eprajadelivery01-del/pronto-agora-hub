import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type RegionRow = Record<string, any>;
export type CreateRegionInput = Record<string, any>;
export type UpdateRegionInput = Record<string, any>;

export async function fetchRegions(city?: string) {
  const { data, error } = await supabase.from("regions").select("*").order("name");
  if (error) throw error;
  const all = data ?? [];
  if (city) return all.filter((r: any) => r.city === city);
  return all;
}

export async function fetchCitiesWithRegions() {
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .not("name" as any, "is", null);
  
  if (error) throw error;
  
  // Return unique sorted list of cities
  const cities = Array.from(new Set(data.map(r => (r as any).city as string).filter(Boolean))).sort();
  return cities;
}

export async function createRegion(region: CreateRegionInput) {
  const { data, error } = await supabase
    .from("regions")
    .insert(region as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRegion(id: string, updates: UpdateRegionInput) {
  const { data, error } = await supabase
    .from("regions")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRegion(id: string) {
  const { error } = await supabase
    .from("regions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function useRegions(city?: string) {
  return useQuery({
    queryKey: ["regions", city],
    queryFn: () => fetchRegions(city),
  });
}

export function useCitiesWithRegions() {
  return useQuery({
    queryKey: ["cities-with-regions"],
    queryFn: fetchCitiesWithRegions,
  });
}

export function useCreateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRegion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regions"] });
      qc.invalidateQueries({ queryKey: ["cities-with-regions"] });
    },
  });
}

export function useUpdateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRegionInput }) =>
      updateRegion(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regions"] });
      qc.invalidateQueries({ queryKey: ["cities-with-regions"] });
    },
  });
}

export function useDeleteRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regions"] });
      qc.invalidateQueries({ queryKey: ["cities-with-regions"] });
    },
  });
}
