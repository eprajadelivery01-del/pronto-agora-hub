import { useState, ReactNode, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Tag,
  Percent,
  Users,
  DollarSign,
  History,
  Palette,
  MessageCircle,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  User,
  Bell,
  ChevronDown,
  Package,
  Truck,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizeStorageImage } from "@/lib/imageOptimization";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "../shared/ThemeToggle";
import { supabase } from "@/lib/supabaseClient";
import { useCompany } from "@/services/companies";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BusinessLayoutProps {
  children: ReactNode;
  title?: string;
}

const tabs = [
  { label: "Painel de Entregas", icon: LayoutDashboard, href: "/business", category: "Operacional" },
  { label: "Novos Pedidos", icon: ShoppingBag, href: "/business/orders", category: "Operacional" },
  { label: "Suporte", icon: MessageCircle, href: "/business/chat", category: "Operacional" },
  { label: "Marketplace", icon: Store, href: "DYNAMIC_MARKETPLACE", category: "Marketplace", external: true },
  { label: "Cardápio/Produtos", icon: Tag, href: "/business/products", category: "Marketplace" },
  { label: "Cupons de Desconto", icon: Percent, href: "/business/coupons", category: "Marketplace" },
  { label: "Meus Clientes", icon: Users, href: "/business/customers", category: "Marketplace" },
  { label: "Financeiro", icon: DollarSign, href: "/business/finance", category: "Gestão" },
  { label: "Faturas", icon: DollarSign, href: "/business/invoices", category: "Gestão" },
  { label: "Histórico", icon: History, href: "/business/history", category: "Gestão" },
];

export function BusinessLayout({ children, title }: BusinessLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const { data: companyData } = useCompany(user?.id, user?.email);

  const isActive = (href: string) => {
    if (href === "/business") return location.pathname === "/business";
    return location.pathname.startsWith(href);
  };

  const categories = Array.from(new Set(tabs.map(t => t.category)));

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchStatus = async () => {
      if (!companyData?.id) return;
      const { data } = await supabase
        .from('companies')
        .select('is_open')
        .eq('id', companyData.id)
        .maybeSingle();
      
      if (data) setIsOpen(data.is_open);
    };

    const fetchPendingOrders = async (cId) => {
      const targetId = cId || companyData?.id;
      if (!targetId) return;

      const { data: rawOrders } = await supabase
        .from('orders')
        .select('id, status, total, created_at, customer_id, company_id, delivery_id')
        .eq('company_id', targetId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false });
      
      if (rawOrders) {
        const deliveryIds = rawOrders.map(o => o.delivery_id).filter(Boolean);
        const cancelledDeliveryIds = new Set();
        
        if (deliveryIds.length > 0) {
           const { data: deliveriesData } = await supabase
              .from('deliveries')
              .select('id, status')
              .in('id', deliveryIds)
              .eq('status', 'cancelled');
           if (deliveriesData) {
              deliveriesData.forEach(d => cancelledDeliveryIds.add(d.id));
           }
        }

        const notifs = rawOrders.filter(o => o.status === 'pending' || cancelledDeliveryIds.has(o.delivery_id)).map(o => ({
          ...o,
          notifType: o.status === 'pending' ? 'new_order' : 'delivery_cancelled'
        }));
        setPendingOrders(notifs);
      } else {
        setPendingOrders([]);
      }
    };

    const checkUnreadChats = async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, messages(created_at, sender_id, content)")
        .contains("participants", [user.id]);
        
      if (convs) {
        let count = 0;
        const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
        
        for (const conv of convs) {
          if (!conv.messages || conv.messages.length === 0) continue;
          
          const sorted = [...conv.messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const lastMsg = sorted[0];
          
          // Se o last message foi enviado pelo proprio usuario (usando hack de \u200B) ou se é do próprio ID sem hack
          const isMe = (lastMsg.sender_id === user.id && lastMsg.content?.endsWith('\u200B')) || lastMsg.sender_id === user.id; 
          
          if (!isMe) {
            const lastRead = readTimestamps[conv.id];
            if (!lastRead || new Date(lastMsg.created_at) > new Date(lastRead)) {
              count++;
            }
          }
        }
        setUnreadChatCount(count);
      }
    };

    if (companyData?.id) {
      fetchStatus();
      fetchPendingOrders(companyData.id);
    }
    
    checkUnreadChats();

    const channel = supabase.channel('public:messages_layout')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
         checkUnreadChats();
      })
      .subscribe();

    const handleStorage = () => checkUnreadChats();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('chat_read_update', handleStorage);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('chat_read_update', handleStorage);
    };
  }, [user?.id, companyData?.id]);

  const toggleStoreStatus = async () => {
    if (!companyData?.id || updatingStatus) return;
    
    const previousStatus = isOpen;
    const newStatus = !isOpen;
    
    // Immediate UI feedback
    setIsOpen(newStatus);
    setUpdatingStatus(true);
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ 
          is_open: newStatus, 
          show_in_marketplace: newStatus,
          active: newStatus,
          is_active: newStatus
        })
        .eq('id', companyData.id);
      
      if (error) throw error;
      
      toast.success(newStatus ? "Loja aberta!" : "Loja fechada!");
    } catch (err: any) {
      // Revert on error
      setIsOpen(previousStatus);
      toast.error("Erro ao atualizar status: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none pt-[env(safe-area-inset-top)]",
          "lg:translate-x-0 lg:sticky lg:top-0 lg:z-40",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-20" : "w-72"
        )}
      >
        {/* Brand */}
        <div className={cn("flex-none p-6 border-b border-border flex items-center justify-between", collapsed && "justify-center px-0")}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-border shrink-0 overflow-hidden">
              {companyData?.logo_url ? (
                <img src={optimizeStorageImage(companyData.logo_url, { width: 96 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full gradient-primary flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            {!collapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-sm font-black text-foreground tracking-tighter uppercase block">É Pra Já</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block opacity-70 truncate max-w-[120px]">
                  {companyData?.name || profile?.full_name || "Lojista"}
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex absolute -right-3 top-8 h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted transition-colors z-50 text-muted-foreground"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
          {categories.map((category) => {
            const categoryTabs = tabs.filter(t => t.category === category);
            
            return (
              <div key={category} className="space-y-1">
                {!collapsed && (
                  <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 pb-2 animate-in fade-in duration-300">
                    {category}
                  </h3>
                )}
                <div className="space-y-1">
                  {categoryTabs.map((tab) => {
                    const active = isActive(tab.href);
                    return !tab.external ? (
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
                        <div className="relative shrink-0">
                          <tab.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-muted-foreground")} />
                          {collapsed && tab.label === "Suporte" && unreadChatCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-card" />
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex-1 flex items-center justify-between animate-in fade-in slide-in-from-left-2 duration-300">
                            {tab.label}
                            {tab.label === "Suporte" && unreadChatCount > 0 && (
                              <span className="ml-2 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                                {unreadChatCount > 99 ? '99+' : unreadChatCount}
                              </span>
                            )}
                          </span>
                        )}
                        {active && !collapsed && <ChevronRight className="h-4 w-4 opacity-50" />}
                      </Link>
                    ) : (
                      <a
                        key={tab.label}
                        href={
                          tab.href === "DYNAMIC_MARKETPLACE"
                            ? companyData?.id
                              ? `https://eprajadelivery.com/marketplace/store/${companyData.id}`
                              : "https://eprajadelivery.com/marketplace"
                            : tab.href
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted",
                          collapsed && "justify-center px-0"
                        )}
                        title={collapsed ? tab.label : ""}
                      >
                        <tab.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110 text-muted-foreground" />
                        {!collapsed && <span className="flex-1 animate-in fade-in slide-in-from-left-2 duration-300">{tab.label}</span>}
                        {!collapsed && <ExternalLink className="h-3 w-3 opacity-30" />}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className={cn("flex-none p-4 border-t border-border space-y-1", collapsed && "flex flex-col items-center px-0")}>
          <Link
            to="/business/profile"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
              collapsed && "justify-center px-0"
            )}
          >
            <Settings className="h-5 w-5" />
            {!collapsed && <span className="animate-in fade-in duration-300">Configurações</span>}
          </Link>
          <button
            onClick={signOut}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="animate-in fade-in duration-300">Sair do Painel</span>}
          </button>

        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/20 min-h-0">
        {/* Header */}
        <header className="flex-none bg-background/80 backdrop-blur-xl border-b border-border px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 flex items-center justify-between gap-4 relative z-30">
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
          
          <div className="flex items-center gap-4">
            {/* Status Button */}
            <div className="hidden md:flex items-center gap-3 mr-2">
              <button 
                onClick={toggleStoreStatus}
                disabled={updatingStatus}
                className={cn(
                  "px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm",
                  isOpen 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" 
                    : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full", isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                {updatingStatus ? "..." : (isOpen ? "Status: Aberto" : "Status: Fechado")}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 hover:bg-primary/20 transition-all group">
                    <Bell className="h-5 w-5 text-primary group-hover:animate-ring transition-transform" />
                    {pendingOrders.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full border-2 border-background shadow-sm animate-pulse flex items-center justify-center text-[8px] text-white font-black">
                        {pendingOrders.length > 9 ? '9+' : pendingOrders.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 mr-4 mt-2 rounded-[2rem] shadow-2xl border-border/50 overflow-hidden" align="end">
                  <div className="bg-primary/5 px-6 py-4 border-b border-border">
                    <h3 className="font-black text-sm uppercase tracking-widest text-primary">Notificações</h3>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {pendingOrders.length === 0 ? (
                      <div className="p-8 text-center flex flex-col items-center gap-3">
                        <Bell className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground font-medium">Nenhuma notificação nova.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {pendingOrders.map(order => (
                          <div 
                            key={order.id} 
                            onClick={() => {
                              setSidebarOpen(false);
                              navigate('/business/orders');
                            }} 
                            className="p-5 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between">
                              {order.notifType === 'delivery_cancelled' ? (
                                <span className="text-[10px] font-black uppercase tracking-widest text-destructive bg-destructive/10 px-2 py-0.5 rounded-full animate-pulse">Motoboy Cancelou</span>
                              ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">Novo Pedido</span>
                              )}
                              <span className="text-xs font-bold text-muted-foreground">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-sm font-bold mt-2">Pedido #{order.id?.slice(-6).toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground truncate">{order.customer_name || 'Cliente Marketplace'}</p>
                            {order.notifType === 'delivery_cancelled' ? (
                              <span className="text-xs text-destructive font-medium">Vá em "Novos Pedidos" para re-despachar.</span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Profile Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 p-1 rounded-2xl hover:bg-muted transition-all group border border-transparent hover:border-border">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                      {profile?.avatar_url ? (
                        <img src={optimizeStorageImage(profile.avatar_url, { width: 96 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="hidden sm:block text-left mr-1">
                      <p className="text-[10px] font-black uppercase text-foreground leading-tight truncate max-w-[100px]">
                        {companyData?.name || profile?.full_name || 'Lojista'}
                      </p>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 mr-4 mt-2 rounded-[1.5rem] shadow-2xl border-border/50 bg-background/95 backdrop-blur-xl" align="end">
                  <div className="px-4 py-3 mb-2 border-b border-border/50">
                    <p className="text-xs font-black uppercase tracking-tight text-foreground truncate">{companyData?.name || profile?.full_name || 'Lojista'}</p>
                    <p className="text-[10px] font-bold text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <Link 
                    to="/business/profile" 
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                  <button 
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all mt-1"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair do Painel
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <div className="max-w-7xl mx-auto w-full space-y-6 pb-10 flex-1">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
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
