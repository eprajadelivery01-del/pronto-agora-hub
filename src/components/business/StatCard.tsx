import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: "primary" | "warning" | "success" | "info";
  subtitle?: string;
}

export function StatCard({ label, value, icon: Icon, color, subtitle }: StatCardProps) {
  const iconStyles: Record<string, string> = {
    primary: "text-primary bg-primary/10 ring-primary/20",
    warning: "text-warning bg-warning/10 ring-warning/20",
    success: "text-success bg-success/10 ring-success/20",
    info: "text-info bg-info/10 ring-info/20",
  };

  const accentBar: Record<string, string> = {
    primary: "from-primary to-primary/40",
    warning: "from-warning to-warning/40",
    success: "from-success to-success/40",
    info: "from-info to-info/40",
  };

  return (
    <div className="relative bg-card rounded-2xl p-5 shadow-card border border-border/40 hover:shadow-card-hover hover:border-border transition-all duration-300 group overflow-hidden">
      {/* Top accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity", accentBar[color])} />
      
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-black text-foreground tracking-tight leading-none">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/70 font-medium">{subtitle}</p>}
        </div>
        <div className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center ring-1 shrink-0 transition-transform duration-300 group-hover:scale-110",
          iconStyles[color]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
