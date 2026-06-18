import React, { useEffect, useState, memo } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegionPickerGridProps {
  cityId?: string;
  companyId?: string;
  onRegionSelect?: (fee: number, regionId: string, regionName: string) => void;
  disabled?: boolean;
  initialSelectedId?: string | null;
}

export const RegionPickerGrid = memo(({ cityId, companyId, onRegionSelect, disabled, initialSelectedId }: RegionPickerGridProps) => {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  useEffect(() => {
    const fetchRegions = async () => {
      setLoading(true);
      const { data } = await supabase.from('regions').select('*').order('name');
      const filtered = (data ?? []).filter(
        (r: any) => r.is_active !== false && (!cityId || r.city_id === cityId)
      );
      setRegions(filtered);

      if (companyId) {
        // Fetch custom pricing rules
        const { data: comp } = await supabase.from('companies').select('pricing_table_id, region_id').eq('id', companyId).single();
        if (comp) {
          let tableId = comp.pricing_table_id;
          if (!tableId) {
            const { data: defTable } = await supabase.from('pricing_tables').select('id').eq('is_default', true).maybeSingle();
            if (defTable) tableId = defTable.id;
          }
          if (tableId && comp.region_id) {
            const { data: rules } = await supabase
              .from('pricing_rules')
              .select('*')
              .eq('pricing_table_id', tableId)
              .eq('origin_region_id', comp.region_id);
            if (rules) setPricingRules(rules);
          }
        }
      }

      setLoading(false);
    };
    fetchRegions();
  }, [cityId, companyId]);

  const getRegionFee = (region: any) => {
    const rule = pricingRules.find(r => r.destination_region_id === region.id);
    if (rule) return Number(rule.base_value);
    return Number(region.price ?? region.delivery_fee ?? null);
  };

  const handleSelect = (region: any) => {
    if (disabled) return;
    const fee = getRegionFee(region);
    setSelectedId(region.id);
    onRegionSelect?.(fee, region.id, region.name);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (regions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma região cadastrada para esta cidade.
      </p>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", disabled && "opacity-50 pointer-events-none")}>
      {regions.map((region) => {
        const fee = getRegionFee(region);
        const hasFee = fee != null && !isNaN(fee);
        const isSelected = selectedId === region.id;
        const color = region.color || '#3b82f6';

        return (
          <button
            key={region.id}
            type="button"
            onClick={() => handleSelect(region)}
            disabled={disabled || !hasFee}
            className={cn(
              "relative flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all text-left",
              isSelected
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border bg-card hover:border-primary/30 hover:bg-muted/50",
              !hasFee && "opacity-40 cursor-not-allowed"
            )}
          >
            {isSelected && (
              <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary" />
            )}
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-bold text-foreground leading-tight">
              {region.name}
            </span>
            {hasFee ? (
              <span
                className={cn(
                  "text-sm font-black",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                R$ {fee.toFixed(2).replace('.', ',')}
              </span>
            ) : (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Sem valor
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

RegionPickerGrid.displayName = "RegionPickerGrid";
