import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EditDriverDialogProps {
  driver: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDriverDialog({ driver, open, onOpenChange }: EditDriverDialogProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    fullName: driver?.profiles?.full_name || driver?.full_name || "",
    phone: driver?.profiles?.phone || driver?.phone || "",
    document: driver?.profiles?.document || driver?.document || "",
    vehicleType: driver?.vehicle_type || "motorcycle",
    vehiclePlate: driver?.vehicle_plate || "",
    commission: driver?.commission_rate?.toString() || "10",
  });

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.phone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Update profile
      const { error: pError } = await supabase
        .from("profiles")
        .update({
          full_name: form.fullName,
          phone: form.phone,
          document: form.document,
        })
        .eq("id", driver.user_id);

      if (pError) throw pError;

      // Update driver data
      const { error: dError } = await supabase
        .from("delivery_drivers")
        .update({
          vehicle_type: form.vehicleType,
          vehicle_plate: form.vehiclePlate,
          commission_rate: parseFloat(form.commission),
        })
        .eq("id", driver.id);

      if (dError) throw dError;

      toast.success("Dados do entregador atualizados!");
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar entregador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Entregador: {driver?.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={form.fullName} onChange={e => set("fullName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
              <div>
                <Label>Documento (CPF/CNPJ)</Label>
                <Input value={form.document} onChange={e => set("document", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de veículo</Label>
                <Select value={form.vehicleType} onValueChange={v => set("vehicleType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">🏍️ Moto</SelectItem>
                    <SelectItem value="bicycle">🚲 Bicicleta</SelectItem>
                    <SelectItem value="car">🚗 Carro</SelectItem>
                    <SelectItem value="van">🚐 Van</SelectItem>
                    <SelectItem value="truck">🚛 Caminhão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placa</Label>
                <Input value={form.vehiclePlate} onChange={e => set("vehiclePlate", e.target.value.toUpperCase())} />
              </div>
            </div>
            <div>
              <Label>Comissão (%)</Label>
              <Input type="number" value={form.commission} onChange={e => set("commission", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
