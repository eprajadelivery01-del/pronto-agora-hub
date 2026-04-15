import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ShoppingBag, User, MapPin, Phone, Clock, DollarSign, 
  CheckCircle2, AlertCircle, X, Printer, ArrowRight, Trash2 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderDetailModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onAdvance?: (orderId: string, nextStatus: string) => void;
}

export default function OrderDetailModal({ order, isOpen, onClose, onAdvance }: OrderDetailModalProps) {
  if (!order) return null;

  const statusMap: Record<string, { label: string, color: string, next?: string, nextLabel?: string }> = {
    pending: { label: "Novo Pedido", color: "text-white bg-amber-500 shadow-lg shadow-amber-500/20", next: "preparing", nextLabel: "Aceitar Pedido" },
    accepted: { label: "Aceito", color: "text-white bg-indigo-500 shadow-lg shadow-indigo-500/20", next: "preparing", nextLabel: "Começar Preparo" },
    preparing: { label: "Em Preparo", color: "text-primary bg-white shadow-lg", next: "ready", nextLabel: "Marcar como Pronto" },
    ready: { label: "Pronto", color: "text-white bg-emerald-500 shadow-lg shadow-emerald-500/20", next: "in_route", nextLabel: "Chamar Entregador" },
    in_route: { label: "Em Rota", color: "text-white bg-purple-500 shadow-lg shadow-purple-500/20", next: "completed", nextLabel: "Concluir Pedido" },
    completed: { label: "Concluído", color: "text-white bg-emerald-600 shadow-lg" },
    delivered: { label: "Entregue", color: "text-white bg-emerald-600 shadow-lg" },
    cancelled: { label: "Cancelado", color: "text-white bg-rose-500 shadow-lg" }
  };

  const status = statusMap[order.status] || { label: order.status, color: "bg-muted", next: undefined, nextLabel: undefined };
  const items = order.order_items || order.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-[2.5rem] bg-card shadow-2xl">
        <div className="flex flex-col h-[85vh] md:h-auto max-h-[90vh]">
          {/* Header */}
          <div className="p-6 pb-4 bg-primary text-white relative overflow-hidden shrink-0">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative flex justify-between items-start mb-4">
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-1">
                  Pedido #{order.id.slice(-6).toUpperCase()}
                </DialogTitle>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest opacity-80">
                   <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                   <span className="w-1 h-1 rounded-full bg-white/40" />
                   <span className="flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> R$ {order.total?.toFixed(2)}</span>
                </div>
              </div>
              
              <div className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl", status.color)}>
                 {status.label}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
               <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-3 border border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                     <User className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Comprador</p>
                     <p className="text-sm font-bold truncate leading-none">
                        {order.customer?.name || order.customer_name || "Cliente Marketplace"}
                     </p>
                  </div>
               </div>
               
               <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-3 border border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                     <MapPin className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Entrega</p>
                     <p className="text-sm font-bold truncate leading-none">
                        {order.customer?.address || order.delivery_address || order.address || "Endereço não disponível."}
                     </p>
                  </div>
               </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-4 space-y-8 custom-scrollbar">

            {/* Items Section */}
            <div className="space-y-4 bg-muted/30 rounded-[2rem] p-6 border border-border/50">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Itens do Pedido ({items.length})</h4>
               <div className="space-y-3">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-card/50 rounded-2xl p-4 border border-border/40">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-black text-xs">
                             {item.quantity}x
                          </div>
                          <div>
                             <p className="text-sm font-bold text-foreground">{item.products?.name || item.product_name || "Produto"}</p>
                             <p className="text-[10px] text-muted-foreground font-medium">Un: R$ {item.price?.toFixed(2)}</p>
                          </div>
                       </div>
                       <p className="font-black text-foreground">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                    </div>
                  ))}
               </div>
               {order.notes && (
                  <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-2xl">
                     <p className="text-[10px] font-black uppercase tracking-widest text-warning mb-1 flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" /> Observações do Cliente
                     </p>
                     <p className="text-sm text-foreground font-medium italic">"{order.notes}"</p>
                  </div>
               )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-8 bg-muted/20 border-t border-border flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()} 
                  className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground print:hidden" 
                  title="Imprimir Pedido"
                >
                   <Printer className="h-5 w-5" />
                </button>
                <div className="h-10 w-px bg-border mx-2 print:hidden" />
                <div className="flex flex-col">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground print:text-black">Total do Pedido</p>
                   <p className="text-2xl font-black text-primary italic leading-none print:text-black">R$ {order.total?.toFixed(2).replace('.', ',')}</p>
                </div>
             </div>

             <div className="flex gap-2 min-w-full md:min-w-0 print:hidden">
                 {order.status !== 'cancelled' && order.status !== 'completed' && (
                    <button 
                      onClick={() => {
                        if (confirm("Deseja cancelar este pedido?")) {
                          onAdvance?.(order.id, "cancelled");
                        }
                      }}
                      className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all mr-2"
                      title="Cancelar Pedido"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                 )}
                <button 
                  onClick={onClose}
                  className="px-6 h-14 rounded-2xl border border-border text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all"
                >
                  Fechar
                </button>
                {status.next && (
                  <button 
                    onClick={() => onAdvance?.(order.id, status.next!)}
                    className="flex-1 md:flex-none px-10 h-14 rounded-2xl bg-foreground text-background font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl shadow-foreground/10 flex items-center justify-center gap-3"
                  >
                    {status.nextLabel} <ArrowRight className="h-4 w-4" />
                  </button>
                )}
             </div>
          </div>
        </div>

        {/* Global Print Styles */}
         <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 0; padding: 0; background: white; width: 80mm; }
            body * { visibility: hidden; }
            .print\\:hidden { display: none !important; }
            .DialogContent, [role="dialog"] { 
              visibility: visible !important; 
              position: absolute !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 5mm !important;
              border: none !important;
              box-shadow: none !important;
              display: block !important;
            }
            .DialogContent * { visibility: visible !important; }
            .DialogContent .max-h-\\[90vh\\] { max-height: none !important; height: auto !important; overflow: visible !important; }
            .custom-scrollbar { overflow: visible !important; height: auto !important; max-height: none !important; }
            button { display: none !important; }
            .bg-muted\\/20, .bg-muted\\/30, .bg-card, .bg-card\\/50 { background-color: transparent !important; background: transparent !important; border: 1px solid #000 !important; }
            .text-3xl { font-size: 1.5rem !important; }
            .text-lg { font-size: 1rem !important; }
            .text-primary, .text-foreground, .text-muted-foreground { color: black !important; }
            .rounded-[2.5rem], .rounded-2xl, .rounded-xl { border-radius: 0 !important; }
            .p-8, .p-6, .px-8 { padding: 4mm !important; }
            .gap-6 { gap: 2mm !important; }
            .flex-row { flex-direction: column !important; }
            .grid-cols-2 { grid-template-columns: 1fr !important; }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
