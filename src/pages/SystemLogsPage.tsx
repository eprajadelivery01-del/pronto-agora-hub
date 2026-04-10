import { AdminLayout } from "@/components/admin/AdminLayout";
import { format } from "date-fns";
import { Bell, Info, AlertCircle, CheckCircle2, Filter, Search } from "lucide-react";
import { useState } from "react";

interface LogEntry {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "info" | "success" | "warning";
  date: Date;
}

export default function SystemLogsPage() {
  const [logs] = useState<LogEntry[]>([
    {
      id: "1",
      title: "Novo Entregador",
      message: "João Silva acabou de se cadastrar via link.",
      time: "5 min atrás",
      type: "info",
      date: new Date(Date.now() - 5 * 60000)
    },
    {
      id: "2",
      title: "Alerta de Região",
      message: "A região 'Centro' atingiu o limite de pedidos.",
      time: "20 min atrás",
      type: "warning",
      date: new Date(Date.now() - 20 * 60000)
    },
    {
      id: "3",
      title: "Sistema Atualizado",
      message: "As novas funções de Chat e Regiões foram ativadas.",
      time: "1 hora atrás",
      type: "success",
      date: new Date(Date.now() - 60 * 60000)
    },
    {
      id: "4",
      title: "Backup Concluído",
      message: "O backup diário do banco de dados foi realizado com sucesso.",
      time: "4 horas atrás",
      type: "success",
      date: new Date(Date.now() - 4 * 3600000)
    },
    {
      id: "5",
      title: "Nova Empresa",
      message: "Lanchonete Teste solicitou ativação de conta.",
      time: "Yesterday",
      type: "info",
      date: new Date(Date.now() - 24 * 3600000)
    }
  ]);

  const [filter, setFilter] = useState("all");

  const filteredLogs = logs.filter(l => filter === "all" || l.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case "warning": return <AlertCircle className="h-4 w-4 text-warning" />;
      case "success": return <CheckCircle2 className="h-4 w-4 text-success" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <AdminLayout title="Histórico do Sistema" subtitle="Logs e notificações de atividades">
      <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar nos logs..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="all">Todos os tipos</option>
              <option value="info">Informação</option>
              <option value="success">Sucesso</option>
              <option value="warning">Alertas</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-6 hover:bg-muted/30 transition-colors flex items-start gap-4">
              <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                log.type === "warning" ? "bg-warning/10" : log.type === "success" ? "bg-success/10" : "bg-primary/10"
              }`}>
                {getIcon(log.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-foreground">{log.title}</h4>
                  <span className="text-xs text-muted-foreground">{format(log.date, "dd/MM/yyyy HH:mm")}</span>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed">{log.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    log.type === "warning" ? "bg-warning/10 text-warning" : log.type === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  }`}>
                    {log.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="p-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
