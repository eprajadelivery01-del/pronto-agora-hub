import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2 } from "lucide-react";
import { useCompanies } from "@/services/companies";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface AdminFeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminFeeModal({ open, onOpenChange }: AdminFeeModalProps) {
  const { data: companies, isLoading, refetch } = useCompanies();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Record<string, boolean>>({});
  const [feeValues, setFeeValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (open && companies) {
      // Initialize state with current DB values
      const initialSelected: Record<string, boolean> = {};
      const initialFees: Record<string, string> = {};
      companies.forEach((c: any) => {
        if (c.admin_delivery_fee !== null && c.admin_delivery_fee !== undefined) {
          initialSelected[c.id] = true;
          initialFees[c.id] = c.admin_delivery_fee.toString().replace('.', ',');
        }
      });
      setSelectedCompanies(initialSelected);
      setFeeValues(initialFees);
      setSearchTerm("");
    }
  }, [open, companies]);

  const filteredCompanies = companies?.filter((c: any) => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && c.is_active !== false
  ) || [];

  const handleToggle = (companyId: string, checked: boolean) => {
    setSelectedCompanies(prev => ({ ...prev, [companyId]: checked }));
    if (!checked) {
      setFeeValues(prev => {
        const next = { ...prev };
        delete next[companyId];
        return next;
      });
    }
  };

  const handleFeeChange = (companyId: string, value: string) => {
    if (/^[\d,]*$/.test(value)) {
      setFeeValues(prev => ({ ...prev, [companyId]: value }));
    }
  };

  const handleSave = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSaving(true);
    try {
      const updates = [];
      
      // We need to update all active companies that are selected, and clear those that were deselected
      for (const comp of (companies || [])) {
        if (comp.is_active === false) continue;
        
        const isSelected = selectedCompanies[comp.id];
        const feeStr = feeValues[comp.id];
        let numValue: number | null = null;
        
        if (isSelected && feeStr) {
          numValue = parseFloat(feeStr.replace(',', '.'));
          if (isNaN(numValue)) numValue = null;
        }

        // Only update if it changed
        const currentDbVal = comp.admin_delivery_fee !== undefined ? comp.admin_delivery_fee : null;
        if (currentDbVal !== numValue) {
           updates.push(
             supabase.from('companies').update({ admin_delivery_fee: numValue }).eq('id', comp.id)
           );
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        await refetch();
        toast({ title: "Valores salvos com sucesso!" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Taxa Fixa Admin por Empresa</DialogTitle>
          <DialogDescription>
            Selecione as empresas e defina o valor fixo que o sistema cobrará delas por cada entrega.
            Se marcado, este valor substituirá a Matriz de Preços na hora do acerto.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4 mt-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar empresa..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">Nenhuma empresa encontrada.</div>
          ) : (
            <div className="space-y-3">
              {filteredCompanies.map((comp: any) => (
                <div key={comp.id} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
                  <Checkbox 
                    id={`comp-${comp.id}`}
                    checked={!!selectedCompanies[comp.id]}
                    onCheckedChange={(c) => handleToggle(comp.id, !!c)}
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`comp-${comp.id}`} className="font-bold cursor-pointer line-clamp-1">
                      {comp.name}
                    </Label>
                    <p className="text-xs text-muted-foreground line-clamp-1">{comp.city || 'Sem cidade'}</p>
                  </div>
                  {selectedCompanies[comp.id] && (
                    <div className="flex items-center gap-2 w-32">
                      <span className="text-sm font-bold text-muted-foreground">R$</span>
                      <Input 
                        placeholder="0,00"
                        value={feeValues[comp.id] || ""}
                        onChange={(e) => handleFeeChange(comp.id, e.target.value)}
                        className="h-8 text-right font-medium"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
