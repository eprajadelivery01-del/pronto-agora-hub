import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Printer, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PrintableInvoiceDialog({
  isOpen,
  onClose,
  invoice
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}) {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoice) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: compData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', invoice.company_id)
          .single();
        
        setCompany(compData);

        const startDate = new Date(invoice.period_start + "T00:00:00").toISOString();
        const endDate = new Date(invoice.period_end + "T23:59:59").toISOString();

        // Busca corridas do lojista
        const { data: delData } = await supabase
          .from('deliveries')
          .select('*')
          .eq('company_id', invoice.company_id)
          .eq('status', 'completed')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: true });

        if (delData) setDeliveries(delData);

        // Busca comissões dos pedidos
        const { data: ordData } = await supabase
          .from('orders')
          .select('id, created_at, total, delivery_fee, status, items')
          .eq('company_id', invoice.company_id)
          .eq('status', 'delivered')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: true });

        if (ordData) setOrders(ordData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const commissionRate = Number(company?.commission_percentage || 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden">
        {/* Header de controles - Não aparece na impressão */}
        <div className="sticky top-0 bg-background border-b z-10 flex justify-between items-center p-4 print:hidden shadow-sm">
          <h2 className="text-lg font-bold">Detalhamento da Fatura</h2>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="p-8 bg-white text-black print-only print:p-0">
            {/* Cabeçalho da Fatura */}
            <div className="grid grid-cols-3 gap-4 border-b-2 border-gray-200 pb-6 mb-6">
              {/* Dados da Plataforma */}
              <div className="text-left">
                <p className="font-bold text-xl text-gray-900">É Pra Já Delivery</p>
                <p className="text-sm text-gray-600">Gestão Logística e Tecnologia</p>
                <p className="text-sm text-gray-500 mt-1">contato@eprajadelivery.com</p>
              </div>

              {/* Título e Dados da Fatura */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Fatura Comercial</h1>
                <div className="mt-3 text-sm text-gray-600 space-y-1">
                  <p><span className="font-semibold text-gray-800">Ref:</span> {invoice.reference_month}</p>
                  <p><span className="font-semibold text-gray-800">Período:</span> {new Date(invoice.period_start + "T00:00:00").toLocaleDateString('pt-BR')} a {new Date(invoice.period_end + "T23:59:59").toLocaleDateString('pt-BR')}</p>
                  <p><span className="font-semibold text-gray-800">Status:</span> {invoice.status === 'paid' ? 'Pago' : 'Aberto/Pendente'}</p>
                </div>
              </div>

              {/* Dados do Cliente */}
              <div className="text-right">
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Faturado para</h3>
                <p className="font-bold text-lg text-gray-900 mt-1">{company?.name || '—'}</p>
                <p className="text-sm text-gray-600 mt-1">{company?.cnpj ? `CNPJ: ${company.cnpj}` : ''}</p>
                <p className="text-sm text-gray-600">{company?.address || ''}</p>
                <p className="text-sm text-gray-600">{company?.city}{company?.city && company?.state ? ' - ' : ''}{company?.state}</p>
              </div>
            </div>

            {/* Total em destaque */}
            <div className="mb-6 flex justify-end">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-right min-w-[220px]">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total a Pagar</p>
                <p className="text-2xl font-bold text-gray-900">R$ {Number(invoice.total_amount).toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-2 font-medium">Vencimento: A combinar</p>
              </div>
            </div>

            {/* Tabela de Valores - Mensalidade */}
            <h3 className="font-bold text-lg mb-3 border-b pb-1">Resumo dos Valores</h3>
            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <th className="p-3 text-left">Descrição</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 font-medium">Mensalidade (Plataforma)</td>
                  <td className="p-3 text-right">R$ {Number(invoice.subscription_amount).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Comissões & Entregas</td>
                  <td className="p-3 text-right">R$ {Number(invoice.deliveries_amount).toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold text-base">
                  <td className="p-3 text-right text-gray-600 uppercase text-xs">Total:</td>
                  <td className="p-3 text-right text-gray-900">R$ {Number(invoice.total_amount).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Detalhamento de Corridas */}
            {deliveries.length > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-lg mb-3 border-b pb-1 text-gray-800">Detalhamento das Entregas Logísticas ({deliveries.length})</h3>
                <table className="w-full text-xs text-left text-gray-600">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 border-b">Data</th>
                      <th className="p-2 border-b">Destino</th>
                      <th className="p-2 border-b text-right">Valor do Frete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deliveries.map(del => (
                      <tr key={del.id} className="hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap">{new Date(del.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="p-2 truncate max-w-[300px]">{del.dropoff_address || del.delivery_address}</td>
                        <td className="p-2 text-right font-medium text-gray-900">R$ {Number(del.value).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="p-2 text-right font-bold text-gray-700">Total Entregas Logísticas:</td>
                      <td className="p-2 text-right font-bold text-gray-900">
                        R$ {deliveries.reduce((sum, del) => sum + (Number(del.value) || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Detalhamento de Comissões */}
            {orders.length > 0 && commissionRate > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-lg mb-3 border-b pb-1 text-gray-800">Detalhamento de Comissões de Venda ({commissionRate}% por pedido)</h3>
                <table className="w-full text-xs text-left text-gray-600">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 border-b">Data / Pedido</th>
                      <th className="p-2 border-b text-right">Total Pedido</th>
                      <th className="p-2 border-b text-right">Frete</th>
                      <th className="p-2 border-b text-right">Base Calc.</th>
                      <th className="p-2 border-b text-right text-primary">Comissão ({commissionRate}%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map(ord => {
                      const orderValue = (Number(ord.total) || 0) - (Number(ord.delivery_fee) || 0);
                      const commissionValue = orderValue * (commissionRate / 100);
                      return (
                        <tr key={ord.id} className="hover:bg-gray-50">
                          <td className="p-2 whitespace-nowrap">{new Date(ord.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="p-2 text-right">R$ {Number(ord.total).toFixed(2)}</td>
                          <td className="p-2 text-right">R$ {Number(ord.delivery_fee).toFixed(2)}</td>
                          <td className="p-2 text-right text-gray-500">R$ {orderValue.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-primary">R$ {commissionValue.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="p-2 text-right font-bold text-gray-700">Total Comissões:</td>
                      <td className="p-2 text-right font-bold text-primary">
                        R$ {orders.reduce((sum, ord) => {
                          const orderValue = (Number(ord.total) || 0) - (Number(ord.delivery_fee) || 0);
                          return sum + (orderValue * (commissionRate / 100));
                        }, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {invoice.notes && (
              <div className="mt-8 border-t pt-4">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Observações:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            <div className="mt-12 text-center text-xs text-gray-400 border-t pt-4">
              Gerado pelo sistema É Pra Já - {new Date().toLocaleString('pt-BR')}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
