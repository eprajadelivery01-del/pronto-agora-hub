import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  Store,
  User,
  LogOut,
  Menu,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// Only tabs with registered routes - removing Mapa/Clientes/Financeiro/Histórico to prevent 404
const tabs = [
  { label: "Pedidos", icon: ShoppingBag, href: "/business" },
  { label: "Produtos", icon: Package, href: "/business/products" },
  { label: "Identidade", icon: Store, href: "/business/profile" },
  { label: "Perfil", icon: User, href: "/business/profile" },
];

interface BusinessLayoutProps {
  children: ReactNode;
  title?: string;
}

export function BusinessLayout({ children, title }: BusinessLayoutProps) {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/business") return location.pathname === "/business";
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row font-sans">
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
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg p-1.5 border border-border">
              <img src="/logo.png" alt="É Pra Já" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-primary leading-none mb-1 font-black uppercase tracking-[0.2em]">É Pra Já</p>
              <p className="text-sm font-bold text-foreground leading-none truncate mt-0.5">
                {profile?.full_name || "Lojista"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <tab.icon className={cn("h-5 w-5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/20">
        {/* Header (Desktop: title and toggle, Mobile: menu icon) */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center gap-4">
          <button
            className="lg:hidden p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6 text-foreground" />
          </button>
          
          <div className="flex-1">
            <h1 className="text-xl font-display font-black text-foreground tracking-tight">
              {title || "Painel Lojista"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="text-xs font-black text-primary uppercase">
                   {profile?.full_name?.charAt(0) || "L"}
                </span>
             </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 pb-24 lg:pb-8 overflow-auto">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/90 backdrop-blur-lg border-t border-border flex items-center justify-around py-3 px-4 safe-area-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        {tabs.slice(0, 4).map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                active ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-6 w-6", active && "stroke-[2.5px]")} />
              <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
