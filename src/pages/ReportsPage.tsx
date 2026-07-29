import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDeliveries } from "@/services/deliveries";
import { useCompanies } from "@/services/companies";
import { useDrivers } from "@/services/drivers";
import { useRegions } from "@/services/regions";
import { BarChart3, Download, Loader2, Filter, Search, Printer } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getDeliveryValue, formatDeliveryValue } from "@/lib/delivery";
import { useMemo } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  assigned: "Atribuída",
  in_transit: "Em Rota",
  delivered: "Finalizada",
  completed: "Finalizada (Marketplace)",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308", // warning
  assigned: "#3b82f6", // info
  in_transit: "#8b5cf6", // violet
  delivered: "#22c55e", // success
  completed: "#10b981", // emerald
  cancelled: "#ef4444", // destructive
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "#8884d8";
  return (
    <span style={{ backgroundColor: color + "20", color: color }} className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
      {label}
    </span>
  );
}

function SummaryCard({ label, value, icon, subValue, trend }: { label: string, value: string | number, icon: React.ReactNode, subValue?: string, trend?: string }) {
  return (
    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-black text-foreground">{value}</div>
        {(subValue || trend) && (
          <div className="flex items-center justify-between mt-3">
            {subValue && <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{subValue}</span>}
            {trend && <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">{trend}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const getOrderTotal = (d: any) => {
  if (d.orders) {
    if (Array.isArray(d.orders) && d.orders.length > 0 && d.orders[0].total != null) {
      return Number(d.orders[0].total);
    }
    if (d.orders.total != null) {
      return Number(d.orders.total);
    }
  }
  // Try to use estimated_value if available and > 0
  if (d.estimated_value != null && Number(d.estimated_value) > 0) {
    return Number(d.estimated_value);
  }
  return 0;
};

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
      if (minVal && getDeliveryValue(d) < Number(minVal)) return false;
      if (maxVal && getDeliveryValue(d) > Number(maxVal)) return false;
      return true;
    });
  }, [rawDeliveries, regionFilter, paymentFilter, minVal, maxVal]);

  const validDeliveries = useMemo(() => deliveries.filter(d => d.status === "delivered" || d.status === "completed"), [deliveries]);

  const totalValue = validDeliveries.reduce((s, d) => s + getOrderTotal(d), 0);
  const totalCommission = validDeliveries.reduce((s, d) => s + Number((d as any).commission ?? 0), 0);
  const completedCount = validDeliveries.length;
  const successRate = deliveries.length > 0 ? (completedCount / deliveries.length) * 100 : 0;
  const ticketMedio = completedCount > 0 ? totalValue / completedCount : 0;

  // Chart Data Processing
  const timeSeriesData = useMemo(() => {
    if (deliveries.length === 0) return [];
    
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
      const isCompleted = d.status === "delivered" || d.status === "completed";
      if (isCompleted) {
        groups[dateStr].total += getOrderTotal(d);
        groups[dateStr].commission += Number((d as any).commission ?? 0);
      }
      groups[dateStr].count += 1;
    });

    return Object.values(groups).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [deliveries]);

  const companyBreakdown = useMemo(() => {
    const map: Record<string, { name: string; companyId: string; revenue: number; count: number }> = {};
    deliveries.forEach(d => {
      const isCompleted = d.status === "delivered" || d.status === "completed";
      if (!isCompleted) return;

      const cId = d.company_id || "unknown";
      const cName = (d as any).companies?.name || "Sem empresa";
      if (!map[cId]) map[cId] = { name: cName, companyId: cId, revenue: 0, count: 0 };
      map[cId].revenue += getOrderTotal(d);
      map[cId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [deliveries]);

  const driverBreakdown = useMemo(() => {
    const map: Record<string, { name: string; driverId: string; revenue: number; count: number }> = {};
    deliveries.forEach(d => {
      const isCompleted = d.status === "delivered" || d.status === "completed";
      if (!isCompleted) return;

      if (!d.driver_id) return;
      const driver = (drivers ?? []).find(dr => dr.id === d.driver_id);
      const name = driver?.full_name || `Motorista ${d.driver_id.slice(0, 6)}`;
      if (!map[d.driver_id]) map[d.driver_id] = { name, driverId: d.driver_id, revenue: 0, count: 0 };
      map[d.driver_id].revenue += getDeliveryValue(d);
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
      formatDeliveryValue(d),
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

  const handlePrint = () => {
    if (deliveries.length === 0) {
      toast({ title: "Nenhum dado para imprimir", variant: "destructive" });
      return;
    }

    // Build active filters description
    const filterLines: string[] = [];
    if (dateFrom || dateTo) filterLines.push(`Período: ${dateFrom || "início"} até ${dateTo || "hoje"}`);
    if (companyFilter) {
      const co = (companies ?? []).find(c => c.id === companyFilter);
      if (co) filterLines.push(`Empresa: ${co.name}`);
    }
    if (driverFilter) {
      const dr = (drivers ?? []).find(d => d.id === driverFilter);
      if (dr) filterLines.push(`Entregador: ${dr.full_name}`);
    }
    if (regionFilter) {
      const rg = (regions ?? []).find(r => r.id === regionFilter);
      if (rg) filterLines.push(`Região: ${rg.name}`);
    }
    if (statusFilter && statusFilter !== "all") filterLines.push(`Status: ${STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS] || statusFilter}`);
    if (paymentFilter) filterLines.push(`Pagamento: ${paymentFilter}`);
    if (minVal) filterLines.push(`Valor mín.: R$ ${minVal}`);
    if (maxVal) filterLines.push(`Valor máx.: R$ ${maxVal}`);
    if (searchQuery) filterLines.push(`Busca: "${searchQuery}"`);

    // Company billing rows
    const companyBillingRows = companyBreakdown.map(c => {
      const companyObj = (companies ?? []).find(co => co.id === c.companyId);
      const commPct = companyObj?.commission_percentage !== undefined && companyObj?.commission_percentage !== null
        ? Number(companyObj.commission_percentage) : 10.00;
      const totalDue = c.revenue * (commPct / 100);
      return `
        <tr>
          <td>${c.name}</td>
          <td style="text-align:center">${c.count}</td>
          <td style="text-align:right">R$ ${c.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td style="text-align:center">${commPct.toFixed(1)}%</td>
          <td style="text-align:right;font-weight:900;color:#6366f1">R$ ${totalDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }).join("");

    // Driver billing rows
    const driverBillingRows = driverBreakdown.map(d => {
      const driverObj = (drivers ?? []).find(dr => dr.id === d.driverId);
      const commRate = driverObj?.commission_rate !== undefined && driverObj?.commission_rate !== null
        ? Number(driverObj.commission_rate) : 0.40;
      const totalDue = d.count * commRate;
      return `
        <tr>
          <td>${d.name}</td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:right">R$ ${d.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td style="text-align:right">R$ ${commRate.toFixed(2).replace(".", ",")}</td>
          <td style="text-align:right;font-weight:900;color:#6366f1">R$ ${totalDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }).join("");

    // Delivery detail rows (ALL records, no limit)
    const deliveryRows = deliveries.map(d => `
      <tr>
        <td>${format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}</td>
        <td>${d.customer_name || "—"}</td>
        <td>${(d as any).companies?.name || "Marketplace"}</td>
        <td style="max-width:200px;overflow:hidden">${d.address || "—"}</td>
        <td style="text-align:center">${STATUS_LABELS[d.status as keyof typeof STATUS_LABELS] || d.status}</td>
        <td style="text-align:right;font-weight:700">R$ ${formatDeliveryValue(d)}</td>
        <td style="text-align:right">R$ ${Number((d as any).commission ?? 0).toFixed(2)}</td>
      </tr>`).join("");

    const totalCompanyDue = companyBreakdown.reduce((s, c) => {
      const co = (companies ?? []).find(x => x.id === c.companyId);
      const pct = (co?.commission_percentage !== undefined && co?.commission_percentage !== null)
        ? Number(co.commission_percentage) : 10.00;
      return s + c.revenue * (pct / 100);
    }, 0);

    const totalDriverDue = driverBreakdown.reduce((s, d) => {
      const dr = (drivers ?? []).find(x => x.id === d.driverId);
      const rate = (dr?.commission_rate !== undefined && dr?.commission_rate !== null)
        ? Number(dr.commission_rate) : 0.40;
      return s + d.count * rate;
    }, 0);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Financeiro — É Pra Já</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; padding: 20px; }
    
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 20px; }
    .header-title { font-size: 22px; font-weight: 900; color: #6366f1; letter-spacing: -0.5px; }
    .header-subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
    .header-meta { text-align: right; font-size: 10px; color: #64748b; }
    
    .filters-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .filters-title { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #6366f1; margin-bottom: 6px; }
    .filters-list { color: #475569; line-height: 1.7; }
    
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .kpi-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-bottom: 4px; }
    .kpi-value { font-size: 18px; font-weight: 900; color: #1a1a2e; }
    .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
    
    .section { margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #6366f1; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #6366f1; color: white; }
    thead th { padding: 8px 10px; text-align: left; font-weight: 900; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f0f4ff; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    
    tfoot tr { background: #1e1b4b; color: white; }
    tfoot td { padding: 8px 10px; font-weight: 900; font-size: 10px; }
    
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px; }
    
    @media print {
      body { padding: 10px; font-size: 10px; }
      @page { margin: 15mm; size: A4; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .section { page-break-inside: avoid; }
      .two-col { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">📦 É Pra Já — Relatório Financeiro</div>
      <div class="header-subtitle">Plataforma de Delivery | BONASOFT</div>
    </div>
    <div class="header-meta">
      Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}<br/>
      Total de registros: <strong>${deliveries.length}</strong>
    </div>
  </div>

  ${filterLines.length > 0 ? `
  <div class="filters-box">
    <div class="filters-title">🔍 Filtros Aplicados</div>
    <div class="filters-list">${filterLines.join(" &nbsp;|&nbsp; ")}</div>
  </div>` : ""}

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total de Corridas</div>
      <div class="kpi-value">${deliveries.length}</div>
      <div class="kpi-sub">${completedCount} finalizadas (${successRate.toFixed(1)}% sucesso)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Faturamento Total</div>
      <div class="kpi-value">R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
      <div class="kpi-sub">Receita bruta processada</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Comissões Plataforma</div>
      <div class="kpi-value">R$ ${totalDriverDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
      <div class="kpi-sub">Entregadores</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ticket Médio</div>
      <div class="kpi-value">R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
      <div class="kpi-sub">Valor médio por entrega</div>
    </div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">🏢 Cobrança de Lojistas</div>
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th style="text-align:center">Pedidos</th>
            <th style="text-align:right">Vendas</th>
            <th style="text-align:center">Taxa</th>
            <th style="text-align:right">Devido</th>
          </tr>
        </thead>
        <tbody>${companyBillingRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px">Sem dados</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOTAL DEVIDO (Lojistas)</td>
            <td style="text-align:right">R$ ${totalCompanyDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="section">
      <div class="section-title">🏍️ Cobrança de Entregadores</div>
      <table>
        <thead>
          <tr>
            <th>Entregador</th>
            <th style="text-align:center">Corridas</th>
            <th style="text-align:right">Ganhos</th>
            <th style="text-align:right">Taxa/Entrega</th>
            <th style="text-align:right">Devido</th>
          </tr>
        </thead>
        <tbody>${driverBillingRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px">Sem dados</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOTAL DEVIDO (Entregadores)</td>
            <td style="text-align:right">R$ ${totalDriverDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <div class="section" style="margin-top: 8px">
    <div class="section-title">📋 Detalhamento de Entregas (${deliveries.length} registros)</div>
    <table>
      <thead>
        <tr>
          <th>Data / Hora</th>
          <th>Cliente</th>
          <th>Empresa</th>
          <th>Endereço</th>
          <th style="text-align:center">Status</th>
          <th style="text-align:right">Valor</th>
          <th style="text-align:right">Comissão</th>
        </tr>
      </thead>
      <tbody>${deliveryRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">TOTAIS</td>
          <td style="text-align:right">R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td style="text-align:right">R$ ${totalCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="footer">
    <span>É Pra Já — Plataforma de Delivery | BONASOFT</span>
    <span>Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} — Confidencial</span>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Bloqueio de pop-up detectado", description: "Permita pop-ups para este site e tente novamente.", variant: "destructive" });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
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
                <option value="credit_card">Cartão de Crédito</option>
                <option value="debit_card">Cartão de Débito</option>
                <option value="money">Dinheiro</option>
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
          value={`R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} 
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
                <Area isAnimationActive={false} type="monotone" dataKey="total" name="Faturamento" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                <Area isAnimationActive={false} type="monotone" dataKey="commission" name="Comissão" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 4" fill="transparent" />
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
                  isAnimationActive={false}
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

      {/* Platform Billings Report Section */}
      <div className="bg-card rounded-3xl p-6 border border-border shadow-xl mb-10 animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="text-lg">🪙</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-widest text-left">Cobranças Plataforma &amp; Saldos Devidos</h3>
            <p className="text-xs text-muted-foreground mt-0.5 text-left">Saldos devidos pelos lojistas (% sobre vendas) e entregadores (taxa fixa por entrega)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Lojistas (Merchants) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2 text-left">
              🏢 Cobrança de Lojistas (% sobre Vendas)
            </h4>
            <div className="border border-border rounded-2xl overflow-hidden bg-background/50 divide-y divide-border">
              {companyBreakdown.length > 0 ? (
                companyBreakdown.map((c: any) => {
                  const companyObj = (companies ?? []).find(co => co.id === c.companyId);
                  const commPct = companyObj?.commission_percentage !== undefined && companyObj?.commission_percentage !== null ? Number(companyObj.commission_percentage) : 10.00;
                  const totalDue = c.revenue * (commPct / 100);
                  return (
                    <div key={c.companyId} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-colors">
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                          Vendas: R$ {c.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • Taxa: {commPct.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Devido</p>
                        <p className="text-sm font-black text-primary">R$ {totalDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">Nenhum lojista com movimentação</div>
              )}
            </div>
          </div>

          {/* Entregadores (Drivers) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2 text-left">
              🏍️ Cobrança de Entregadores (Taxa por Entrega)
            </h4>
            <div className="border border-border rounded-2xl overflow-hidden bg-background/50 divide-y divide-border">
              {driverBreakdown.length > 0 ? (
                driverBreakdown.map((d: any) => {
                  const driverObj = (drivers ?? []).find(dr => dr.id === d.driverId);
                  const commRate = driverObj?.commission_rate !== undefined && driverObj?.commission_rate !== null ? Number(driverObj.commission_rate) : 0.40;
                  const totalDue = d.count * commRate;
                  return (
                    <div key={d.driverId} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-colors">
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                          Corridas: {d.count} • Taxa por entrega: R$ {commRate.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Devido</p>
                        <p className="text-sm font-black text-primary">R$ {totalDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">Nenhum entregador com movimentação</div>
              )}
            </div>
          </div>
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
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-foreground text-background text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
            >
              <Printer className="h-4 w-4" /> Imprimir Relatório
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
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
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] p-6">Cliente &amp; Empresa</th>
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
                      <p className="text-sm font-black text-foreground">R$ {formatDeliveryValue(d)}</p>
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
