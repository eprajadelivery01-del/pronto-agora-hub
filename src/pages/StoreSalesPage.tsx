import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { 
  ShoppingBag, Search, Filter, Loader2, Calendar, 
  Store, User, Clock, DollarSign, CheckCircle2, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function StoreSalesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-store-sales", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(`
          *,
          companies (name),
          profiles (full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (dateFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      } else if (dateFilter === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString());
      } else if (dateFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        query = query.gte("created_at", weekAgo.toISOString());
      } else if (dateFilter === "month") {
        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);
        query = query.gte("created_at", firstDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      // Status Filter
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      
      // Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const storeName = order.companies?.name?.toLowerCase() || "";
        const customerName = order.profiles?.full_name?.toLowerCase() || "";
        const idStr = order.id.toLowerCase();
        if (!storeName.includes(term) && !customerName.includes(term) && !idStr.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    if (!filteredOrders) return { total: 0, revenue: 0, delivered: 0 };
    return {
      total: filteredOrders.length,
      revenue: filteredOrders.filter(o => o.status === 'delivered' || o.status === 'completed').reduce((sum, o) => sum + (o.total || 0), 0),
      delivered: filteredOrders.filter(o => o.status === 'delivered' || o.status === 'completed').length,
    };
  }, [filteredOrders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="bg-yellow-500/10 text-yellow-500 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit"><Clock className="w-3.5 h-3.5" /> Pendente</span>;
      case "preparing":
      case "ready":
      case "in_route":
      case "in_transit":
        return <span className="bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Em Andamento</span>;
      case "delivered":
      case "completed":
        return <span className="bg-success/10 text-success px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3.5 h-3.5" /> Entregue</span>;
      case "cancelled":
        return <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit"><XCircle className="w-3.5 h-3.5" /> Cancelado</span>;
      default:
        return <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-lg text-xs font-bold w-fit">{status}</span>;
    }
  };

  return (
    <AdminLayout title="Vendas das Lojas" subtitle="Acompanhe os pedidos do marketplace em tempo real">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">Total de Pedidos</p>
          </div>
          <h3 className="text-3xl font-black text-foreground">{stats.total}</h3>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">Pedidos Entregues</p>
          </div>
          <h3 className="text-3xl font-black text-foreground">{stats.delivered}</h3>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">Receita Bruta (Entregues)</p>
          </div>
          <h3 className="text-3xl font-black text-foreground">
            {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por Loja, Cliente ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-background border border-border rounded-xl text-sm focus:border-primary appearance-none outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="preparing">Em Andamento</option>
              <option value="delivered">Entregues</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-background border border-border rounded-xl text-sm focus:border-primary appearance-none outline-none"
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Este Mês</option>
              <option value="all">Todo o Período</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold text-muted-foreground">Pedido / Data</th>
                <th className="px-6 py-4 font-bold text-muted-foreground">Loja (Vendedor)</th>
                <th className="px-6 py-4 font-bold text-muted-foreground">Cliente</th>
                <th className="px-6 py-4 font-bold text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-bold text-muted-foreground text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Carregando vendas...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <ShoppingBag className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">#{order.id.split('-')[0].toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary" />
                        <span className="font-bold">{order.companies?.name || 'Loja Desconhecida'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{order.profiles?.full_name || 'Cliente'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-foreground">
                        {(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
