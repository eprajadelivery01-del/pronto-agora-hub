import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ShoppingBag, User, MapPin, Phone, Clock, DollarSign, 
  CheckCircle2, AlertCircle, X, Printer, ArrowRight 
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
    pending: { label: "Novo Pedido", color: "text-warning bg-warning/10", next: "preparing", nextLabel: "Aceitar Pedido" },
    accepted: { label: "Aceito", color: "text-primary bg-primary/10", next: "preparing", nextLabel: "Começar Preparo" },
    preparing: { label: "Em Preparo", color: "text-blue-500 bg-blue-500/10", next: "ready", nextLabel: "Marcar como Pronto" },
    ready: { label: "Pronto", color: "text-green-500 bg-green-500/10", next: "in_route", nextLabel: "Chamar Entregador" },
    in_route: { label: "Em Rota", color: "text-purple-500 bg-purple-500/10", next: "completed", nextLabel: "Concluir Pedido" },
    completed: { label: "Concluído", color: "text-success bg-success/10" },
    delivered: { label: "Entregue", color: "text-success bg-success/10" },
    cancelled: { label: "Cancelado", color: "text-destructive bg-destructive/10" }
  };

  const status = statusMap[order.status] || { label: order.status, color: "bg-muted", next: undefined, nextLabel: undefined };
  const items = order.order_items || order.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-[2.5rem] bg-card shadow-2xl">
        <div className="flex flex-col h-[85vh] md:h-auto max-h-[90vh]">
          {/* Header */}
          <div className="p-8 pb-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
               <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]", status.color)}>
                  {status.label}
               </div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-3xl font-black text-foreground tracking-tight mb-2">
                Pedido #{order.id.slice(-6).toUpperCase()}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                 <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {new Date(order.created_at).toLocaleTimeString()}</span>
                 <span className="h-1 w-1 rounded-full bg-border" />
                 <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> R$ {order.total?.toFixed(2)}</span>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-4 space-y-8 custom-scrollbar">
            {/* Customer Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Cliente</h4>
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                     </div>
                     <div>
                        <p className="text-lg font-bold text-foreground">{order.customers?.name || order.customer_name || "Cliente Marketplace"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                           <Phone className="h-3 w-3" /> {order.customers?.phone || order.customer_phone || "Não informado"}
                        </p>
                     </div>
                  </div>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Endereço de Entrega</h4>
                  <div className="flex items-start gap-3">
                     <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                        <MapPin className="h-6 w-6 text-muted-foreground" />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                           {order.delivery_address || order.address}
                        </p>
                        <button className="text-[10px] font-black text-primary uppercase mt-1 tracking-widest hover:underline">Ver no Mapa</button>
                     </div>
                  </div>
               </div>
            </div>

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
            body * { visibility: hidden; }
            .print\\:hidden { display: none !important; }
            .DialogContent, [role="dialog"] { 
              visibility: visible; 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%;
              margin: 0;
              padding: 0;
              border: none !important;
              box-shadow: none !important;
            }
            .DialogContent * { visibility: visible; }
            .custom-scrollbar { overflow: visible !important; height: auto !important; max-height: none !important; }
            button { display: none !important; }
            .bg-muted\\/20, .bg-muted\\/30 { background-color: transparent !important; border: 1px solid #eee !important; }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
