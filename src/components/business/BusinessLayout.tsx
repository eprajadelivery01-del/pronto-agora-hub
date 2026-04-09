import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  Map,
  Users,
  DollarSign,
  ClipboardList,
  User,
  LogOut,
  Zap,
  Menu,
  X,
  Building2,
  Bike,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAllRealtime } from "@/services/realtime";
import { useState } from "react";
import { APP_TYPE, APP_PROJECT_ID, APP_COLOR } from "@/constants/app-config";

const tabs = [
  { label: "Pedidos", icon: ShoppingBag, href: "/business" },
  { label: "Cardápio", icon: Zap, href: "/business/products" },
  { label: "Mapa", icon: Map, href: "/business/map" },

  { label: "Clientes", icon: Users, href: "/business/customers" },
  { label: "Lojas", icon: Building2, href: "/business/companies" },
  { label: "Equipe", icon: Bike, href: "/business/drivers" },
  { label: "Financeiro", icon: DollarSign, href: "/business/finance" },
  { label: "Histórico", icon: ClipboardList, href: "/business/history" },
  { label: "Ocorrências", icon: AlertTriangle, href: "/business/occurrences" },
  { label: "Perfil", icon: User, href: "/business/profile" },
];

interface BusinessLayoutProps {
  children: ReactNode;
  title?: string;
}

export function BusinessLayout({ children, title }: BusinessLayoutProps) {
  // Activate global realtime listeners
  useAllRealtime();
  
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/business") return location.pathname === "/business";
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
          "lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md p-1">
              <img src="/logo.png" alt="É Pra Já" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground leading-none mb-0.5 font-bold uppercase tracking-widest">É Pra Já</p>
              <p className="text-sm font-semibold text-foreground leading-none truncate max-w-[130px] mt-0.5">
                {profile?.full_name || "Lojista"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <tab.icon className="h-4.5 w-4.5 shrink-0" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-4">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <h1 className="text-base font-display font-bold text-foreground flex-1 truncate">
            {title || "Painel Lojista"}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-24 lg:pb-6 overflow-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          
          {/* Global Branding Footer */}
          <div className="w-full py-12 flex justify-center opacity-10 pointer-events-none select-none mt-auto">
            <p className="text-[10px] font-black tracking-[0.4em] text-muted-foreground uppercase">
              BONASOFT
            </p>
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-card border-t border-border flex items-center justify-around py-1 px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-0",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "scale-110 transition-transform")} />
              <span className="text-[9px] font-medium truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Persistence Safety Badge - DEV ONLY */}
      <div 
        className="fixed bottom-20 right-4 z-[9999] px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest text-white shadow-2xl flex items-center gap-2 pointer-events-none select-none opacity-80 lg:bottom-6"
        style={{ backgroundColor: APP_COLOR, border: "2px solid white" }}
      >
        <span className="animate-pulse">●</span>
        APP: {APP_TYPE} ({APP_PROJECT_ID})
      </div>
    </div>
  );
}
