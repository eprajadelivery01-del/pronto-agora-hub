import { useState, ReactNode, useEffect, useCallback } from "react";
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
  ExternalLink,
  Copy,
  Check,
  Clock
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
import { Badge } from "@/components/ui/badge";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";

interface BusinessLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  fullHeight?: boolean;
}

const tabs = [
  { label: "Visão Geral", icon: LayoutDashboard, href: "/business", category: "Visão Geral" },
  { label: "Novos Pedidos", icon: ShoppingBag, href: "/business/orders", category: "Operacional" },
  { label: "Chat", icon: MessageCircle, href: "/business/chat", category: "Operacional" },
  { label: "Marketplace", icon: Store, href: "DYNAMIC_MARKETPLACE", category: "Marketplace", external: true },
  { label: "Cardápio/Produtos", icon: Tag, href: "/business/products", category: "Marketplace" },
  { label: "Cupons de Desconto", icon: Percent, href: "/business/coupons", category: "Marketplace" },
  { label: "Meus Clientes", icon: Users, href: "/business/customers", category: "Marketplace" },
  { label: "Financeiro", icon: DollarSign, href: "/business/finance", category: "Gestão" },
  { label: "Faturas", icon: DollarSign, href: "/business/invoices", category: "Gestão" },
  { label: "Histórico", icon: History, href: "/business/history", category: "Gestão" },
];

const LOJISTA_READ_KEY = "@epraja_lojista_read_notif_ids";

export function BusinessLayout({ children, title, subtitle, fullHeight }: BusinessLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [marketingNotifs, setMarketingNotifs] = useState<any[]>([]);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const { data: companyData } = useCompany(user?.id, user?.email);

  const getReadIds = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(LOJISTA_READ_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }, []);

  const markMarketingAsRead = (id: string) => {
    try {
      const readIds = getReadIds();
      readIds.add(id);
      localStorage.setItem(LOJISTA_READ_KEY, JSON.stringify(Array.from(readIds)));
      setMarketingNotifs(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    } catch {}
  };

  const handleCopyCoupon = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    toast.success(`Cupom ${code} copiado!`);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  const isActive = (href: string) => {
    if (href === "/business") return location.pathname === "/business";
    return location.pathname.startsWith(href);
  };

  const categories = Array.from(new Set(tabs.map(t => t.category)));

  const unreadChatCount = useUnreadChatCount(companyData?.id);

  // Busca notificações de marketing destinadas aos lojistas
  const fetchMarketingNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_notifications')
        .select('*')
        .eq('target_audience', 'stores')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn("[BusinessLayout] Erro ao buscar marketing_notifications:", error.message);
        return;
      }

      const readIds = getReadIds();
      const now = Date.now();

      const items = (data || [])
        .filter((item: any) => {
          const audience = String(item.target_audience || "").trim().toLowerCase();
          if (audience !== "stores") return false;
          const createdAtTime = new Date(item.created_at).getTime();
          if (!isNaN(createdAtTime) && createdAtTime > now + 60000) return false;
          return true;
        })
        .map((item: any) => ({
          ...item,
          type: 'marketing',
          read: readIds.has(item.id),
        }));

      setMarketingNotifs(items);
    } catch (e) {
      console.warn("[BusinessLayout] Exceção ao carregar marketing:", e);
    }
  }, [getReadIds]);

  useEffect(() => {
    fetchMarketingNotifications();

    const mktChannel = supabase.channel(`public:mkt_lojista_${Math.random().toString(36).substring(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_notifications' }, (payload) => {
        const record: any = payload.new || payload.old;
        if (!record) return;
        const audience = String(record.target_audience || "").trim().toLowerCase();
        if (audience === "stores") {
          fetchMarketingNotifications();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(mktChannel);
    };
  }, [fetchMarketingNotifications]);

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

    const fetchPendingOrders = async (cId: string) => {
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
          type: 'order',
          notifType: o.status === 'pending' ? 'new_order' : 'delivery_cancelled'
        }));
        setPendingOrders(notifs);
      } else {
        setPendingOrders([]);
      }
    };

    if (companyData?.id) {
      fetchStatus();
      fetchPendingOrders(companyData.id);
    }

    const orderChannel = supabase.channel(`public:orders_layout_${companyData?.id || ''}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
         if (companyData?.id) {
           fetchPendingOrders(companyData.id);
         }
      })
      .subscribe();

    const handleStatusSync = (e: any) => {
      setIsOpen(e.detail.isOpen);
    };
    window.addEventListener('store-status-changed', handleStatusSync);

    return () => {
      supabase.removeChannel(orderChannel);
      window.removeEventListener('store-status-changed', handleStatusSync);
    };
  }, [user?.id, companyData?.id]);

  const toggleStoreStatus = async () => {
    if (!companyData?.id || updatingStatus) return;
    
    const previousStatus = isOpen;
    const newStatus = !isOpen;
    
    // Immediate UI feedback
    setIsOpen(newStatus);
    setUpdatingStatus(true);
    
    // Notify other components (like BusinessProfilePage) immediately
    window.dispatchEvent(new CustomEvent('store-status-changed', { detail: { isOpen: newStatus } }));
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ 
          is_open: newStatus
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
                          {collapsed && (tab.label === "Chat" || tab.label === "Suporte") && unreadChatCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-card" />
                          )}
                          {collapsed && tab.label === "Novos Pedidos" && pendingOrders.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-card" />
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex-1 flex items-center justify-between animate-in fade-in slide-in-from-left-2 duration-300">
                            {tab.label}
                            {(tab.label === "Chat" || tab.label === "Suporte") && unreadChatCount > 0 && (
                              <span className="ml-2 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                                {unreadChatCount > 99 ? '99+' : unreadChatCount}
                              </span>
                            )}
                            {tab.label === "Novos Pedidos" && pendingOrders.length > 0 && (
                              <span className="ml-2 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] animate-pulse shadow-lg">
                                {pendingOrders.length > 99 ? '99+' : pendingOrders.length}
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
        <header 
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.85rem)' }}
          className="flex-none bg-background/80 backdrop-blur-xl border-b border-border px-3 sm:px-6 pb-3 sm:pb-4 flex items-center justify-between gap-2 sm:gap-4 relative z-30"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              className="lg:hidden p-2 rounded-xl sm:rounded-2xl bg-muted/50 hover:bg-muted transition-colors shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
            </button>
            <h1 className="text-sm sm:text-xl font-display font-black text-foreground tracking-tight flex items-center gap-2 sm:gap-3 truncate">
              <span className="hidden sm:inline w-1 h-6 bg-primary rounded-full shrink-0" />
              <span className="truncate">{title || "Painel Lojista"}</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Status Button - Visible on all screens */}
            <button 
              onClick={toggleStoreStatus}
              disabled={updatingStatus}
              className={cn(
                "px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl border text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0",
                isOpen 
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60" 
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/60"
              )}
              title={isOpen ? "Loja aberta no Marketplace. Clique para fechar." : "Loja fechada no Marketplace. Clique para abrir."}
            >
              <div className={cn("w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0", isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
              <span>
                {updatingStatus ? "..." : (isOpen ? "Aberto" : "Fechado")}
              </span>
            </button>

            {/* Notifications Bell */}
            <Popover open={popoverOpen} onOpenChange={(open) => {
              setPopoverOpen(open);
              if (open) {
                marketingNotifs.forEach(m => markMarketingAsRead(m.id));
              }
            }}>
              <PopoverTrigger asChild>
                <button className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 hover:bg-primary/20 transition-all shrink-0 group">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:animate-ring transition-transform" />
                  {(pendingOrders.length + marketingNotifs.filter(m => !m.read).length) > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full border-2 border-background shadow-sm animate-pulse flex items-center justify-center text-[8px] text-white font-black">
                      {(pendingOrders.length + marketingNotifs.filter(m => !m.read).length) > 9 ? '9+' : (pendingOrders.length + marketingNotifs.filter(m => !m.read).length)}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-84 md:w-96 p-0 mr-2 sm:mr-4 mt-2 rounded-[2rem] shadow-2xl border-border/50 overflow-hidden bg-background/95 backdrop-blur-xl" align="end">
                <div className="bg-primary/5 px-6 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-black text-sm uppercase tracking-widest text-primary">Notificações</h3>
                  <span className="text-[10px] text-muted-foreground font-bold">
                    {pendingOrders.length + marketingNotifs.length} no total
                  </span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-border/50">
                    {(pendingOrders.length === 0 && marketingNotifs.length === 0) ? (
                      <div className="p-8 text-center flex flex-col items-center gap-3">
                        <Bell className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground font-medium">Nenhuma notificação por enquanto.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {[
                          ...pendingOrders.map(p => ({ ...p, notifCategory: 'order' as const, sortTime: new Date(p.created_at).getTime() })),
                          ...marketingNotifs.map(m => ({ ...m, notifCategory: 'marketing' as const, sortTime: new Date(m.created_at).getTime() }))
                        ]
                          .sort((a, b) => b.sortTime - a.sortTime)
                          .map(item => {
                            if (item.notifCategory === 'marketing') {
                              return (
                                <div 
                                  key={item.id}
                                  onClick={() => markMarketingAsRead(item.id)}
                                  className={cn(
                                    "p-4 hover:bg-muted/50 cursor-pointer transition-colors flex flex-col gap-1.5 relative",
                                    !item.read && "bg-primary/5 border-l-2 border-primary"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {item.emoji && <span className="text-base shrink-0">{item.emoji}</span>}
                                      <span className="text-xs font-black text-foreground truncate">{item.title}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  {item.image_url && (
                                    <div className="w-full h-28 rounded-xl overflow-hidden my-1 bg-muted relative">
                                      <img 
                                        src={item.image_url} 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                      />
                                    </div>
                                  )}

                                  <p className="text-xs text-muted-foreground leading-relaxed">{item.message}</p>

                                  {item.coupon_code && (
                                    <div 
                                      className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between gap-2 mt-1" 
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <span className="font-mono font-black text-primary text-xs tracking-wider truncate">{item.coupon_code}</span>
                                      </div>
                                      <Button 
                                        size="sm" 
                                        onClick={(e) => handleCopyCoupon(item.coupon_code!, e)} 
                                        className="h-7 px-2.5 text-[10px] font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0"
                                      >
                                        {copiedCoupon === item.coupon_code ? (
                                          <>
                                            <Check className="w-3 h-3 mr-1" /> Copiado
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 mr-1" /> Copiar
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <Link
                                key={item.id}
                                to="/business/orders"
                                onClick={() => setPopoverOpen(false)}
                                className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-3"
                              >
                                <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5">
                                  <Clock className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-xs text-foreground">Novo Pedido #{item.id.slice(0, 8)}</span>
                                    <span className="text-[10px] text-muted-foreground font-bold">
                                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 font-bold">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total)}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                      </div>
                    )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Theme Toggle */}
            <ThemeToggle className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl shrink-0" />

            {/* Profile Dropdown (Desktop / Tablet) */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="hidden sm:flex items-center gap-2 p-1 rounded-2xl hover:bg-muted transition-all group border border-transparent hover:border-border shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                    {profile?.avatar_url ? (
                      <img src={optimizeStorageImage(profile.avatar_url, { width: 96 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="text-left mr-1">
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
        </header>

        {/* Page content */}
        <main className={cn(
          "flex-1 flex flex-col min-h-0",
          fullHeight 
            ? "overflow-hidden p-3 lg:p-6 pb-4" 
            : "overflow-y-auto custom-scrollbar p-4 lg:p-8 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]"
        )}>
          <div className={cn(
            "max-w-7xl mx-auto w-full flex-1 min-h-0",
            fullHeight ? "flex flex-col h-full" : "space-y-6"
          )}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] left-1/2 -translate-x-1/2 z-50 lg:hidden bg-card/80 backdrop-blur-2xl border border-white/10 flex items-center gap-2 py-2 px-3 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5 animate-in slide-in-from-bottom-10 duration-700">
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
