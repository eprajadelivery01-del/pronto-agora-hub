// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, RefreshCw,
  ShoppingBag, ArrowUpRight, ArrowDownRight, Wallet, BarChart3,
  Package, Clock, CheckCircle2, XCircle, Filter, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay, startOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type DateRange = { from: Date; to: Date };

const PERIODS = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "15d", label: "15 dias", days: 15 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "custom", label: "Personalizado", days: 0 },
] as const;

const PIE_COLORS = [
  "hsl(145, 63%, 42%)", // success
  "hsl(38, 92%, 50%)",  // warning
  "hsl(0, 84%, 60%)",   // destructive
  "hsl(210, 100%, 52%)" // info
];

export default function BusinessFinancePage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState("30d");
  const [customRange, setCustomRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [tab, setTab] = useState("overview");

  const dateRange = useMemo(() => {
    if (activePeriod === "custom") return customRange;
    const days = PERIODS.find(p => p.key === activePeriod)?.days || 30;
    return { from: subDays(new Date(), days), to: new Date() };
  }, [activePeriod, customRange]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
      if (data) setCompanyId(data.id);
    })();
  }, [user]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, delivery_fee, payment_method")
        .eq("company_id", companyId)
        .gte("created_at", startOfDay(dateRange.from).toISOString())
        .lte("created_at", endOfDay(dateRange.to).toISOString())
        .order("created_at", { ascending: false });
      setOrders(data || []);
      setLoading(false);
    })();
  }, [companyId, dateRange]);

  // Computed metrics
  const metrics = useMemo(() => {
    const completed = orders.filter(o => ["completed", "delivered"].includes(o.status));
    const pending = orders.filter(o => !["completed", "delivered", "cancelled"].includes(o.status));
    const cancelled = orders.filter(o => o.status === "cancelled");

    const totalRevenue = completed.reduce((s, o) => s + (o.total || 0), 0);
    const totalDeliveryFees = completed.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;

    // Today
    const todayOrders = completed.filter(o => isSameDay(new Date(o.created_at), new Date()));
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);

    // Yesterday for comparison
    const yesterday = subDays(new Date(), 1);
    const yesterdayOrders = completed.filter(o => isSameDay(new Date(o.created_at), yesterday));
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    return {
      totalRevenue, totalDeliveryFees, avgTicket,
      todayRevenue, revenueChange,
      completedCount: completed.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      totalOrders: orders.length,
      conversionRate: orders.length > 0 ? (completed.length / orders.length) * 100 : 0,
    };
  }, [orders]);

  // Chart data: daily revenue
  const dailyChartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayOrders = orders.filter(o =>
        ["completed", "delivered"].includes(o.status) && isSameDay(new Date(o.created_at), day)
      );
      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        fullDate: format(day, "dd 'de' MMM", { locale: ptBR }),
        receita: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
        pedidos: dayOrders.length,
      };
    });
  }, [orders, dateRange]);

  // Pie data for status
  const pieData = useMemo(() => [
    { name: "Concluídos", value: metrics.completedCount, color: PIE_COLORS[0] },
    { name: "Pendentes", value: metrics.pendingCount, color: PIE_COLORS[1] },
    { name: "Cancelados", value: metrics.cancelledCount, color: PIE_COLORS[2] },
  ].filter(d => d.value > 0), [metrics]);

  // Payment methods breakdown
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => ["completed", "delivered"].includes(o.status)).forEach(o => {
      const method = o.payment_method || "Não informado";
      map[method] = (map[method] || 0) + (o.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-xl">
        <p className="text-xs font-bold text-muted-foreground mb-2">{payload[0]?.payload?.fullDate || label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-muted-foreground">{p.name === "receita" ? "Receita" : "Pedidos"}:</span>
            <span className="text-sm font-black text-foreground">
              {p.name === "receita" ? fmt(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <BusinessLayout title="Financeiro">
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Centro Financeiro</h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Análise completa de receitas, pedidos e desempenho
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {PERIODS.map(p => (
              p.key !== "custom" ? (
                <button
                  key={p.key}
                  onClick={() => setActivePeriod(p.key)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
                    activePeriod === p.key
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {p.label}
                </button>
              ) : (
                <Popover key={p.key}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                      activePeriod === "custom"
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}>
                      <Calendar className="h-3 w-3" />
                      {activePeriod === "custom"
                        ? `${format(customRange.from, "dd/MM")} - ${format(customRange.to, "dd/MM")}`
                        : "Período"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarUI
                      mode="range"
                      selected={{ from: customRange.from, to: customRange.to }}
                      onSelect={(range: any) => {
                        if (range?.from && range?.to) {
                          setCustomRange({ from: range.from, to: range.to });
                          setActivePeriod("custom");
                        }
                      }}
                      numberOfMonths={2}
                      locale={ptBR}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Revenue */}
              <div className="relative bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-5 overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <DollarSign className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Receita Total</span>
                  </div>
                  <p className="text-2xl font-black text-foreground tracking-tight">{fmt(metrics.totalRevenue)}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {metrics.revenueChange >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className={cn("text-xs font-bold", metrics.revenueChange >= 0 ? "text-success" : "text-destructive")}>
                      {Math.abs(metrics.revenueChange).toFixed(1)}% vs ontem
                    </span>
                  </div>
                </div>
              </div>

              {/* Today */}
              <div className="bg-card border border-border/60 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-4.5 w-4.5 text-success" />
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Hoje</span>
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight">{fmt(metrics.todayRevenue)}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-2">
                  {orders.filter(o => isSameDay(new Date(o.created_at), new Date())).length} pedidos
                </p>
              </div>

              {/* Avg Ticket */}
              <div className="bg-card border border-border/60 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
                    <BarChart3 className="h-4.5 w-4.5 text-warning" />
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Ticket Médio</span>
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight">{fmt(metrics.avgTicket)}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-2">
                  por pedido concluído
                </p>
              </div>

              {/* Conversion */}
              <div className="bg-card border border-border/60 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-info/10 flex items-center justify-center">
                    <CheckCircle2 className="h-4.5 w-4.5 text-info" />
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Taxa Conversão</span>
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight">{metrics.conversionRate.toFixed(1)}%</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-2">
                  {metrics.completedCount} de {metrics.totalOrders} pedidos
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="bg-muted/50 border border-border/50 rounded-xl p-1">
                <TabsTrigger value="overview" className="rounded-lg text-xs font-bold data-[state=active]:shadow-sm">
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger value="orders" className="rounded-lg text-xs font-bold data-[state=active]:shadow-sm">
                  Pedidos
                </TabsTrigger>
                <TabsTrigger value="analysis" className="rounded-lg text-xs font-bold data-[state=active]:shadow-sm">
                  Análise
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-4">
                {/* Revenue Chart */}
                <div className="bg-card border border-border/60 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-base font-black text-foreground">Receita Diária</h3>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">Evolução de faturamento no período</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground">Receita</span>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={dailyChartData}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" opacity={0.5} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 600 }} stroke="hsl(220, 10%, 50%)" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 600 }} stroke="hsl(220, 10%, 50%)" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="receita" stroke="hsl(217, 91%, 50%)" strokeWidth={2.5} fill="url(#revenueGrad)" name="receita" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom row: Pie + Order volume */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Status Pie */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6">
                    <h3 className="text-base font-black text-foreground mb-1">Status dos Pedidos</h3>
                    <p className="text-xs text-muted-foreground font-medium mb-4">Distribuição no período selecionado</p>
                    {pieData.length > 0 ? (
                      <div className="flex items-center gap-6">
                        <ResponsiveContainer width={160} height={160}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" strokeWidth={0}>
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-3">
                          {pieData.map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                                <span className="text-xs font-bold text-muted-foreground">{item.name}</span>
                              </div>
                              <span className="text-sm font-black text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        Sem dados no período
                      </div>
                    )}
                  </div>

                  {/* Orders Volume Bar */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6">
                    <h3 className="text-base font-black text-foreground mb-1">Volume de Pedidos</h3>
                    <p className="text-xs text-muted-foreground font-medium mb-4">Quantidade diária de pedidos</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 600 }} stroke="hsl(220, 10%, 50%)" tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 600 }} stroke="hsl(220, 10%, 50%)" tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="pedidos" fill="hsl(217, 91%, 50%)" radius={[6, 6, 0, 0]} name="pedidos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="mt-4">
                <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-foreground">Todos os Pedidos</h3>
                      <p className="text-xs text-muted-foreground font-medium">{orders.length} pedidos no período</p>
                    </div>
                  </div>
                  {orders.length === 0 ? (
                    <div className="p-16 text-center text-muted-foreground">
                      <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="font-bold text-sm">Nenhum pedido no período</p>
                      <p className="text-xs mt-1">Ajuste o filtro de datas para ver mais resultados</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {/* Table header */}
                      <div className="grid grid-cols-12 gap-3 px-6 py-3 bg-muted/30">
                        <span className="col-span-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Pedido</span>
                        <span className="col-span-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Data/Hora</span>
                        <span className="col-span-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Status</span>
                        <span className="col-span-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Pagamento</span>
                        <span className="col-span-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider text-right">Valor</span>
                      </div>
                      {orders.map((order: any) => (
                        <div key={order.id} className="grid grid-cols-12 gap-3 px-6 py-3.5 hover:bg-muted/20 transition-colors items-center">
                          <div className="col-span-3">
                            <span className="text-xs font-black text-foreground font-mono">#{order.id.slice(-6).toUpperCase()}</span>
                          </div>
                          <div className="col-span-3">
                            <p className="text-xs font-medium text-foreground">
                              {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(order.created_at), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className={cn(
                              "text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider inline-block",
                              ["completed", "delivered"].includes(order.status) ? "bg-success/10 text-success" :
                              order.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                              "bg-warning/10 text-warning"
                            )}>
                              {["completed", "delivered"].includes(order.status) ? "Concluído" :
                               order.status === "cancelled" ? "Cancelado" :
                               order.status === "preparing" ? "Preparo" :
                               order.status === "ready" ? "Pronto" :
                               order.status === "in_route" ? "Em rota" : "Pendente"}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground font-medium capitalize">
                              {order.payment_method || "—"}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={cn(
                              "text-sm font-black",
                              order.status === "cancelled" ? "text-muted-foreground line-through" : "text-foreground"
                            )}>
                              {fmt(order.total || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Analysis Tab */}
              <TabsContent value="analysis" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Key metrics */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-5">
                    <h3 className="text-base font-black text-foreground">Indicadores</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">Concluídos</span>
                        </div>
                        <span className="text-lg font-black text-foreground">{metrics.completedCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-warning" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">Pendentes</span>
                        </div>
                        <span className="text-lg font-black text-foreground">{metrics.pendingCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <XCircle className="h-4 w-4 text-destructive" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">Cancelados</span>
                        </div>
                        <span className="text-lg font-black text-foreground">{metrics.cancelledCount}</span>
                      </div>
                      <div className="border-t border-border/50 pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">Total</span>
                        </div>
                        <span className="text-lg font-black text-foreground">{metrics.totalOrders}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery fees */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6">
                    <h3 className="text-base font-black text-foreground mb-1">Taxas de Entrega</h3>
                    <p className="text-xs text-muted-foreground font-medium mb-4">Receita de delivery no período</p>
                    <div className="flex flex-col items-center justify-center py-4">
                      <p className="text-3xl font-black text-foreground tracking-tight">{fmt(metrics.totalDeliveryFees)}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-2">
                        {metrics.completedCount > 0
                          ? `Média de ${fmt(metrics.totalDeliveryFees / metrics.completedCount)} por entrega`
                          : "Sem entregas concluídas"}
                      </p>
                    </div>
                  </div>

                  {/* Payment methods */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6">
                    <h3 className="text-base font-black text-foreground mb-1">Formas de Pagamento</h3>
                    <p className="text-xs text-muted-foreground font-medium mb-4">Distribuição por método</p>
                    {paymentData.length > 0 ? (
                      <div className="space-y-3">
                        {paymentData.map((item, i) => {
                          const total = paymentData.reduce((s, d) => s + d.value, 0);
                          const pct = total > 0 ? (item.value / total) * 100 : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-muted-foreground capitalize">{item.name}</span>
                                <span className="text-xs font-black text-foreground">{fmt(item.value)}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                        Sem dados
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </BusinessLayout>
  );
}
