import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: "primary" | "warning" | "success";
}

export function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    success: "text-success bg-success/10",
  };
  
  return (
    <div className="bg-card rounded-3xl p-6 shadow-card border border-border/50 hover:border-primary/20 transition-all group">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", colors[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-4xl font-black text-foreground tracking-tight">{value}</p>
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}
