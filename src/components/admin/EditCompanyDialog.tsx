import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { useRegions } from "@/services/regions";

interface EditCompanyDialogProps {
  company: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCompanyDialog({ company, open, onOpenChange }: EditCompanyDialogProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: regions } = useRegions();
  const [ownerProfile, setOwnerProfile] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    document: "",
    address: "",
    email: "",
    latitude: "",
    longitude: "",
    regionId: "",
    is_active: true,
  });

  // Reset form when company changes
  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        phone: company.phone || "",
        document: company.document || "",
        address: company.address || "",
        email: company.email || "",
        latitude: company.latitude?.toString() || "",
        longitude: company.longitude?.toString() || "",
        regionId: company.region_id || "",
        is_active: company.is_active ?? true,
      });
      // Fetch owner profile
      if (company.user_id) {
        supabase
          .from("profiles")
          .select("full_name, phone, document, avatar_url")
          .eq("user_id", company.user_id)
          .single()
          .then(({ data }) => {
            if (data) setOwnerProfile(data);
          });
      }
    }
  }, [company]);

  const set = (key: string, val: string | boolean) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name || !form.phone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      if (company.user_id) {
        const { error: pError } = await supabase
          .from("profiles")
          .update({
            document: form.document,
          })
          .eq("id", company.user_id);

        if (pError) throw pError;
      }

      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
          region_id: form.regionId || null,
          is_active: form.is_active,
        })
        .eq("id", company.id);

      if (error) throw error;

      toast.success("Dados da empresa atualizados!");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Editar Empresa
          </DialogTitle>
        </DialogHeader>

        {/* Owner info card */}
        {ownerProfile && (
          <div className="bg-muted/50 rounded-xl p-3 border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Responsável</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {ownerProfile.avatar_url ? (
                  <img src={ownerProfile.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary">
                    {(ownerProfile.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{ownerProfile.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{ownerProfile.phone || "—"} • CPF: {ownerProfile.document || "—"}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div>
            <Label>Nome da Empresa *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>CNPJ/CPF</Label>
              <Input value={form.document} onChange={e => set("document", e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Endereço Completo</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Região</Label>
            <select
              value={form.regionId}
              onChange={e => set("regionId", e.target.value)}
              className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">Sem região</option>
              {(regions ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name} — R$ {Number(r.price).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="-15.5989" className="mt-1.5" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="-56.0974" className="mt-1.5" />
            </div>
          </div>
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set("is_active", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Empresa ativa</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
