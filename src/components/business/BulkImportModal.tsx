import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Info, Copy, Check, Upload, Trash2, Save } from "lucide-react";

interface ImportedProduct {
  name: string;
  category: string;
  price: number;
  description: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export function BulkImportModal({ isOpen, onClose, onSuccess, companyId }: BulkImportModalProps) {
  const [pastedText, setPastedText] = useState("");
  const [parsedData, setParsedData] = useState<ImportedProduct[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPastedText(e.target.value);
  };

  const processPastedText = () => {
    if (!pastedText.trim()) return;

    setIsParsing(true);
    try {
      const lines = pastedText.split(/\r?\n/).filter(l => l.trim() !== "");
      
      const newProducts: ImportedProduct[] = [];
      
      for (const line of lines) {
        // Separa por tabulação (Excel/Google Sheets)
        let columns = line.split("\t");
        
        // Se não houver tabulação, tentar separar por ponto e vírgula ou pipe (|)
        if (columns.length === 1) {
          if (line.includes("|")) {
            columns = line.split("|");
          } else if (line.includes(";")) {
            columns = line.split(";");
          }
        }

        // Precisamos de pelo menos nome e preço
        if (columns.length >= 2) {
          const name = columns[0]?.trim();
          let category = columns[1]?.trim();
          let priceStr = "";
          let description = "";

          if (columns.length === 2) {
            priceStr = columns[1]?.trim();
            category = "Outros";
          } else if (columns.length === 3) {
            priceStr = columns[2]?.trim();
          } else {
            priceStr = columns[2]?.trim();
            description = columns[3]?.trim();
          }

          // Ignorar cabeçalho se houver
          if (name.toLowerCase() === "nome" && priceStr.toLowerCase().includes("preço")) continue;

          // Limpar preço (remover R$, formatar vírgulas)
          const cleanPrice = priceStr.replace(/[^\d.,]/g, "").replace(",", ".");
          const price = parseFloat(cleanPrice);

          if (name && !isNaN(price)) {
            newProducts.push({
              name,
              category: category || "Outros",
              price,
              description: description || ""
            });
          }
        }
      }

      if (newProducts.length > 0) {
        setParsedData(newProducts);
        toast.success(`${newProducts.length} produtos identificados!`);
      } else {
        toast.error("Não foi possível identificar os produtos no texto colado.");
      }
    } catch (e) {
      toast.error("Erro ao processar dados.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (parsedData.length === 0) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Obter o maior sort_order atual para adicionar no fim
      const { data: existing } = await supabase
        .from("products")
        .select("sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: false })
        .limit(1);
        
      let nextSortOrder = (existing?.[0]?.sort_order || 0) + 1;

      const payload = parsedData.map(p => ({
        company_id: companyId,
        user_id: user.id,
        name: p.name,
        category: p.category,
        price: p.price,
        description: p.description || null,
        image_url: "[]", // Inicializa sem fotos
        sort_order: nextSortOrder++,
      }));

      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;

      toast.success(`${parsedData.length} produtos importados com sucesso!`);
      setParsedData([]);
      setPastedText("");
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar no banco de dados.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 border-b bg-muted/30">
          <DialogTitle className="text-2xl font-black text-foreground">Importação em Lote</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Copie os dados da sua planilha (Excel, Google Sheets) e cole na caixa abaixo.
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {parsedData.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 text-sm text-primary/80">
                <Info className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Formato esperado das colunas:</p>
                  <p className="mt-1 font-mono bg-background px-2 py-1 rounded inline-block text-xs border">Nome | Categoria | Preço | Descrição (Opcional)</p>
                </div>
              </div>

              <Textarea 
                placeholder="Cole os dados aqui..." 
                className="min-h-[250px] font-mono text-sm resize-none"
                value={pastedText}
                onChange={handlePasteChange}
              />

              <Button 
                onClick={processPastedText} 
                disabled={!pastedText.trim() || isParsing}
                className="w-full h-12 rounded-xl"
              >
                <Copy className="h-4 w-4 mr-2" />
                Processar Dados Colados
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex gap-3 text-sm">
                <Info className="h-5 w-5 flex-shrink-0 text-amber-600" />
                <p>
                  <strong>Aviso Importante:</strong> Esses produtos serão importados <strong>sem foto</strong>. Lembre-se de editá-los depois pelo painel para adicionar as imagens e evitar que eles fiquem sem destaque no aplicativo.
                </p>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.category}</TableCell>
                        <TableCell>R$ {p.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <button 
                            onClick={() => setParsedData(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setParsedData([])}
                  className="flex-1 h-12"
                >
                  Voltar e Colar Novamente
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar {parsedData.length} Produtos
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
