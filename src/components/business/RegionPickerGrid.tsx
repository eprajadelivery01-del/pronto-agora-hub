import React, { useEffect, useState, memo } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegionPickerGridProps {
  cityId?: string;
  onRegionSelect?: (fee: number, regionId: string, regionName: string) => void;
  disabled?: boolean;
}

export const RegionPickerGrid = memo(({ cityId, onRegionSelect, disabled }: RegionPickerGridProps) => {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegions = async () => {
      setLoading(true);
      const { data } = await supabase.from('regions').select('*').order('name');
      const filtered = (data ?? []).filter(
        (r: any) => r.is_active !== false && (!cityId || r.city_id === cityId)
      );
      setRegions(filtered);
      setLoading(false);
    };
    fetchRegions();
  }, [cityId]);

  const handleSelect = (region: any) => {
    if (disabled) return;
    const fee = Number(region.delivery_fee ?? region.price ?? 0);
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
        const fee = Number(region.delivery_fee ?? region.price ?? null);
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
                ? "border-destructive bg-destructive/5 shadow-md"
                : "border-border bg-card hover:border-primary/30 hover:bg-muted/50",
              !hasFee && "opacity-40 cursor-not-allowed"
            )}
          >
            {isSelected && (
              <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-destructive" />
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
                  isSelected ? "text-destructive" : "text-foreground"
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
