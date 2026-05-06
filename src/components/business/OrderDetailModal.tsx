import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  ShoppingBag, User, MapPin, Phone, Clock, DollarSign, 
  CheckCircle2, AlertCircle, X, Printer, ArrowRight, ArrowLeft, Trash2,
  Package, ImagePlus, Loader2, RotateCcw, Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import DeliveryTrackingMap from "./DeliveryTrackingMap";

interface OrderDetailModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onAdvance?: (orderId: string, nextStatus: string) => void;
  updateStatus?: (orderId: string, status: any) => Promise<void>;
  onStatusUpdate?: () => void;
}

export default function OrderDetailModal({ 
  order, 
  isOpen, 
  onClose, 
  onAdvance,
  updateStatus,
  onStatusUpdate
}: OrderDetailModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string | null, phone: string | null} | null>(null);

  useEffect(() => {
    if (isOpen && order?.id) {
       // Fetch Items
       if (order.items && order.items.length > 0) {
         setItems(order.items);
       } else if (order.order_items && order.order_items.length > 0) {
         setItems(order.order_items);
       } else {
         fetchItems();
       }

       // Fetch Customer Info if generic
       fetchCustomerDetails();
    }
  }, [isOpen, order?.id, order?.customer_id]);

  const fetchCustomerDetails = async () => {
    if (!order?.customer_id) return;
    
    // Check if we already have good data
    const existingName = order.customer?.name || order.customer_name;
    const isGeneric = !existingName || existingName === "Cliente Marketplace" || existingName === "Consumidor";
    
    if (!isGeneric) {
      setCustomerInfo({
        name: existingName,
        phone: order.customer?.phone || order.customer_phone
      });
      return;
    }

    try {
      console.log("[OrderDetailModal] Buscando dados reais do cliente em Profiles...");
      
      // Tentativa 1: Perfis (ID ou User ID)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, phone, user_id")
        .or(`id.eq.${order.customer_id},user_id.eq.${order.customer_id}`)
        .maybeSingle() as { data: any };
      
      if (profile && profile.id) {
        setCustomerInfo({ name: profile.id, phone: profile.phone });
        return;
      }

      // Tentativa 2: Tabela de Entregas (Muitas vezes tem o nome digitado no checkout)
      console.log("[OrderDetailModal] Perfil não encontrado ou genérico. Buscando na tabela de Entregas...");
      const { data: delivery } = await supabase
        .from("deliveries")
        .select("customer_name, customer_phone")
        .eq("company_id", order.company_id)
        .or(`id.eq.${order.delivery_id},notes.ilike.%${order.id.slice(-6)}%`)
        .maybeSingle();

      if (delivery && delivery.customer_name) {
        setCustomerInfo({ name: delivery.customer_name, phone: delivery.customer_phone });
      }
    } catch (err) {
      console.error("[OrderDetailModal] Erro ao buscar dados complementares:", err);
    }
  };

  const fetchItems = async () => {
    if (!order?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          *,
          products (id, name, image_url, description)
        `)
        .eq("order_id", order.id);
      
      if (data) setItems(data);
      if (error) console.error("[OrderDetailModal] Erro ao buscar itens:", error);
    } finally {
      setLoading(false);
    }
  };

  const parseImages = (imageUrl: string | null): string[] => {
    if (!imageUrl) return [];
    try {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      if (imageUrl.startsWith("http")) return [imageUrl];
    }
    return [];
  };

  if (!order) return null;

  const statusMap: Record<string, { label: string, color: string, next?: string, nextLabel?: string, prev?: string, prevLabel?: string }> = {
    pending: { label: "Novo Pedido", color: "bg-amber-500 text-white shadow-lg", next: "preparing", nextLabel: "Aceitar Pedido" },
    accepted: { label: "Aceito", color: "bg-indigo-500 text-white shadow-lg", next: "preparing", nextLabel: "Começar Preparo", prev: "pending", prevLabel: "Voltar para Novos" },
    preparing: { label: "Em Preparo", color: "bg-blue-500 text-white shadow-lg", next: "ready", nextLabel: "Marcar como Pronto", prev: "pending", prevLabel: "Voltar para Novos" },
    ready: { label: "Pronto", color: "bg-emerald-500 text-white shadow-lg", next: "ready", nextLabel: "Chamar Entregador", prev: "preparing", prevLabel: "Voltar para Preparo" },
    in_route: { label: "Em Rota", color: "bg-purple-500 text-white shadow-lg", next: "completed", nextLabel: "Concluir Pedido", prev: "ready", prevLabel: "Voltar para Pronto" },
    completed: { label: "Concluído", color: "bg-emerald-600 text-white shadow-lg" },
    delivered: { label: "Entregue", color: "bg-emerald-600 text-white shadow-lg" },
    cancelled: { label: "Cancelado", color: "bg-rose-500 text-white shadow-lg" }
  };

  const status = statusMap[order.status] || { label: order.status, color: "bg-muted", next: undefined, nextLabel: undefined, prev: undefined, prevLabel: undefined };
  
  const handleAdvance = () => {
    if (status.next) {
      if (onAdvance) {
        onAdvance(order.id, status.next);
      } else if (updateStatus) {
        updateStatus(order.id, status.next).then(() => {
          onStatusUpdate?.();
        });
      }
    }
  };

  const handlePrev = () => {
    if (status.prev) {
      if (onAdvance) {
        onAdvance(order.id, status.prev);
      } else if (updateStatus) {
        updateStatus(order.id, status.prev).then(() => {
          onStatusUpdate?.();
        });
      }
    }
  };

  const handleCancel = async () => {
    if (confirm("Deseja cancelar este pedido?")) {
      if (onAdvance) {
        onAdvance(order.id, "cancelled");
      } else if (updateStatus) {
        await updateStatus(order.id, "cancelled");
        onStatusUpdate?.();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl bg-white text-foreground selection:bg-primary/10 flex flex-col max-h-[95vh]">
        <DialogDescription className="sr-only">Detalhes completos do pedido, itens e valores.</DialogDescription>
        
        {/* Header Ultra-Compacto */}
        <div className="bg-primary/95 backdrop-blur-3xl px-5 py-4 relative overflow-hidden text-white shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <ShoppingBag className="w-32 h-32 rotate-12" />
            </div>
            
            <DialogHeader className="relative z-10">
                <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                        <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border-none", status.color)}>
                            {status.label}
                        </div>
                        <span className="text-white/60 text-[10px] font-bold leading-none">
                          Há {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)} min
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-4 text-left bg-white/10 p-3 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-lg font-black tracking-tight text-white m-0 leading-none">
                          #{order.id?.slice(-6).toUpperCase() || "..."}
                        </DialogTitle>
                        <div className="h-4 w-px bg-white/20" />
                        <div className="text-white/90 font-bold text-xs flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 opacity-70" />
                            {customerInfo?.name || order.customer?.name || order.customer_name || "Cliente"}
                            <span className="text-white/50 text-[9px] font-medium ml-1">({customerInfo?.phone || order.customer?.phone || order.customer_phone || "S/N"})</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/90 max-w-xs">
                        <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <p className="text-xs font-bold truncate">
                            {order.customer?.address || order.delivery_address || order.address || "Endereço não informado"}
                        </p>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar bg-white/95">
            {/* Tracking Map Section */}
            {order.delivery_id && (
              <div className="mb-8">
                 <div className="flex items-center justify-between mb-3 px-1">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40 flex items-center gap-2">
                     <Truck className="h-4 w-4 text-primary" />
                     Acompanhamento da Entrega
                   </h3>
                   <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase animate-pulse">Tempo Real</span>
                 </div>
                 <DeliveryTrackingMap 
                    deliveryId={order.delivery_id} 
                    driverId={order.deliveries?.driver_id || order.deliveryInfo?.driver_id}
                    destinationAddress={order.delivery_address || order.address}
                 />
              </div>
            )}

            {/* Items List */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-foreground/40 uppercase tracking-[0.3em] text-[10px] flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" /> composição do pedido
                    </h3>
                    <div className="h-px flex-1 mx-6 bg-border/40" />
                    <span className="font-black text-[10px] text-primary bg-primary/5 px-4 py-2 rounded-full tracking-widest">
                      {items.length} ITENS
                    </span>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando itens...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-6 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/60">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
                        <div className="text-center px-6">
                            <p className="text-sm font-black text-foreground/60 uppercase tracking-[0.1em]">Nenhum item detectado</p>
                            <button onClick={fetchItems} className="mt-4 px-8 py-3 rounded-2xl bg-primary text-white text-[10px] font-black uppercase">Recarregar agora</button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {items.map((item, idx) => {
                            const images = parseImages(item.products?.image_url);
                            const mainImage = images[0];
                            return (
                                <div key={idx} className="flex gap-4 items-start p-4 rounded-[1.25rem] bg-white border border-border/40 hover:border-primary/20 hover:shadow-md transition-all group">
                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-muted overflow-hidden shrink-0 border border-border/50">
                                        {mainImage ? (
                                            <img src={mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.product_name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                                                <ImagePlus className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-3">
                                            <div>
                                              <p className="font-bold text-foreground text-sm leading-tight">{item.product_name || item.products?.name || "Produto"}</p>
                                              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Un: R$ {item.price?.toFixed(2).replace('.', ',')}</p>
                                              
                                              {/* Descrição do Produto */}
                                              {item.products?.description && (
                                                <p className="text-sm text-foreground/80 mt-2 leading-relaxed bg-muted/40 p-4 rounded-xl border border-border/50 italic">
                                                  {item.products.description}
                                                </p>
                                              )}

                                              {/* Detalhes/Ingredientes/Observações */}
                                              {(item.choices || item.notes || item.observation) && (
                                                <div className="mt-2 space-y-1">
                                                  {item.choices && (
                                                    <p className="text-[10px] text-foreground/80 leading-snug bg-muted/50 px-2 py-1 rounded-md">
                                                      <span className="font-bold text-foreground/90">Opções:</span> {
                                                        typeof item.choices === 'string' ? item.choices : 
                                                        Array.isArray(item.choices) ? item.choices.map((c:any) => c.name || c).join(', ') :
                                                        JSON.stringify(item.choices)
                                                      }
                                                    </p>
                                                  )}
                                                  {(item.notes || item.observation) && (
                                                    <p className="text-[10px] text-warning-foreground bg-warning/10 px-2 py-1 rounded-md inline-block leading-snug mt-1">
                                                      <span className="font-bold">Obs:</span> {item.notes || item.observation}
                                                    </p>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                              <p className="text-[10px] font-black text-primary uppercase mb-0.5 bg-primary/10 px-1.5 py-0.5 rounded-md">{item.quantity}x</p>
                                              <p className="font-black text-base text-foreground mt-1">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {order.notes && (
               <div className="p-6 bg-warning/5 border border-warning/10 rounded-[2rem] space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-warning flex items-center gap-2">
                   <AlertCircle className="h-3 w-3" /> Observações do Cliente
                 </p>
                 <p className="text-sm font-medium italic text-foreground/80">"{order.notes}"</p>
               </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 md:p-8 border-t border-border flex flex-wrap gap-4 items-center justify-between bg-muted/10 shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.print()} 
                className="h-12 w-12 rounded-xl bg-white border border-border flex items-center justify-center hover:bg-muted transition-all text-muted-foreground print:hidden shadow-sm"
                title="Imprimir Pedido"
              >
                 <Printer className="h-5 w-5" />
              </button>
              <div className="flex flex-col text-left">
                 <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total do Pedido</p>
                 <p className="text-2xl font-black text-primary italic leading-none mt-0.5">R$ {order.total?.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>

            <div className="flex gap-3 flex-1 md:flex-none print:hidden">
                {order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'delivered' && (
                  <button 
                    onClick={handleCancel}
                    className="h-12 w-12 rounded-xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all shadow-sm"
                    title="Cancelar Pedido"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="px-6 h-12 rounded-xl border border-border bg-white text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all"
                >
                  Fechar
                </button>
                {status.prev && (
                  <button 
                    onClick={handlePrev}
                    className="px-5 h-12 rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 group/btn"
                    title={status.prevLabel}
                  >
                    <RotateCcw className="h-3 w-3 group-hover/btn:-rotate-45 transition-transform" />
                    <span className="hidden md:inline text-[9px] font-black uppercase tracking-widest">{status.prevLabel}</span>
                  </button>
                )}
                {status.next && (
                  <button 
                    onClick={handleAdvance}
                    className="flex-1 md:flex-none px-8 h-12 rounded-xl bg-foreground text-background font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg shadow-foreground/10 flex items-center justify-center gap-2"
                  >
                    {status.nextLabel} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
            </div>
        </div>

        {/* Global Print Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 0; padding: 0; background: white; width: 80mm; }
            body * { visibility: hidden; }
            .DialogContent { 
              visibility: visible !important; 
              position: absolute !important; 
              left: 0 !important; top: 0 !important; 
              width: 80mm !important;
              max-height: none !important;
              padding: 5mm !important;
              display: block !important;
              background: white !important;
            }
            .DialogContent * { visibility: visible !important; }
            .print\\:hidden, button { display: none !important; }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
