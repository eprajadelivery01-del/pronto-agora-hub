import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDeliveries } from "@/services/deliveries";
import { useCompanies } from "@/services/companies";
import { useDrivers } from "@/services/drivers";
import { useRegions } from "@/services/regions";
import { BarChart3, Download, Loader2, Filter, Search } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from "recharts";

export default function ReportsPage() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");

  const { data: companies } = useCompanies();
  const { data: drivers } = useDrivers();
  const { data: regions } = useRegions();

  const { data, isLoading } = useDeliveries({
    status: statusFilter,
    companyId: companyFilter || undefined,
    driverId: driverFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: searchQuery || undefined,
    pageSize: 1000,
  });

  const rawDeliveries = data?.data ?? [];
  const deliveries = useMemo(() => {
    return rawDeliveries.filter((d) => {
      if (regionFilter && d.region_id !== regionFilter) return false;
      if (paymentFilter && d.payment_method !== paymentFilter) return false;
      if (minVal && Number(d.value ?? 0) < Number(minVal)) return false;
      if (maxVal && Number(d.value ?? 0) > Number(maxVal)) return false;
      return true;
    });
  }, [rawDeliveries, regionFilter, paymentFilter, minVal, maxVal]);

  const totalValue = deliveries.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const totalCommission = deliveries.reduce((s, d) => s + Number((d as any).commission ?? 0), 0);
  const completedCount = deliveries.filter((d) => d.status === "delivered").length;
  const successRate = deliveries.length > 0 ? (completedCount / deliveries.length) * 100 : 0;

  // Chart Data Processing
  const timeSeriesData = useMemo(() => {
    if (deliveries.length === 0) return [];
    
    // Group by day for the last X days or selected interval
    const groups: Record<string, { date: string, rawDate: Date, total: number, commission: number, count: number }> = {};
    
    deliveries.forEach(d => {
      const dateStr = format(new Date(d.created_at), "dd/MM");
      if (!groups[dateStr]) {
        groups[dateStr] = { 
          date: dateStr, 
          rawDate: new Date(d.created_at), 
          total: 0, 
          commission: 0, 
          count: 0 
        };
      }
      groups[dateStr].total += Number(d.value ?? 0);
      groups[dateStr].commission += Number((d as any).commission ?? 0);
      groups[dateStr].count += 1;
    });

    return Object.values(groups).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [deliveries]);

  const companyBreakdown = useMemo(() => {
    const map: Record<string, { name: string; companyId: string; revenue: number; count: number }> = {};
    deliveries.forEach(d => {
      const cId = d.company_id || "unknown";
      const cName = (d as any).companies?.name || "Sem empresa";
      if (!map[cId]) map[cId] = { name: cName, companyId: cId, revenue: 0, count: 0 };
      map[cId].revenue += Number(d.value ?? 0);
      map[cId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [deliveries]);

  const driverBreakdown = useMemo(() => {
    const map: Record<string, { name: string; driverId: string; revenue: number; count: number }> = {};
    deliveries.forEach(d => {
      if (!d.driver_id) return;
      const driver = (drivers ?? []).find(dr => dr.id === d.driver_id);
      const name = driver?.full_name || `Motorista ${d.driver_id.slice(0, 6)}`;
      if (!map[d.driver_id]) map[d.driver_id] = { name, driverId: d.driver_id, revenue: 0, count: 0 };
      map[d.driver_id].revenue += Number(d.value ?? 0);
      map[d.driver_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [deliveries, drivers]);

  const statusData = useMemo(() => {
    const stats: Record<string, number> = {};
    deliveries.forEach(d => {
      stats[d.status] = (stats[d.status] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [deliveries]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCompanyFilter("");
    setDriverFilter("");
    setStatusFilter("all");
    setSearchQuery("");
    setRegionFilter("");
    setPaymentFilter("");
    setMinVal("");
    setMaxVal("");
  };

  const handleQuickPeriod = (period: "today" | "yesterday" | "7days" | "month" | "last_month") => {
    const today = new Date();
    if (period === "today") {
      const dayStr = format(today, "yyyy-MM-dd");
      setDateFrom(dayStr);
      setDateTo(dayStr);
    } else if (period === "yesterday") {
      const yesterday = subDays(today, 1);
      const dayStr = format(yesterday, "yyyy-MM-dd");
      setDateFrom(dayStr);
      setDateTo(dayStr);
    } else if (period === "7days") {
      const sevenDaysAgo = subDays(today, 7);
      setDateFrom(format(sevenDaysAgo, "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
    } else if (period === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(format(firstDay, "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
    } else if (period === "last_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(format(firstDay, "yyyy-MM-dd"));
      setDateTo(format(lastDay, "yyyy-MM-dd"));
    }
  };

  const handleExport = () => {
    if (deliveries.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }
    const headers = ["Data", "Cliente", "Empresa", "Endereço", "Status", "Valor", "Comissão"];
    const rows = deliveries.map((d) => [
      format(new Date(d.created_at), "dd/MM/yyyy HH:mm"),
      d.customer_name,
      (d as any).companies?.name || "",
      d.address,
      d.status,
      Number(d.value ?? 0).toFixed(2),
      Number((d as any).commission ?? 0).toFixed(2),
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!" });
  };

  return (
    <AdminLayout title="Financeiro / Relatórios" subtitle="Análise de dados e exportação">
      {/* Filters */}
      <div className="bg-card/40 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Filtros Avançados</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Refine os dados do relatório</p>
            </div>
          </div>
          <button 
            onClick={clearFilters}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 self-end sm:self-auto"
          >
            Limpar Filtros
          </button>
        </div>

        {/* Quick Periods */}
        <div className="flex flex-wrap items-center gap-2 mb-6 pb-6 border-b border-white/10">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">Período Rápido:</span>
          {[
            { id: "today", label: "Hoje" },
            { id: "yesterday", label: "Ontem" },
            { id: "7days", label: "Últimos 7 Dias" },
            { id: "month", label: "Este Mês" },
            { id: "last_month", label: "Mês Passado" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handleQuickPeriod(p.id as any)}
              className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
            >
              {p.label}
            </button>
          ))}
        </div>
        
        <div className="space-y-4">
          {/* Row 1: Search and Partners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1"><Search className="w-3 h-3" /> Buscar Geral</label>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cliente, ID ou Endereço..."
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Empresa</label>
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none">
                <option value="">Todas as Empresas</option>
                {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Entregador</label>
              <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none">
                <option value="">Todos os Entregadores</option>
                {(drivers ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name || "—"}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Região de Entrega</label>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none">
                <option value="">Todas as Regiões</option>
                {(regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name} (R$ {Number(r.price).toFixed(2)})</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Date, Status, Payment and Values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Data início</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Data fim</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none">
                <option value="all">Todos os Status</option>
                <option value="delivered">Finalizadas</option>
                <option value="cancelled">Canceladas</option>
                <option value="pending">Pendentes</option>
                <option value="in_transit">Em Trânsito</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Forma de Pagamento</label>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner appearance-none">
                <option value="">Todas as Formas</option>
                <option value="pix">Pix</option>
                <option value="card">Cartão</option>
                <option value="cash">Dinheiro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Valor Mínimo (R$)</label>
              <input type="number" min="0" placeholder="0.00" value={minVal} onChange={(e) => setMinVal(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Valor Máximo (R$)</label>
              <input type="number" min="0" placeholder="999.00" value={maxVal} onChange={(e) => setMaxVal(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-4">
        <SummaryCard 
          label="Total de Corridas" 
          value={deliveries.length} 
          icon={<div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><BarChart3 className="h-6 w-6" /></div>}
          subValue={`${completedCount} finalizadas`}
          trend={`${successRate.toFixed(1)}% taxa de sucesso`}
        />
        <SummaryCard 
          label="Faturamento Total" 
          value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} 
          icon={<div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success shadow-inner"><Download className="h-6 w-6 rotate-180" /></div>}
          subValue="Receita bruta processada"
          trend="+5.2% vs período anterior"
        />
        <SummaryCard 
          label="Comissões Estimadas" 
          value={`R$ ${totalCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} 
          icon={<div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center text-warning shadow-inner"><Download className="h-6 w-6" /></div>}
          subValue="Lucro operacional líquido"
          trend="8.5% do faturamento"
        />
        <SummaryCard 
          label="Ticket Médio" 
          value={`R$ ${(deliveries.length > 0 ? totalValue / deliveries.length : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} 
          icon={<div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center text-info shadow-inner"><Filter className="h-6 w-6" /></div>}
          subValue="Valor médio por entrega"
        />
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Main Revenue Chart */}
        <div className="lg:col-span-2 bg-card rounded-3xl p-6 border border-border shadow-xl min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Tendência de Faturamento</h3>
              <p className="text-xs text-muted-foreground mt-1">Volume financeiro diário</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
               <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary" /> Faturamento</div>
               <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary/30" /> Comissões</div>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "16px", border: "1px solid hsl(var(--border))", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                  itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                  formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, ""]}
                />
                <Area type="monotone" dataKey="total" name="Faturamento" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                <Area type="monotone" dataKey="commission" name="Comissão" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 4" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-card rounded-3xl p-6 border border-border shadow-xl flex flex-col">
          <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">Status Operacional</h3>
          <p className="text-xs text-muted-foreground mb-8">Distribuição de corridas</p>
          
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] || "#8884d8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-foreground">{deliveries.length}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Total</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name as keyof typeof STATUS_COLORS] }} />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">{STATUS_LABELS[s.name as keyof typeof STATUS_LABELS] || s.name}</span>
                </div>
                <span className="text-xs font-black text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown by Company */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-card rounded-3xl p-6 border border-border shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Breakdown por Empresa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Receita e volume por empresa</p>
            </div>
          </div>
          {companyBreakdown.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto scrollbar-thin">
              {companyBreakdown.map((c, i) => {
                const maxRev = companyBreakdown[0].revenue;
                const pct = maxRev > 0 ? (c.revenue / maxRev) * 100 : 0;
                return (
                  <div key={c.companyId || i} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
                        <span className="text-sm font-bold text-foreground truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground font-semibold">{c.count} entregas</span>
                        <span className="text-sm font-black text-foreground">R$ {c.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
          )}
        </div>

        {/* Breakdown by Driver */}
        <div className="bg-card rounded-3xl p-6 border border-border shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center text-success">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Breakdown por Motorista</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Entregas e ganhos por entregador</p>
            </div>
          </div>
          {driverBreakdown.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto scrollbar-thin">
              {driverBreakdown.map((d, i) => {
                const maxCount = driverBreakdown[0].count;
                const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                return (
                  <div key={d.driverId || i} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${i < 3 ? "bg-warning/20 text-warning" : "bg-muted/50 text-muted-foreground"}`}>{i + 1}</span>
                        <span className="text-sm font-bold text-foreground truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground font-semibold">{d.count} entregas</span>
                        <span className="text-sm font-black text-foreground">R$ {d.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-success/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
          )}
        </div>
      </div>

      <div className="bg-card/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden mb-12">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
             <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
             </div>
             <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Detalhamento Financeiro</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{deliveries.length} registros encontrados</p>
             </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Carregando dados...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] p-6">Data / ID</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] p-6">Cliente & Empresa</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] p-6 hidden lg:table-cell">Endereço de Entrega</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] p-6">Status</th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] p-6">Financeiro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deliveries.slice(0, 50).map((d) => (
                  <tr key={d.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="p-6">
                      <p className="text-xs font-bold text-foreground">{format(new Date(d.created_at), "dd/MM/yyyy")}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60">#{d.id.split("-")[0]}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground leading-tight">{d.customer_name}</span>
                            <span className="text-[11px] font-medium text-primary mt-0.5">{(d as any).companies?.name || "Marketplace"}</span>
                         </div>
                      </div>
                    </td>
                    <td className="p-6 hidden lg:table-cell">
                       <p className="text-xs text-muted-foreground max-w-[200px] truncate leading-relaxed">{d.address}</p>
                    </td>
                    <td className="p-6">
                       <StatusBadge status={d.status} />
                    </td>
                    <td className="p-6 text-right">
                      <p className="text-sm font-black text-foreground">R$ {Number(d.value ?? 0).toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 tracking-widest uppercase">Comissão: R$ {Number((d as any).commission ?? 0).toFixed(2)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

const STATUS_COLORS = {
  pending: "hsl(var(--warning))",
  broadcasted: "hsl(var(--info))",
  accepted: "hsl(var(--info))",
  collecting: "hsl(var(--accent))",
  in_transit: "hsl(var(--primary))",
  delivered: "#22c55e",
  completed: "#22c55e",
  cancelled: "#ef4444",
  returned: "#6b7280",
};

const STATUS_LABELS = {
  pending: "Pendente",
  broadcasted: "Enviada",
  accepted: "Aceita",
  collecting: "Coletando",
  in_transit: "Em Trânsito",
  delivered: "Finalizada",
  completed: "Finalizada",
  cancelled: "Cancelada",
  returned: "Devolvida",
};

function SummaryCard({ label, value, icon, subValue, trend }: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  subValue?: string;
  trend?: string;
}) {
  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/10 hover:border-primary/20 transition-all group overflow-hidden relative">
      <div className="absolute -right-2 -top-2 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all pointer-events-none" />
      <div className="flex items-start justify-between mb-4">
        {icon}
        {trend && (
          <div className="px-2.5 py-1 rounded-full bg-success/10 text-[9px] font-black text-success uppercase tracking-wider">
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1.5">{label}</p>
        <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
        {subValue && <p className="text-xs font-medium text-muted-foreground/60 mt-1">{subValue}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "hsl(var(--muted))";
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
  
  return (
    <span 
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-current shadow-sm"
      style={{ color, backgroundColor: `${color}15` }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
