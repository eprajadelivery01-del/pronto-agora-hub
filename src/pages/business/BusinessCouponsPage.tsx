import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useCoupons, useCouponMutations, Coupon } from "@/services/coupons";
import { useProductsManager } from "@/services/stores-products";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Percent,
  DollarSign,
  Trash2,
  Pencil,
  Tag,
  Copy,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function BusinessCouponsPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string>();
  const { data: coupons, isLoading } = useCoupons(companyId);
  const { data: products } = useProductsManager(companyId);
  const { createCoupon, updateCoupon, deleteCoupon, toggleActive } = useCouponMutations(companyId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState<"all" | "specific">("all");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [usageLimit, setUsageLimit] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCompanyId((data as any).id);
      });
  }, [user]);

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setAppliesTo("all");
    setSelectedProducts([]);
    setUsageLimit("");
    setValidUntil("");
    setMinOrderValue("");
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (coupon: Coupon) => {
    setEditing(coupon);
    setCode(coupon.code);
    setDiscountType(coupon.discount_type);
    setDiscountValue(String(coupon.discount_value));
    setAppliesTo(coupon.applies_to);
    setUsageLimit(coupon.usage_limit ? String(coupon.usage_limit) : "");
    setValidUntil(coupon.valid_until ? coupon.valid_until.slice(0, 16) : "");
    setMinOrderValue(coupon.min_order_value ? String(coupon.min_order_value) : "");

    if (coupon.applies_to === "specific") {
      const { data } = await supabase
        .from("coupon_products")
        .select("product_id")
        .eq("coupon_id", coupon.id);
      setSelectedProducts((data || []).map((d: any) => d.product_id));
    } else {
      setSelectedProducts([]);
    }

    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!code.trim()) return toast.error("Informe o código do cupom.");
    if (!discountValue || Number(discountValue) <= 0) return toast.error("Informe um valor de desconto válido.");
    if (discountType === "percentage" && Number(discountValue) > 100) return toast.error("Percentual não pode ser maior que 100%.");
    if (appliesTo === "specific" && selectedProducts.length === 0) return toast.error("Selecione ao menos um produto.");

    const payload = {
      code: code.toUpperCase().trim(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      applies_to: appliesTo,
      usage_limit: usageLimit ? Number(usageLimit) : null,
      valid_until: validUntil || null,
      min_order_value: minOrderValue ? Number(minOrderValue) : 0,
      product_ids: appliesTo === "specific" ? selectedProducts : [],
    };

    try {
      if (editing) {
        await updateCoupon.mutateAsync({ id: editing.id, data: payload });
        toast.success("Cupom atualizado!");
      } else {
        await createCoupon.mutateAsync(payload);
        toast.success("Cupom criado com sucesso!");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar cupom.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    try {
      await deleteCoupon.mutateAsync(id);
      toast.success("Cupom excluído.");
    } catch {
      toast.error("Erro ao excluir.");
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    try {
      await toggleActive.mutateAsync({ id: coupon.id, is_active: !coupon.is_active });
      toast.success(coupon.is_active ? "Cupom desativado." : "Cupom ativado!");
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success("Código copiado!");
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <BusinessLayout title="Cupons de Desconto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">
              Crie cupons de desconto para seus clientes — por percentual ou valor fixo.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cupom
          </Button>
        </div>

        {/* Coupon list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse h-40" />
            ))}
          </div>
        ) : !coupons?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Tag className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-bold text-lg">Nenhum cupom criado</p>
              <p className="text-sm">Clique em "Novo Cupom" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {coupons.map((coupon) => (
              <Card
                key={coupon.id}
                className={cn(
                  "relative overflow-hidden transition-all hover:shadow-md",
                  !coupon.is_active && "opacity-60"
                )}
              >
                <div className={cn(
                  "absolute top-0 left-0 w-1 h-full",
                  coupon.is_active ? "bg-primary" : "bg-muted-foreground/30"
                )} />
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <button
                      onClick={() => copyCode(coupon.code)}
                      className="flex items-center gap-2 group"
                    >
                      <CardTitle className="text-lg font-black tracking-wider font-mono">
                        {coupon.code}
                      </CardTitle>
                      <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge variant={coupon.discount_type === "percentage" ? "default" : "secondary"} className="text-xs">
                        {coupon.discount_type === "percentage" ? (
                          <><Percent className="h-3 w-3 mr-1" />{coupon.discount_value}%</>
                        ) : (
                          <><DollarSign className="h-3 w-3 mr-1" />{fmt(coupon.discount_value)}</>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {coupon.applies_to === "all" ? "Todos" : "Específicos"}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={coupon.is_active}
                    onCheckedChange={() => handleToggle(coupon)}
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Usos: {coupon.usage_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ""}</span>
                    {coupon.valid_until && (
                      <span>
                        Expira: {new Date(coupon.valid_until).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {coupon.min_order_value > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pedido mín: {fmt(coupon.min_order_value)}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(coupon)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleDelete(coupon.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cupom" : "Novo Cupom de Desconto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Code */}
            <div className="space-y-2">
              <Label>Código do Cupom</Label>
              <Input
                placeholder="Ex: PROMO10"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
                className="font-mono font-bold tracking-wider uppercase"
              />
            </div>

            {/* Discount type + value */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">
                      <span className="flex items-center gap-2"><Percent className="h-3.5 w-3.5" /> Percentual (%)</span>
                    </SelectItem>
                    <SelectItem value="fixed">
                      <span className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Valor Fixo (R$)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{discountType === "percentage" ? "Percentual (%)" : "Valor (R$)"}</Label>
                <Input
                  type="number"
                  min="0"
                  max={discountType === "percentage" ? 100 : undefined}
                  step="0.01"
                  placeholder={discountType === "percentage" ? "10" : "5.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
            </div>

            {/* Applies to */}
            <div className="space-y-2">
              <Label>Aplicar em</Label>
              <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  <SelectItem value="specific">Produtos específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product selection */}
            {appliesTo === "specific" && (
              <div className="space-y-2">
                <Label>Selecione os produtos</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {!products?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto cadastrado.</p>
                  ) : (
                    products.map((p: any) => (
                      <label key={p.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={selectedProducts.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedProducts((prev) =>
                              checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                            );
                          }}
                        />
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(p.price || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {selectedProducts.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedProducts.length} produto(s) selecionado(s)</p>
                )}
              </div>
            )}

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Limite de Usos <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ilimitado"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pedido Mínimo (R$) <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Válido até <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createCoupon.isPending || updateCoupon.isPending}
            >
              {editing ? "Salvar Alterações" : "Criar Cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BusinessLayout>
  );
}
