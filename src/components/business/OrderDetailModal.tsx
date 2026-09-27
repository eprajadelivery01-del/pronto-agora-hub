import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  ShoppingBag, User, MapPin, Phone, Clock, DollarSign, 
  CheckCircle2, AlertCircle, X, Printer, ArrowRight, ArrowLeft, Trash2,
  Package, ImagePlus, Loader2, RotateCcw, Truck, MessageSquare, Ticket
} from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizeStorageImage } from "@/lib/imageOptimization";
import { supabase } from "@/lib/supabaseClient";
import DeliveryTrackingMap from "./DeliveryTrackingMap";
import { useNavigate } from "react-router-dom";

interface OrderDetailModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onAdvance?: (orderId: string, nextStatus: string) => void;
  updateStatus?: (orderId: string, status: any) => Promise<void>;
  onStatusUpdate?: () => void;
  onDispatch?: () => void;
}

export default function OrderDetailModal({ 
  order, 
  isOpen, 
  onClose, 
  onAdvance,
  updateStatus,
  onStatusUpdate,
  onDispatch
}: OrderDetailModalProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string | null, phone: string | null} | null>(null);
  const [couponDetails, setCouponDetails] = useState<{
    code: string | null;
    discount: number;
    discountType?: string;
  } | null>(null);

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

       // Fetch Coupon info
       fetchCouponDetails();
    }
  }, [isOpen, order?.id, order?.customer_id]);

  const fetchCouponDetails = async () => {
    if (!order?.id) return;
    let extractedCode: string | null = null;
    if (order.notes) {
      const match = order.notes.match(/CUPOM:\s*([A-Za-z0-9_-]+)/i);
      if (match) {
        extractedCode = match[1].toUpperCase();
      }
    }

    try {
      const { data } = await supabase
        .from('user_coupons')
        .select('coupon_id, coupons(code, discount_type, discount_value)')
        .eq('order_id', order.id)
        .maybeSingle();

      if (data && (data as any).coupons) {
        const c = (data as any).coupons;
        setCouponDetails({
          code: c.code || extractedCode,
          discount: 0,
          discountType: c.discount_type,
        });
        return;
      }
    } catch {
      // Silencioso se bloqueado por RLS
    }

    if (extractedCode) {
      setCouponDetails({
        code: extractedCode,
        discount: 0,
      });
    }
  };

  const fetchCustomerDetails = async () => {
    if (!order?.customer_id) return;
    
    // Check if we already have good data
    const existingName = order.customer?.name || order.customer_name;
    const existingPhone = order.customer?.phone || order.customer_phone;
    
    const isGenericName = !existingName || existingName === "Cliente Marketplace" || existingName === "Consumidor";
    const isGenericPhone = !existingPhone || existingPhone === "Não informado";
    
    if (!isGenericName && !isGenericPhone) {
      setCustomerInfo({
        name: existingName,
        phone: existingPhone
      });
      return;
    }

    try {
      console.log("[OrderDetailModal] Buscando dados reais do cliente em Profiles...");
      
      // Tentativa 1: Perfis (ID ou User ID)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, phone, user_id")
        .or(`id.eq.${order.customer_id},user_id.eq.${order.customer_id}`)
        .maybeSingle() as { data: any };
      
      if (profile && profile.id) {
        setCustomerInfo({ name: profile.full_name || profile.id, phone: profile.phone });
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

  /** Adicionais podem vir como array (jsonb) ou como texto JSON. */
  const parseOptions = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    if (typeof raw === "object") return Object.values(raw).filter(Boolean) as any[];
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
    if (order.status === "ready" && onDispatch) {
      onDispatch();
      return;
    }
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

  // Cálculos financeiros e detecção de cupom
  const itemsSub = items?.reduce((acc, curr) => acc + ((curr.price || curr.unit_price || 0) * curr.quantity), 0) || 0;
  const delFee = Number(order.delivery_fee) || 0;
  const ordTotal = order.total != null ? Number(order.total) : (itemsSub + delFee);
  const disc = Math.max(0, (itemsSub + delFee) - ordTotal);
  const activeCouponCode = couponDetails?.code || (order.notes?.match(/CUPOM:\s*([A-Za-z0-9_-]+)/i)?.[1]?.toUpperCase() ?? null);
  const hasCoupon = disc > 0.01 || !!activeCouponCode;

  // Separador de notas inteligente para não esconder nenhuma informação do lojista
  const parseOrderNotes = (rawNotes: string | null) => {
    if (!rawNotes) return { changeNote: null, couponNote: null, otherNotes: null };
    
    let changeNote: string | null = null;
    let couponNote: string | null = null;
    let remaining = rawNotes;

    if (remaining.includes("Troco para R$")) {
      const parts = remaining.split("Troco para R$");
      const changePart = parts[1]?.split("•")[0]?.trim();
      if (changePart) {
        changeNote = `Troco para R$ ${changePart}`;
      }
      remaining = (parts[0] + " " + (parts[1]?.split("•").slice(1).join("•") || "")).trim();
    }

    const couponMatch = remaining.match(/🎟️?\s*CUPOM:\s*([^\s•]+)(\s*\([^)]*\))?/i);
    if (couponMatch) {
      couponNote = couponMatch[0].trim();
      remaining = remaining.replace(couponMatch[0], "").trim();
    }

    const cleanedOthers = remaining
      .split("•")
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== "•")
      .join(" • ");

    return {
      changeNote,
      couponNote,
      otherNotes: cleanedOthers || null,
    };
  };

  const parsedNotes = parseOrderNotes(order.notes);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl bg-background text-foreground selection:bg-primary/10 flex flex-col max-h-[95vh] print:shadow-none print:rounded-none print:overflow-visible">
        <DialogDescription className="sr-only">Detalhes completos do pedido, itens e valores.</DialogDescription>
        
        {/* VISUAL UI (Hidden on Print) */}
        <div className="print:hidden flex flex-col min-h-0 flex-1">
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
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 text-left bg-white/10 dark:bg-black/20 p-3 rounded-2xl border border-white/10">
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

          <div className="flex-1 min-h-0 p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar bg-background">
              {/* Tracking Map Section */}
              {order.delivery_id && (
                <div className="mb-8">
                   <div className="flex items-center justify-between mb-3 px-1">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40 flex items-center gap-2">
                       <Truck className="h-4 w-4 text-primary" />
                       Acompanhamento da Entrega
                     </h3>
                     <span className="text-[9px] font-black text-green-600 bg-green-500/10 px-2 py-1 rounded-lg uppercase animate-pulse">Tempo Real</span>
                   </div>
                   <DeliveryTrackingMap 
                      deliveryId={order.delivery_id} 
                      driverId={order.deliveries?.driver_id || order.deliveryInfo?.driver_id}
                      destinationAddress={order.delivery_address || order.address}
                   />
                </div>
              )}

              {/* Alerta de Cupom de Desconto */}
              {hasCoupon && (
                <div className="p-4 md:p-5 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 rounded-[1.5rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                      <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-sm">
                          Cupom Aplicado
                        </span>
                        {activeCouponCode && (
                          <span className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                            {activeCouponCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 mt-1">
                        O cliente utilizou um cupom no marketplace. O total do pedido já reflete este desconto.
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-500/20 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800/80 dark:text-emerald-300/80 block">
                      Desconto no Pedido
                    </span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      - R$ {disc.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
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
                              const itemOptions = parseOptions(item.options ?? item.selected_options ?? item.addons);
                              return (
                                  <div key={idx} className="flex gap-4 items-start p-4 rounded-[1.25rem] bg-card border border-border/40 hover:border-primary/20 hover:shadow-md transition-all group">
                                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-muted overflow-hidden shrink-0 border border-border/50">
                                          {mainImage ? (
                                              <img src={optimizeStorageImage(mainImage, { width: 160 })} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.product_name} />
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
                                                {(itemOptions.length > 0 || item.choices || item.notes || item.observation) && (
                                                  <div className="mt-2 space-y-1.5">
                                                    {itemOptions.length > 0 && (
                                                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 space-y-1">
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                                                          Adicionais / Complementos:
                                                        </p>
                                                        <div className="space-y-0.5">
                                                          {itemOptions.map((opt: any, optIdx: number) => {
                                                            const optQty = opt.quantity || 1;
                                                            return (
                                                              <div key={optIdx} className="text-xs font-semibold text-foreground flex items-center justify-between">
                                                                <span>
                                                                  <span className="font-bold text-primary mr-1">{optQty}x</span>
                                                                  {opt.name || opt.option_name}
                                                                  {opt.group_name && <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">({opt.group_name})</span>}
                                                                </span>
                                                                {Number(opt.price || 0) > 0 && (
                                                                  <span className="text-muted-foreground font-medium text-[11px]">
                                                                    + R$ {(Number(opt.price) * optQty).toFixed(2).replace('.', ',')}
                                                                  </span>
                                                                )}
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      </div>
                                                    )}

                                                    {item.choices && itemOptions.length === 0 && (
                                                      <p className="text-[10px] text-foreground/80 leading-snug bg-muted/50 px-2 py-1 rounded-md">
                                                        <span className="font-bold text-foreground/90">Opções:</span> {
                                                          typeof item.choices === 'string' ? item.choices : 
                                                          Array.isArray(item.choices) ? item.choices.map((c:any) => c.name || c).join(', ') :
                                                          JSON.stringify(item.choices)
                                                        }
                                                      </p>
                                                    )}
                                                    {(item.notes || item.observation) && (
                                                      <p className="text-[10px] text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 px-2 py-1 rounded-md inline-block leading-snug font-medium">
                                                        <span className="font-bold text-amber-800 dark:text-amber-200">Obs:</span> {item.notes || item.observation}
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

               {(parsedNotes.changeNote || parsedNotes.couponNote || parsedNotes.otherNotes) && (
                  <div className="p-5 md:p-6 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-[2rem] space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" /> Informações de Pagamento e Observações
                    </p>
                    <div className="space-y-2.5">
                      {parsedNotes.changeNote && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xl">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 block mb-0.5">
                            🚨 Pagamento em Dinheiro
                          </span>
                          <span className="text-base font-black text-amber-900 dark:text-amber-200 block">
                            LEVAR {parsedNotes.changeNote.toUpperCase()}
                          </span>
                        </div>
                      )}

                      {parsedNotes.couponNote && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
                            <Ticket className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{parsedNotes.couponNote}</span>
                          </div>
                        </div>
                      )}

                      {parsedNotes.otherNotes && (
                        <div className="p-3 bg-white dark:bg-card border border-border/60 rounded-xl">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-0.5">
                            Instruções do Cliente / Observações
                          </span>
                          <p className="text-sm font-medium text-foreground">
                            {parsedNotes.otherNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
               )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 md:p-8 border-t border-border flex flex-wrap gap-4 items-center justify-between bg-muted/10 shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => window.print()} 
                  className="h-12 w-12 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-all text-muted-foreground print:hidden shadow-sm"
                  title="Imprimir Pedido"
                >
                   <Printer className="h-5 w-5" />
                </button>
                <div className="flex flex-col text-left">
                   <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Valores do Pedido</p>
                   <div>
                     <p className="text-2xl font-black text-primary italic leading-none mt-0.5">
                       R$ {ordTotal.toFixed(2).replace('.', ',')}
                     </p>
                     <div className="text-[11px] font-bold mt-1 space-y-0.5 text-muted-foreground">
                       <p>
                         Subtotal R$ {itemsSub.toFixed(2).replace('.', ',')} + Frete R$ {delFee.toFixed(2).replace('.', ',')}
                       </p>
                       {disc > 0 && (
                         <p className="text-emerald-600 dark:text-emerald-400 font-black">
                           Desconto Cupom {activeCouponCode ? `(${activeCouponCode})` : ''}: - R$ {disc.toFixed(2).replace('.', ',')}
                         </p>
                       )}
                     </div>
                   </div>
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
                    onClick={() => {
                      onClose();
                      navigate(`/business/chat?order_id=${order.id}${order.user_id ? `&customer_id=${order.user_id}` : ''}`);
                    }}
                    className="px-5 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all shadow-sm group/btn"
                    title="Chat com o Cliente"
                  >
                    <MessageSquare className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                    <span className="hidden md:inline text-[9px] font-black uppercase tracking-widest">Chat</span>
                  </button>

                  <button 
                    onClick={onClose}
                    className="px-6 h-12 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all"
                  >
                    Fechar
                  </button>
                  {status.prev && (
                    <button 
                      onClick={handlePrev}
                      className="px-5 h-12 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 group/btn"
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
        </div>

        {/* THERMAL TICKET (Visible ONLY on Print) */}
        <div id="thermal-receipt" className="hidden print-only print:block w-full p-0 bg-white text-black font-mono text-sm leading-snug">
          <div className="text-center border-b border-black pb-2 mb-2 border-dashed">
            <h2 className="font-bold text-xl m-0 p-0">É PRA JÁ DELIVERY</h2>
            <h3 className="font-bold text-lg m-0 p-0 mt-1">PEDIDO #{order.id?.slice(-6).toUpperCase()}</h3>
            <p className="m-0 p-0 text-xs mt-1">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </div>

          <div className="border-b border-black pb-2 mb-2 border-dashed">
            <p className="font-bold uppercase m-0 p-0 mb-1">DADOS DO CLIENTE</p>
            <p className="m-0 p-0">{customerInfo?.name || order.customer?.name || order.customer_name || "Cliente"}</p>
            <p className="m-0 p-0">Tel: {customerInfo?.phone || order.customer?.phone || order.customer_phone || "Não informado"}</p>
            <p className="m-0 p-0 mt-2 font-bold">Endereço de Entrega:</p>
            <p className="m-0 p-0">{order.customer?.address || order.delivery_address || order.address || "Endereço não informado"}</p>
          </div>

          <div className="border-b border-black pb-2 mb-2 border-dashed">
            <p className="font-bold uppercase m-0 p-0 mb-2">ITENS DO PEDIDO</p>
            <table className="w-full text-sm">
              <tbody>
                {items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td className="w-8 align-top font-bold">{item.quantity}x</td>
                      <td className="align-top font-bold pb-1 break-words leading-tight">{item.product_name || item.products?.name || "Produto"}</td>
                      <td className="w-16 align-top text-right whitespace-nowrap">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</td>
                    </tr>
                    {(item.choices || item.notes || item.observation) && (
                      <tr>
                        <td></td>
                        <td colSpan={2} className="text-xs pb-2 italic break-words leading-tight text-black/80">
                          {item.choices && <div className="mb-1">Opções: {typeof item.choices === 'string' ? item.choices : Array.isArray(item.choices) ? item.choices.map((c:any) => c.name || c).join(', ') : JSON.stringify(item.choices)}</div>}
                          {(item.notes || item.observation) && <div>Obs: {item.notes || item.observation}</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {(parsedNotes.changeNote || parsedNotes.couponNote || parsedNotes.otherNotes) && (
             <div className="border-b border-black pb-2 mb-2 border-dashed text-xs">
               <p className="font-bold uppercase m-0 p-0 mb-1">PAGAMENTO / OBSERVAÇÕES</p>
               {parsedNotes.changeNote && (
                 <p className="m-0 p-0 font-bold">
                   DINHEIRO - {parsedNotes.changeNote.toUpperCase()}
                 </p>
               )}
               {parsedNotes.couponNote && (
                 <p className="m-0 p-0 font-bold">
                   {parsedNotes.couponNote.toUpperCase()}
                 </p>
               )}
               {parsedNotes.otherNotes && (
                 <p className="m-0 p-0 italic">
                   OBS: {parsedNotes.otherNotes}
                 </p>
               )}
             </div>
          )}

           <div className="text-right border-b border-black pb-2 mb-2 border-dashed space-y-0.5">
              <p className="text-xs m-0 p-0">SUBTOTAL ITENS: R$ {itemsSub.toFixed(2).replace('.', ',')}</p>
              <p className="text-xs m-0 p-0">TAXA ENTREGA: R$ {delFee.toFixed(2).replace('.', ',')}</p>
              {disc > 0 && (
                <p className="text-xs font-bold m-0 p-0">
                  DESCONTO CUPOM {activeCouponCode ? `(${activeCouponCode})` : ''}: - R$ {disc.toFixed(2).replace('.', ',')}
                </p>
              )}
              <p className="font-bold text-lg m-0 p-0 pt-1">TOTAL A PAGAR: R$ {ordTotal.toFixed(2).replace('.', ',')}</p>
           </div>

          <div className="text-center pt-2 pb-4">
            <p className="text-xs font-bold uppercase">OBRIGADO PELA PREFERÊNCIA!</p>
          </div>
        </div>

        {/* Global Print Styles */}
                <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 0; }
            body, html { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: white !important; 
            }
            
            /* Hide the main app */
            #root { display: none !important; }
            
            /* Reset the portal wrapper so it doesn't center the dialog during print */
            [data-radix-portal] {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Reset the dialog centering transform */
            div[role="dialog"] {
              position: relative !important; left: 0 !important; top: 0 !important;
              transform: none !important;
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }

            /* Hide everything inside the dialog that is not the thermal receipt */
            div[role="dialog"] > *:not(#thermal-receipt) {
              display: none !important;
            }
            
            #thermal-receipt { 
              display: block !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 2mm !important;
              background: white !important;
              color: black !important;
              visibility: visible !important;
            }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}



