import { MapPin, Loader2, ChevronRight, Globe } from "lucide-react";
import { useCitiesWithRegions, useRegions } from "@/services/regions";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CityServiceListProps {
  onSelect?: (cityName: string, coords: [number, number]) => void;
  className?: string;
  variant?: "horizontal" | "vertical";
  selectedCity?: string | null;
}

export function CityServiceList({ onSelect, className, variant = "vertical", selectedCity }: CityServiceListProps) {
  const { data: cities, isLoading } = useCitiesWithRegions();
  const { data: allRegions } = useRegions();

  const handleCityClick = (cityName: string) => {
    // Find a region in this city to get coordinates
    const cityRegions = allRegions?.filter(r => (r as any).city === cityName);
    if (cityRegions && cityRegions.length > 0) {
      const firstRegion = cityRegions[0];
      const geo = firstRegion.geometry as any;
      if (geo?.type === "Polygon" && geo.coordinates?.[0]?.[0]) {
        // Use the first point of the first region as approximate center
        const coords = geo.coordinates[0][0] as [number, number];
        onSelect?.(cityName, coords);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs font-medium uppercase tracking-widest">Carregando Cidades...</span>
      </div>
    );
  }

  if (!cities || cities.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 px-1">
        <Globe className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Cidades de Atendimento</h3>
      </div>
      
      <div className={cn(
        "flex gap-2",
        variant === "horizontal" ? "overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" : "flex-col"
      )}>
        {cities.map((city) => (
          <button
            key={city}
            onClick={() => handleCityClick(city)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all border shrink-0",
              selectedCity === city
                ? "bg-primary/10 border-primary/30 shadow-sm"
                : "bg-card border-border hover:bg-muted hover:border-border/80 shadow-sm"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner",
              selectedCity === city ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1 text-left min-w-0 pr-4">
              <p className="text-sm font-bold text-foreground truncate">{city}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                {allRegions?.filter(r => (r as any).city === city).length || 0} Regiões
              </p>
            </div>
            {variant === "vertical" && (
              <ChevronRight className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                selectedCity === city ? "text-primary translate-x-1" : "text-muted-foreground"
              )} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
