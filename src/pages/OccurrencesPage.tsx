import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDrivers } from "@/services/drivers";
import { useToast } from "@/hooks/use-toast";

const typeLabels: Record<string, string> = {
  motorcycle_issue: "Problema na Moto",
  accident: "Acidente",
  robbery: "Assalto",
  other: "Outro",
};

function useOccurrences() {
  return useQuery({
    queryKey: ["occurrences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_occurrences")
        .select("*, delivery_drivers!delivery_occurrences_driver_id_fkey(id, profiles:user_id(full_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useUpdateOccurrenceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("delivery_occurrences")
        .update({ resolved: status === "resolved", resolved_at: status === "resolved" ? new Date().toISOString() : null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
  });
}

function useCreateOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (occ: { type: string; description: string; driver_id: string; delivery_id?: string }) => {
      const { error } = await (supabase as any).from("delivery_occurrences").insert([{
        type: occ.type as any,
        description: occ.description,
        driver_id: occ.driver_id,
        delivery_id: occ.delivery_id || "00000000-0000-0000-0000-000000000000",
      }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
  });
}

export default function OccurrencesPage() {
  const { data: occurrences, isLoading } = useOccurrences();
  const updateStatus = useUpdateOccurrenceStatus();
  const createOcc = useCreateOccurrence();
  const { data: drivers } = useDrivers();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ type: "other", description: "", driver_id: "" });

  const handleCreate = async () => {
    if (!form.driver_id || !form.description) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    try {
      await createOcc.mutateAsync({ type: form.type as "motorcycle_issue" | "accident" | "robbery" | "other", description: form.description, driver_id: form.driver_id });
      toast({ title: "Ocorrência registrada!" });
      setCreateOpen(false);
      setForm({ type: "other", description: "", driver_id: "" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "open" ? "resolved" : "open";
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
      toast({ title: `Ocorrência ${newStatus === "resolved" ? "resolvida" : "reaberta"}!` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Ocorrências" subtitle="Relatos e incidentes dos entregadores">
      <div className="flex items-center justify-between mb-6">
        <div />
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Registrar Ocorrência
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(occurrences ?? []).map((occ) => {
            const driverName = (occ as any).delivery_drivers?.profiles?.full_name || "—";
            return (
              <div key={occ.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      !(occ as any).resolved ? "bg-destructive/10" : "bg-success/10"
                    )}>
                      <AlertTriangle className={cn("h-5 w-5", !(occ as any).resolved ? "text-destructive" : "text-success")} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground">{typeLabels[(occ as any).type] || (occ as any).type}</span>
                        <button
                          onClick={() => toggleStatus(occ.id, (occ as any).resolved ? "resolved" : "open")}
                          disabled={updateStatus.isPending}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                            !(occ as any).resolved ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                          )}
                        >
                          {!(occ as any).resolved ? <Clock className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                          {!(occ as any).resolved ? "Aberta" : "Resolvida"}
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{(occ as any).description}</p>
                      <p className="text-xs text-muted-foreground">
                        Entregador: <span className="font-medium text-foreground">{driverName}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date((occ as any).created_at), "dd/MM/yyyy")}
                  </span>
                </div>
              </div>
            );
          })}
          {(occurrences ?? []).length === 0 && (
            <div className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada</p>
            </div>
          )}
        </div>
      )}

      {/* Create occurrence dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Registrar Ocorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-foreground">Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
              >
                <option value="delay">Atraso</option>
                <option value="damage">Dano</option>
                <option value="absence">Ausência</option>
                <option value="other">Outro</option>            
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-foreground">Entregador *</label>
              <select
                value={form.driver_id}
                onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione...</option>
                {(drivers ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.profiles?.full_name || "—"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-foreground">Descrição *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva a ocorrência..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={createOcc.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createOcc.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
