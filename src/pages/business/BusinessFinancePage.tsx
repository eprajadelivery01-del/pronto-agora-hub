// @ts-nocheck
import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Calendar, RefreshCw, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinanceSummary {
  today: number;
  week: number;
  month: number;
  pending_count: number;
  completed_count: number;
  cancelled_count: number;
}

export default function BusinessFinancePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FinanceSummary>({ today: 0, week: 0, month: 0, pending_count: 0, completed_count: 0, cancelled_count: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
      if (company) setCompanyId(company.id);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (!companyId) return;
    const fetch = async () => {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [todayRes, weekRes, monthRes, recent] = await Promise.all([
        supabase.from("orders").select("total").eq("company_id", companyId).eq("status", "completed").gte("created_at", startOfDay),
        supabase.from("orders").select("total").eq("company_id", companyId).eq("status", "completed").gte("created_at", startOfWeek),
        supabase.from("orders").select("total, status").eq("company_id", companyId).gte("created_at", startOfMonth),
        supabase.from("orders").select("id, total, status, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(15),
      ]);

      const monthData = monthRes.data || [];
      setSummary({
        today: (todayRes.data || []).reduce((s: number, o: any) => s + o.total, 0),
        week: (weekRes.data || []).reduce((s: number, o: any) => s + o.total, 0),
        month: monthData.filter((o: any) => o.status === "completed").reduce((s: number, o: any) => s + o.total, 0),
        completed_count: monthData.filter((o: any) => o.status === "completed").length,
        pending_count: monthData.filter((o: any) => o.status === "pending").length,
        cancelled_count: monthData.filter((o: any) => o.status === "cancelled").length,
      });
      setRecentOrders(recent.data || []);
      setLoading(false);
    };
    fetch();
  }, [companyId]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  if (loading) return (
    <BusinessLayout title="Financeiro">
      <div className="flex items-center justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
    </BusinessLayout>
  );

  return (
    <BusinessLayout title="Financeiro">
      <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
        <div>
          <h2 className="text-2xl font-black text-foreground">Resumo Financeiro</h2>
          <p className="text-muted-foreground text-sm font-medium mt-1">Acompanhe seus ganhos do marketplace</p>
        </div>

        {/* Revenue cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { label: "Hoje", value: summary.today, icon: Calendar, color: "primary" },
            { label: "Últimos 7 dias", value: summary.week, icon: TrendingUp, color: "success" },
            { label: "Este mês", value: summary.month, icon: DollarSign, color: "warning" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-3xl p-6 shadow-card">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                color === "primary" ? "bg-primary/10 text-primary" :
                color === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-3xl font-black text-foreground tracking-tight">{fmt(value)}</p>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Order breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-success">{summary.completed_count}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">Concluídos</p>
          </div>
          <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-warning">{summary.pending_count}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">Pendentes</p>
          </div>
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-destructive">{summary.cancelled_count}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">Cancelados</p>
          </div>
        </div>

        {/* Recent transactions */}
        <div>
          <h3 className="text-lg font-black text-foreground mb-4">Últimas Transações</h3>
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            {recentOrders.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma transação ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-bold text-sm text-foreground">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider",
                        order.status === "completed" ? "bg-success/10 text-success" :
                        order.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      )}>
                        {order.status === "completed" ? "Entregue" : order.status === "cancelled" ? "Cancelado" : "Em andamento"}
                      </span>
                      <p className={cn("font-black text-sm", order.status === "cancelled" ? "text-muted-foreground line-through" : "text-foreground")}>
                        {fmt(order.total || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
}
