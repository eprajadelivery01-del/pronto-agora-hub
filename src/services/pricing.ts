import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface PricingTable {
  id: string;
  name: string;
  is_default: boolean;
}

export interface PricingRule {
  id: string;
  pricing_table_id: string;
  origin_region_id: string;
  destination_region_id: string;
  base_value: number;
  return_value: number;
}

// Hooks for Pricing Tables
export function usePricingTables() {
  return useQuery({
    queryKey: ["pricing_tables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_tables").select("*").order("name");
      if (error) throw error;
      return data as PricingTable[];
    },
  });
}

export function useCreatePricingTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (table: Omit<PricingTable, "id">) => {
      const { data, error } = await supabase.from("pricing_tables").insert(table).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pricing_tables"] }),
  });
}

export function useUpdatePricingTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PricingTable> & { id: string }) => {
      const { error } = await supabase.from("pricing_tables").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pricing_tables"] }),
  });
}

export function useDeletePricingTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pricing_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pricing_tables"] }),
  });
}

// Hooks for Pricing Rules
export function usePricingRules(tableId: string | null) {
  return useQuery({
    queryKey: ["pricing_rules", tableId],
    queryFn: async () => {
      if (!tableId) return [];
      const { data, error } = await supabase.from("pricing_rules").select("*").eq("pricing_table_id", tableId);
      if (error) throw error;
      return data as PricingRule[];
    },
    enabled: !!tableId,
  });
}

export function useUpsertPricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<PricingRule, "id"> & { id?: string }) => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .upsert(rule, { onConflict: "pricing_table_id,origin_region_id,destination_region_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pricing_rules", variables.pricing_table_id] });
    },
  });
}
