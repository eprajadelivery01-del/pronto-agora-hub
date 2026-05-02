import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import { useDeliveries, useUpdateDeliveryStatus, useReassignDelivery, type DeliveryWithRelations } from "@/services/deliveries";
import { useCompanies } from "@/services/companies";
import { useDrivers } from "@/services/drivers";
import { useDeliveriesRealtime } from "@/services/realtime";
import {
  Search, Filter, Eye, MoreHorizontal, X as XIcon, ChevronLeft, ChevronRight,
  Loader2, Printer, UserCheck, Package, Radio, Send, MapPin
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { DeliveryStatus } from "@/types/models";

const statusFilters = [
  { label: "Todas", value: "all" },
  { label: "Pendentes", value: "pending" },
  { label: "Enviadas", value: "broadcasted" },
  { label: "Aceitas", value: "accepted" },
  { label: "Em Coleta", value: "collecting" },
  { label: "Em Rota", value: "in_route" },
  { label: "Finalizadas", value: "completed" },
  { label: "Canceladas", value: "cancelled" },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DeliveriesPage() {
  useDeliveriesRealtime();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [detailDelivery, setDetailDelivery] = useState<DeliveryWithRelations | null>(null);
  const [reassignDelivery, setReassignDelivery] = useState<DeliveryWithRelations | null>(null);
  const [dispatchDelivery, setDispatchDelivery] = useState<DeliveryWithRelations | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const { data, isLoading } = useDeliveries({
    status: activeFilter,
    search: search || undefined,
    companyId: companyFilter || undefined,
    driverId: driverFilter || undefined,
    page,
    pageSize,
  });

  const { data: companies } = useCompanies();
  const { data: drivers } = useDrivers();
  const updateStatus = useUpdateDeliveryStatus();
  const reassignMut = useReassignDelivery();

  const deliveries = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const onlineDrivers = (drivers ?? []).filter((d) => d.is_online);

  // Sort drivers by proximity to delivery
  const getDriversSortedByProximity = (delivery: DeliveryWithRelations) => {
    if (!delivery.pickup_latitude || !delivery.pickup_longitude) return onlineDrivers;
    return [...onlineDrivers].sort((a, b) => {
      const distA = a.current_latitude && a.current_longitude
        ? haversineDistance(delivery.pickup_latitude!, delivery.pickup_longitude!, a.current_latitude, a.current_longitude)
        : Infinity;
      const distB = b.current_latitude && b.current_longitude
        ? haversineDistance(delivery.pickup_latitude!, delivery.pickup_longitude!, b.current_latitude, b.current_longitude)
        : Infinity;
      return distA - distB;
    });
  };

  const getDriverDistance = (driver: any, delivery: DeliveryWithRelations) => {
    if (!delivery.pickup_latitude || !delivery.pickup_longitude || !driver.current_latitude || !driver.current_longitude) return null;
    return haversineDistance(delivery.pickup_latitude, delivery.pickup_longitude, driver.current_latitude, driver.current_longitude);
  };

  const handleReassign = async () => {
    if (!reassignDelivery) return;
    try {
      await reassignMut.mutateAsync({ id: reassignDelivery.id, driverId: selectedDriverId || null });
      toast({ title: "Entregador reatribuído!" });
      setReassignDelivery(null);
      setSelectedDriverId("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Broadcast to all online drivers
  const handleBroadcast = async (delivery: DeliveryWithRelations) => {
    try {
      await updateStatus.mutateAsync({ id: delivery.id, status: "broadcasted" });
      toast({ title: "OS compartilhada!", description: `Enviada para ${onlineDrivers.length} entregador(es) online` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Dispatch to specific driver
  const handleDispatch = async () => {
    if (!dispatchDelivery || !selectedDriverId) return;
    try {
      await reassignMut.mutateAsync({ id: dispatchDelivery.id, driverId: selectedDriverId });
      await updateStatus.mutateAsync({ id: dispatchDelivery.id, status: "broadcasted" });
      toast({ title: "OS enviada!", description: "Entrega direcionada ao entregador selecionado" });
      setDispatchDelivery(null);
      setSelectedDriverId("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handlePrint = (delivery: DeliveryWithRelations) => {
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>OS #${delivery.id.slice(0, 8)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .label { color: #666; font-size: 11px; text-transform: uppercase; margin-top: 12px; }
        .value { font-weight: bold; margin-bottom: 8px; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 16px 0; }
        .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #999; }
      </style></head><body>
        <h1>É Pra Já Delivery</h1>
        <p style="color:#666;margin-top:0">Ordem de Serviço</p>
        <hr/>
        <div class="label">OS</div>
        <div class="value">#${delivery.id.slice(0, 8).toUpperCase()}</div>
        <div class="label">Cliente</div>
        <div class="value">${esc(delivery.customer_name)}</div>
        <div class="label">Endereço</div>
        <div class="value">${esc(delivery.dropoff_address)}</div>
        <div class="label">Empresa</div>
        <div class="value">${esc((delivery as any).companies?.name || "—")}</div>
        <div class="label">Status</div>
        <div class="value">${esc(delivery.status)}</div>
        <div class="label">Valor</div>
        <div class="value">R$ ${Number(delivery.price ?? 0).toFixed(2)}</div>
        <div class="label">Data</div>
        <div class="value">${format(new Date(delivery.created_at), "dd/MM/yyyy HH:mm")}</div>
        ${delivery.notes ? `<div class="label">Observações</div><div class="value">${esc(delivery.notes)}</div>` : ""}
        <hr/>
        <div class="footer">Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <AdminLayout title="Entregas" subtitle="Gestão de corridas e ordens de serviço">
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 shadow-card flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente ou endereço..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch("")}><XIcon className="h-3.5 w-3.5 text-muted-foreground" /></button>
            )}
          </div>
          <select
            value={companyFilter}
            onChange={(e) => { setCompanyFilter(e.target.value); setPage(0); }}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">Todas empresas</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={driverFilter}
            onChange={(e) => { setDriverFilter(e.target.value); setPage(0); }}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">Todos entregadores</option>
            {(drivers ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.profiles?.full_name || "—"}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setActiveFilter(f.value); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4">Cliente</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden md:table-cell">Empresa</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden lg:table-cell">Endereço</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4">Status</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden sm:table-cell">Valor</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden lg:table-cell">Data</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-medium text-foreground">{delivery.customer_name}</p>
                        {delivery.region_name && (
                          <span className="inline-block mt-0.5 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {delivery.region_name}
                          </span>
                        )}
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="text-sm text-foreground">{(delivery as any).companies?.name || "—"}</p>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{delivery.dropoff_address}</p>
                      </td>
                      <td className="p-4">
                        <DeliveryStatusBadge status={delivery.status as DeliveryStatus} />
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-sm font-semibold text-foreground">R$ {Number(delivery.price ?? 0).toFixed(2)}</span>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(delivery.created_at), "dd/MM HH:mm")}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          {/* Broadcast button for pending deliveries */}
                          {delivery.status === "pending" && (
                            <button
                              onClick={() => handleBroadcast(delivery)}
                              className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                              title="Compartilhar com todos os entregadores"
                            >
                              <Radio className="h-4 w-4 text-primary" />
                            </button>
                          )}
                          {/* Dispatch button for pending deliveries */}
                          {delivery.status === "pending" && (
                            <button
                              onClick={() => { setDispatchDelivery(delivery); setSelectedDriverId(""); }}
                              className="p-2 rounded-lg hover:bg-info/10 transition-colors"
                              title="Enviar para entregador específico"
                            >
                              <Send className="h-4 w-4 text-info" />
                            </button>
                          )}
                          <button
                            onClick={() => setDetailDelivery(delivery)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-muted transition-colors">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailDelivery(delivery)}>
                                <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrint(delivery)}>
                                <Printer className="h-4 w-4 mr-2" /> Imprimir OS
                              </DropdownMenuItem>
                              {delivery.status === "pending" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleBroadcast(delivery)}>
                                    <Radio className="h-4 w-4 mr-2" /> Compartilhar com todos
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setDispatchDelivery(delivery); setSelectedDriverId(""); }}>
                                    <Send className="h-4 w-4 mr-2" /> Enviar para entregador
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!["delivered", "cancelled"].includes(delivery.status) && (
                                <DropdownMenuItem onClick={() => { setReassignDelivery(delivery); setSelectedDriverId(delivery.driver_id || ""); }}>
                                  <UserCheck className="h-4 w-4 mr-2" /> Reatribuir
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {delivery.status === "pending" && (
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: delivery.id, status: "accepted" })}>
                                  Aceitar
                                </DropdownMenuItem>
                              )}
                              {(delivery.status === "accepted" || delivery.status === "broadcasted") && (
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: delivery.id, status: "collecting" })}>
                                  Iniciar Coleta
                                </DropdownMenuItem>
                              )}
                              {delivery.status === "collecting" && (
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: delivery.id, status: "in_route" as DeliveryStatus })}>
                                  Em Rota
                                </DropdownMenuItem>
                              )}
                              {delivery.status === "in_route" && (
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: delivery.id, status: "completed" as DeliveryStatus })}>
                                  Finalizar
                                </DropdownMenuItem>
                              )}
                              {!["delivered", "cancelled"].includes(delivery.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => updateStatus.mutate({ id: delivery.id, status: "cancelled" })}
                                  >
                                    Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {deliveries.length === 0 && (
              <div className="p-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma entrega encontrada</p>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!detailDelivery} onOpenChange={(open) => !open && setDetailDelivery(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              OS #{detailDelivery?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {detailDelivery && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <DeliveryStatusBadge status={detailDelivery.status as DeliveryStatus} />
                <div className="flex gap-2">
                  {detailDelivery.status === "pending" && (
                    <>
                      <button
                        onClick={() => { handleBroadcast(detailDelivery); setDetailDelivery(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                      >
                        <Radio className="h-4 w-4" /> Broadcast
                      </button>
                      <button
                        onClick={() => { setDispatchDelivery(detailDelivery); setDetailDelivery(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/10 text-info text-sm font-medium hover:bg-info/20 transition-colors"
                      >
                        <Send className="h-4 w-4" /> Direcionar
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handlePrint(detailDelivery)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    <Printer className="h-4 w-4" /> Imprimir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailField label="Cliente" value={detailDelivery.customer_name} />
                <DetailField label="Empresa" value={(detailDelivery as any).companies?.name || "—"} />
                <DetailField label="Valor" value={`R$ ${Number(detailDelivery.value ?? detailDelivery.price ?? 0).toFixed(2)}`} />
                <DetailField label="Criado em" value={format(new Date(detailDelivery.created_at), "dd/MM/yyyy HH:mm")} />
                {detailDelivery.region_name && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Região</p>
                    <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full border border-primary/20">
                      {detailDelivery.region_name}
                    </span>
                  </div>
                )}
              </div>

              <DetailField label="Endereço" value={detailDelivery.dropoff_address} />
              
              {detailDelivery.notes && (
                <DetailField label="Observações" value={detailDelivery.notes} />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                {detailDelivery.accepted_at && <span>Aceita: {format(new Date(detailDelivery.accepted_at), "dd/MM HH:mm")}</span>}
                {detailDelivery.collected_at && <span>Coletada: {format(new Date(detailDelivery.collected_at), "dd/MM HH:mm")}</span>}
                {detailDelivery.delivered_at && <span>Finalizada: {format(new Date(detailDelivery.delivered_at), "dd/MM HH:mm")}</span>}
                {detailDelivery.cancelled_at && <span>Cancelada: {format(new Date(detailDelivery.cancelled_at), "dd/MM HH:mm")}</span>}
              </div>

              {!["delivered", "cancelled"].includes(detailDelivery.status) && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => { setReassignDelivery(detailDelivery); setSelectedDriverId(detailDelivery.driver_id || ""); setDetailDelivery(null); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80"
                  >
                    <UserCheck className="h-4 w-4" /> Reatribuir
                  </button>
                  <button
                    onClick={() => { updateStatus.mutate({ id: detailDelivery.id, status: "cancelled" }); setDetailDelivery(null); }}
                    className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reassign Modal */}
      <Dialog open={!!reassignDelivery} onOpenChange={(open) => !open && setReassignDelivery(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reatribuir Entregador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Selecione o entregador para a OS #{reassignDelivery?.id.slice(0, 8).toUpperCase()}
            </p>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
            >
              <option value="">Sem entregador</option>
              {(drivers ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.profiles?.full_name || "—"} {d.is_online ? "● Online" : ""}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setReassignDelivery(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={handleReassign}
                disabled={reassignMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reassignMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispatch Modal - Send to specific driver */}
      <Dialog open={!!dispatchDelivery} onOpenChange={(open) => !open && setDispatchDelivery(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-info" />
              Enviar para Entregador
            </DialogTitle>
          </DialogHeader>
          {dispatchDelivery && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">OS</p>
                <p className="text-sm font-medium text-foreground">
                  #{dispatchDelivery.id.slice(0, 8).toUpperCase()} — {dispatchDelivery.customer_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{dispatchDelivery.dropoff_address}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Entregadores Online ({onlineDrivers.length})
                </p>
                {onlineDrivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum entregador online</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {getDriversSortedByProximity(dispatchDelivery).map((driver) => {
                      const dist = getDriverDistance(driver, dispatchDelivery);
                      return (
                        <button
                          key={driver.id}
                          onClick={() => setSelectedDriverId(driver.id)}
                          className={`w-full text-left rounded-xl p-3 transition-all ${
                            selectedDriverId === driver.id
                              ? "bg-primary/10 border border-primary/30"
                              : "bg-muted/50 hover:bg-muted border border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">
                                  {(driver.profiles?.full_name || "?")[0]}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{driver.profiles?.full_name || "—"}</p>
                                <p className="text-xs text-muted-foreground">{driver.vehicle_type}</p>
                              </div>
                            </div>
                            {dist !== null && (
                              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                <MapPin className="h-3 w-3" />
                                {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setDispatchDelivery(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button
                  onClick={handleDispatch}
                  disabled={!selectedDriverId || reassignMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reassignMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
