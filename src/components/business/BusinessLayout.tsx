import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Store,
  User,
  LogOut,
  Menu,
  Package,
  Truck,
  Users,
  DollarSign,
  ClipboardList,
  Bell,
  ChevronRight,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// Navigation tabs
const tabs = [
  { label: "Painel de Entregas", icon: Truck, href: "/business", category: "Operacional" },
  { label: "Novos Pedidos", icon: Bell, href: "/business/orders", category: "Operacional" },
  { label: "Cardápio/Produtos", icon: Package, href: "/business/products", category: "Marketplace" },
  { label: "Meus Clientes", icon: Users, href: "/business/customers", category: "Marketplace" },
  { label: "Financeiro", icon: DollarSign, href: "/business/finance", category: "Gestão" },
  { label: "Histórico", icon: ClipboardList, href: "/business/history", category: "Gestão" },
  { label: "Identidade Visual", icon: Store, href: "/business/profile", category: "Configurações" },
];

interface BusinessLayoutProps {
  children: ReactNode;
  title?: string;
}

export function BusinessLayout({ children, title }: BusinessLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("epj_biz_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [company, setCompany] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setCompany(data as any);
        setIsOpen((data as any).is_open ?? true);
      }
    };
    fetchCompany();
  }, [user]);

  const toggleStoreStatus = async () => {
    if (!company?.id || updatingStatus) return;
    setUpdatingStatus(true);
    const newStatus = !isOpen;
    
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_open: newStatus } as any)
        .eq("id", company.id);
        
      if (error) throw error;
      setIsOpen(newStatus);
      toast.success(newStatus ? "Loja ABERTA para pedidos!" : "Loja FECHADA no marketplace.");
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("epj_biz_sidebar_collapsed", String(newState));
  };

  const isActive = (href: string) => {
    if (href === "/business") return location.pathname === "/business";
    return location.pathname.startsWith(href);
  };

  // Helper to parse logo
  const getLogo = () => {
    if (!company?.logo_url) return "/logo.png";
    try {
      const parsed = JSON.parse(company.logo_url);
      return parsed.logo || "/logo.png";
    } catch {
      return company.logo_url;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row font-sans selection:bg-primary/20">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none",
          "lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-20" : "w-72"
        )}
      >
        {/* Toggle Button (Desktop) */}
        <button 
          onClick={toggleSidebar}
          className={cn(
            "hidden lg:flex absolute -right-4 top-24 w-8 h-8 rounded-full bg-primary border-2 border-white ring-1 ring-black items-center justify-center text-primary-foreground shadow-xl transition-all hover:scale-110 z-[70]",
            collapsed && "rotate-180"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Brand/Store Info */}
        <div className={cn("px-6 py-8 transition-all", collapsed && "px-0 flex justify-center")}>
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-primary-foreground/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative w-12 h-12 rounded-2xl bg-white flex items-center justify-center border border-border shadow-md overflow-hidden">
                <img src={getLogo()} alt="Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            {!collapsed && (
              <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">

                <h2 className="text-base font-black text-foreground leading-tight truncate">
                  {company?.name || profile?.full_name || "Minha Loja"}
                </h2>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 px-3 space-y-8 overflow-y-auto custom-scrollbar pb-8">
          {["Operacional", "Marketplace", "Gestão", "Configurações"].map((category) => (
            <div key={category} className="space-y-1">
              {!collapsed && (
                <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 pb-2 animate-in fade-in duration-300">
                  {category}
                </h3>
              )}
              <div className="space-y-1">
                {tabs.filter(t => t.category === category).map((tab) => {
                  const active = isActive(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      to={tab.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200",
                        active
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? tab.label : ""}
                    >
                      <tab.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-muted-foreground")} />
                      {!collapsed && <span className="flex-1 animate-in fade-in slide-in-from-left-2 duration-300">{tab.label}</span>}
                      {active && !collapsed && <ChevronRight className="h-4 w-4 opacity-50" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Sidebar Actions */}
        <div className={cn("p-4 border-t border-border space-y-1", collapsed && "flex flex-col items-center px-0")}>
          <Link
            to="/business/profile"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? "Configurações" : ""}
          >
            <Settings className="h-5 w-5" />
            {!collapsed && <span className="animate-in fade-in slide-in-from-left-2 transition-all">Configurações</span>}
          </Link>
          <button
            onClick={signOut}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? "Sair do Painel" : ""}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="animate-in fade-in slide-in-from-left-2 transition-all">Sair do Painel</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/20 overflow-hidden h-screen">
        {/* Header */}
        <header className="flex-none bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between gap-4 relative z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2.5 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6 text-foreground" />
            </button>
            <h1 className="text-xl font-display font-black text-foreground tracking-tight flex items-center gap-3">
              <span className="hidden sm:inline w-1 h-6 bg-primary rounded-full" />
              {title || "Painel Lojista"}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-black text-foreground leading-none">{profile?.full_name?.split(" ")[0]}</span>
                <button 
                  onClick={toggleStoreStatus}
                  disabled={updatingStatus}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 hover:opacity-80 transition-all",
                    isOpen ? "text-success" : "text-destructive"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", isOpen ? "bg-success animate-pulse" : "bg-destructive")} />
                  {updatingStatus ? "Atualizando..." : (isOpen ? "Status: Online" : "Status: Offline")}
                </button>
             </div>
             <div className="relative group">
               <button 
                 onClick={() => navigate("/business/orders")}
                 className="relative w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 hover:bg-primary/20 transition-all hover:scale-105"
               >
                  <Bell className="h-5 w-5 text-primary group-hover:animate-ring transition-transform" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full border-2 border-background shadow-sm animate-pulse" />
               </button>
             </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-20 lg:pb-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation (Premium Float) */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden bg-card/80 backdrop-blur-2xl border border-white/10 flex items-center gap-2 py-2 px-3 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5 animate-in slide-in-from-bottom-10 duration-700">
        {[
          { icon: Truck, href: "/business" },
          { icon: Bell, href: "/business/orders" },
          { icon: Package, href: "/business/products" },
          { icon: DollarSign, href: "/business/finance" },
          { icon: Store, href: "/business/profile" },
        ].map((tab, idx) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={idx}
              to={tab.href}
              className={cn(
                "flex items-center justify-center p-3 rounded-full transition-all duration-300",
                active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
