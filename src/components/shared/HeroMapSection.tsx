import { MapPin, Search, Navigation, Maximize2 } from "lucide-react";
import { useRegions } from "@/services/regions";
import { useCity } from "@/contexts/CityContext";
import { useNavigate } from "react-router-dom";
import { UnifiedMap } from "./UnifiedMap";

interface HeroMapSectionProps {
  title?: string;
  subtitle?: string;
}

export function HeroMapSection({ 
  title = "Sua entrega no radar, em tempo real", 
  subtitle = "Acompanhe entregadores e regiões atendidas com transparência total."
}: HeroMapSectionProps) {
  const { selectedCity } = useCity();
  const { data: regions } = useRegions(selectedCity || undefined);
  const navigate = useNavigate();

  return (
    <section 
      className="relative w-full h-[350px] md:h-[450px] lg:h-[500px] overflow-hidden bg-background border-b border-border transition-all"
    >
      {/* Background Interactive Map */}
      <div className="absolute inset-0 z-0 opacity-40 dark:opacity-30 grayscale-[0.2] contrast-[1.1]">
        <UnifiedMap regions={regions ?? []} interactive={true} />
      </div>

      {/* Glassmorphism Overlays */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-background/40 via-transparent to-background" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-background via-background/20 to-transparent" />

      {/* Content Overlay */}
      <div className="relative z-20 h-full w-full px-6 flex flex-col justify-center items-start">
        <div className="max-w-2xl animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Serviço Ativo e Sincronizado</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-display font-black text-foreground leading-[1.1] mb-6 tracking-tight">
            {title}
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground/80 font-medium mb-10 max-w-lg leading-relaxed">
            {subtitle}
          </p>

          <div className="flex flex-wrap gap-4 pointer-events-auto">
            <button 
              onClick={() => navigate("/admin/map")}
              className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 group"
            >
              <Search className="h-5 w-5 group-hover:rotate-12 transition-transform" />
              Explorar Estabelecimentos
            </button>
            
            <button 
              onClick={() => navigate("/admin/map")}
              className="px-8 py-4 rounded-2xl bg-card border border-border text-foreground font-bold shadow-lg hover:bg-muted/50 transition-all flex items-center gap-3"
            >
              <Navigation className="h-5 w-5" />
              Ver Raio de Entrega
            </button>
          </div>
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute top-8 right-8 z-30 flex flex-col gap-3">
        <button 
          onClick={() => navigate("/admin/map")}
          className="p-4 rounded-2xl bg-background/80 backdrop-blur-xl border border-border shadow-2xl hover:scale-110 active:scale-95 transition-all group"
          title="Abrir Mapa em Tela Cheia"
        >
          <Maximize2 className="h-6 w-6 text-foreground group-hover:text-primary transition-colors" />
        </button>
        
        <div className="p-4 rounded-2xl bg-background/80 backdrop-blur-xl border border-border shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="pr-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Localização</p>
            <p className="text-sm font-extrabold text-foreground leading-none">{selectedCity || "Global"}</p>
          </div>
        </div>
      </div>

      {/* Footer Indicators */}
      <div className="absolute bottom-8 left-8 right-8 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
             <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))]" />
             <span className="text-xs font-bold text-foreground">Entregadores Online</span>
          </div>
          <div className="flex items-center gap-2 opacity-60">
             <div className="w-2.5 h-2.5 rounded-full bg-primary/40 border border-primary" />
             <span className="text-xs font-bold text-foreground">Áreas de Atendimento</span>
          </div>
        </div>
        
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">
          Arraste para explorar o mapa
        </div>
      </div>
    </section>
  );
}
