import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle, Clock, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PrintableInvoiceDialog } from "@/components/business/PrintableInvoiceDialog";

export default function MerchantInvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Print Dialog
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null);

  const fetchInvoices = async () => {
    setIsLoading(true);
    
    // Get the company for this user
    if (!user) return;
    
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id);
      
    if (!companies || companies.length === 0) {
      setIsLoading(false);
      return;
    }
    
    const companyIds = companies.map(c => c.id);

    const { data } = await supabase
      .from("merchant_invoices")
      .select("*")
      .in("company_id", companyIds)
      .not("sent_at", "is", null)
      .order("created_at", { ascending: false });
      
    if (data) setInvoices(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  return (
    <BusinessLayout title="Minhas Faturas" subtitle="Valores devidos à plataforma">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : invoices.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>Você não possui nenhuma fatura gerada no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoices.map(inv => (
              <Card key={inv.id} className="p-6 flex flex-col justify-between hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Fatura: {inv.reference_month}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gerada em {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {inv.status === 'paid' ? (
                      <span className="inline-flex items-center bg-success/10 text-success px-3 py-1 rounded-full text-xs font-semibold">
                        <CheckCircle className="w-4 h-4 mr-1.5" /> Pago
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-warning/10 text-warning px-3 py-1 rounded-full text-xs font-semibold">
                        <Clock className="w-4 h-4 mr-1.5" /> Aberto
                      </span>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => { setInvoiceToPrint(inv); setIsPrintDialogOpen(true); }}>
                      <Printer className="w-3 h-3 mr-1" /> Ver Fatura
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Mensalidade</span>
                    <span className="font-medium">R$ {Number(inv.subscription_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Entregas Solicitadas</span>
                    <span className="font-medium">R$ {Number(inv.deliveries_amount).toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-border my-2"></div>
                  <div className="flex justify-between items-center text-base font-bold">
                    <span>Total Devido</span>
                    <span className="text-primary">R$ {Number(inv.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {inv.notes && (
                  <div className="mt-4 text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border border-border/50">
                    <span className="font-semibold block mb-1">Observação do Admin:</span>
                    {inv.notes}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <PrintableInvoiceDialog 
        isOpen={isPrintDialogOpen} 
        onClose={() => setIsPrintDialogOpen(false)} 
        invoice={invoiceToPrint} 
      />
    </BusinessLayout>
  );
}
