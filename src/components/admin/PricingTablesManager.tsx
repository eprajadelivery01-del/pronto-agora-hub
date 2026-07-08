import { useState, useMemo } from "react";
import { usePricingTables, usePricingRules, useCreatePricingTable, useDeletePricingTable, useUpsertPricingRule } from "@/services/pricing";
import { useRegions } from "@/services/regions";
import { Loader2, Plus, AlertCircle, ChevronDown, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminFeeModal } from "./AdminFeeModal";

export function PricingTablesManager() {
  const { data: tables, isLoading: isLoadingTables } = usePricingTables();
  const { data: regions } = useRegions();
  const createTable = useCreatePricingTable();
  const upsertRule = useUpsertPricingRule();
  const { toast } = useToast();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);

  const { data: rules, isLoading: isLoadingRules } = usePricingRules(selectedTableId);

  const [originFilter, setOriginFilter] = useState("");
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return;
    try {
      const newTable = await createTable.mutateAsync({ name: newTableName, is_default: false });
      setNewTableName("");
      setIsCreating(false);
      setSelectedTableId(newTable.id);
      toast({ title: "Tabela criada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const allPairs = useMemo(() => {
    if (!regions) return [];
    let pairs: { origin: any, dest: any }[] = [];
    for (const o of regions) {
      if (originFilter && !o.name.toLowerCase().includes(originFilter.toLowerCase())) {
        continue;
      }
      for (const d of regions) {
        pairs.push({ origin: o, dest: d });
      }
    }
    return pairs;
  }, [regions, originFilter]);

  const handleValueChange = (originId: string, destId: string, value: string) => {
    const key = `${originId}-${destId}`;
    // Apenas permite números e vírgula
    if (/^[\d,]*$/.test(value)) {
      setLocalValues(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleBlur = async (originId: string, destId: string) => {
    if (!selectedTableId) return;
    const key = `${originId}-${destId}`;
    const valueStr = localValues[key];
    if (valueStr === undefined || valueStr === "") return; 
    
    const numValue = parseFloat(valueStr.replace(',', '.'));
    if (isNaN(numValue)) return;

    try {
      await upsertRule.mutateAsync({
        pricing_table_id: selectedTableId,
        origin_region_id: originId,
        destination_region_id: destId,
        base_value: numValue,
        return_value: 0
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const getValue = (originId: string, destId: string) => {
    const key = `${originId}-${destId}`;
    if (localValues[key] !== undefined) return localValues[key];
    const existingRule = rules?.find(r => r.origin_region_id === originId && r.destination_region_id === destId);
    if (existingRule) return existingRule.base_value.toString().replace('.', ',');
    return "";
  };

  const handleReplicate = (originId: string, destId: string) => {
    const valStr = getValue(originId, destId);
    if (!valStr) return;
    const numValue = parseFloat(valStr.replace(',', '.'));
    if (isNaN(numValue)) return;
    
    if (!regions || !selectedTableId) return;
    
    for (const r of regions) {
      if (r.id !== destId) {
         setLocalValues(prev => ({ ...prev, [`${originId}-${r.id}`]: valStr }));
         upsertRule.mutate({
           pricing_table_id: selectedTableId,
           origin_region_id: originId,
           destination_region_id: r.id,
           base_value: numValue,
           return_value: 0
         });
      }
    }
    toast({ title: "Valor replicado para todos os destinos desta origem." });
  };

  if (isLoadingTables) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  const selectedTable = tables?.find(t => t.id === selectedTableId);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-background">
      {/* Sidebar with tables */}
      <div className="w-full md:w-80 border-r border-border bg-card p-4 flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground">Tabelas de Preço</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsFeeModalOpen(true)} 
              title="Taxa Fixa Admin por Loja"
              className="p-2 bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/20"
            >
              <DollarSign className="h-4 w-4" />
            </button>
            <button onClick={() => setIsCreating(true)} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isCreating && (
          <div className="mb-4 p-3 bg-muted rounded-xl space-y-2">
            <input
              autoFocus
              placeholder="Nome da Tabela"
              value={newTableName}
              onChange={e => setNewTableName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-border text-sm outline-none font-medium"
            />
            <div className="flex gap-2">
              <button onClick={() => setIsCreating(false)} className="flex-1 py-1.5 text-xs font-bold border border-border rounded text-muted-foreground hover:bg-background">Cancelar</button>
              <button onClick={handleCreateTable} disabled={createTable.isPending} className="flex-1 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded hover:bg-primary/90">Salvar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {tables?.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTableId(t.id)}
              className={`w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between ${selectedTableId === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
            >
              <span className="font-semibold text-sm">{t.name} {t.is_default && "(Padrão)"}</span>
            </button>
          ))}
          {tables?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tabela criada.</p>}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto bg-background/50">
        {selectedTable ? (
          <div className="max-w-5xl space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Configurar preço por região:</h2>
              <input 
                type="text"
                placeholder="Buscar por origem..."
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="w-full px-4 py-3 rounded border border-blue-200 focus:border-blue-500 outline-none font-medium bg-white"
              />
            </div>

            <div className="bg-white border border-border rounded shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="p-4 text-sm font-bold text-foreground">Origem</th>
                    <th className="p-4 text-sm font-bold text-foreground">Destino</th>
                    <th className="p-4 text-sm font-bold text-foreground w-48">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingRules ? (
                    <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
                  ) : allPairs.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nenhuma região encontrada.</td></tr>
                  ) : (
                    allPairs.map(({ origin, dest }) => (
                      <tr key={`${origin.id}-${dest.id}`} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 text-sm font-bold text-foreground uppercase">{origin.name}</td>
                        <td className="p-4 text-sm font-bold text-foreground uppercase">{dest.name}</td>
                        <td className="p-4 align-top space-y-2">
                          <input 
                            type="text" 
                            value={getValue(origin.id, dest.id)}
                            onChange={(e) => handleValueChange(origin.id, dest.id, e.target.value)}
                            onBlur={() => handleBlur(origin.id, dest.id)}
                            className="w-32 px-3 py-2 rounded border border-border outline-none focus:border-primary text-sm font-medium"
                            placeholder="0,00"
                          />
                          <button 
                            onClick={() => handleReplicate(origin.id, dest.id)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:bg-muted"
                          >
                            Replicar <ChevronDown className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <AlertCircle className="h-12 w-12 opacity-20" />
            <p>Selecione uma tabela ao lado para configurar os preços.</p>
          </div>
        )}
      </div>

      <AdminFeeModal open={isFeeModalOpen} onOpenChange={setIsFeeModalOpen} />
    </div>
  );
}
