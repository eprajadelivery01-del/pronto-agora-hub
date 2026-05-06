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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  const { createCoupon, updateCoupon, deleteCoupon, toggleActive } = useCouponMutations(companyId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxDiscountValue, setMaxDiscountValue] = useState("");

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
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setUsageLimit("");
    setExpiresAt("");
    setMinOrderValue("");
    setMaxDiscountValue("");
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setCode(coupon.code);
    setDescription(coupon.description || "");
    setDiscountType(coupon.discount_type);
    setDiscountValue(String(coupon.discount_value));
    setUsageLimit(coupon.usage_limit ? String(coupon.usage_limit) : "");
    setExpiresAt(coupon.expires_at ? coupon.expires_at.slice(0, 16) : "");
    setMinOrderValue(String(coupon.min_order_value || 0));
    setMaxDiscountValue(coupon.max_discount_value ? String(coupon.max_discount_value) : "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!code.trim()) return toast.error("Informe o código do cupom.");
    if (!discountValue || Number(discountValue) <= 0) return toast.error("Informe um valor de desconto válido.");
    if (discountType === "percentage" && Number(discountValue) > 100) return toast.error("Percentual não pode ser maior que 100%.");

    const payload = {
      code: code.toUpperCase().trim(),
      description: description || null,
      discount_type: discountType,
      discount_value: Number(discountValue),
      usage_limit: usageLimit ? Number(usageLimit) : null,
      expires_at: expiresAt || null,
      min_order_value: minOrderValue ? Number(minOrderValue) : 0,
      max_discount_value: maxDiscountValue ? Number(maxDiscountValue) : null,
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
      await toggleActive.mutateAsync({ id: coupon.id, active: !coupon.active });
      toast.success(coupon.active ? "Cupom desativado." : "Cupom ativado!");
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
    <BusinessLayout title="Gestão de Cupons">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary/10 via-background to-background p-6 rounded-3xl border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Tag className="h-6 w-6 text-primary" /> Fidelize seus Clientes
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Crie campanhas de desconto para aumentar suas vendas e atrair novos pedidos.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 h-12 px-6 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-bold">
            <Plus className="h-5 w-5" />
            Criar Novo Cupom
          </Button>
        </div>

        {/* Coupon list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse h-52 rounded-3xl" />
            ))}
          </div>
        ) : !coupons?.length ? (
          <Card className="border-dashed rounded-3xl bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="h-20 w-20 bg-background rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Tag className="h-10 w-10 opacity-20" />
              </div>
              <p className="font-black text-xl text-foreground tracking-tight">Nenhum cupom ativo</p>
              <p className="text-sm max-w-xs text-center mt-2">Você ainda não criou nenhum cupom de desconto para sua loja.</p>
              <Button onClick={openCreate} variant="outline" className="mt-8 rounded-xl border-2">
                Começar agora
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon) => (
              <Card
                key={coupon.id}
                className={cn(
                  "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 rounded-3xl border-2",
                  !coupon.active ? "opacity-60 border-muted grayscale" : "border-transparent hover:border-primary/20"
                )}
              >
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-110",
                  coupon.active ? "bg-primary" : "bg-muted-foreground"
                )} />
                
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <button
                      onClick={() => copyCode(coupon.code)}
                      className="flex items-center gap-2 group/btn"
                    >
                      <CardTitle className="text-2xl font-black tracking-widest font-mono text-primary">
                        {coupon.code}
                      </CardTitle>
                      <Copy className="h-4 w-4 opacity-0 group-hover/btn:opacity-100 transition-all text-muted-foreground" />
                    </button>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {coupon.description || "Desconto Especial"}
                    </p>
                  </div>
                  <Switch
                    checked={coupon.active}
                    onCheckedChange={() => handleToggle(coupon)}
                    className="data-[state=checked]:bg-primary"
                  />
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={coupon.discount_type === "percentage" ? "default" : "secondary"} className="h-7 px-3 rounded-lg font-black text-sm">
                      {coupon.discount_type === "percentage" ? (
                        <><Percent className="h-3.5 w-3.5 mr-1" />{coupon.discount_value}% OFF</>
                      ) : (
                        <><DollarSign className="h-3.5 w-3.5 mr-0.5" />{fmt(coupon.discount_value)} OFF</>
                      )}
                    </Badge>
                    {coupon.min_order_value > 0 && (
                      <Badge variant="outline" className="h-7 px-3 rounded-lg border-2 font-bold text-xs bg-background/50">
                        Mín: {fmt(coupon.min_order_value)}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2 border-y border-dashed border-muted">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Uso</p>
                      <p className="text-sm font-black text-foreground">
                        {coupon.used_count || 0} <span className="text-xs text-muted-foreground font-medium">/ {coupon.usage_limit || "∞"}</span>
                      </p>
                    </div>
                    {coupon.expires_at && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Validade</p>
                        <p className="text-sm font-black text-foreground">
                          {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="secondary" className="flex-1 rounded-xl font-bold gap-2" onClick={() => openEdit(coupon)}>
                      <Pencil className="h-4 w-4" /> Configurar
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => handleDelete(coupon.id)}>
                      <Trash2 className="h-4 w-4" />
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
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogDescription className="sr-only">
            Formulário para criação e edição de cupons de desconto.
          </DialogDescription>
          <div className="bg-primary p-8 text-primary-foreground relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <DialogHeader className="relative">
              <DialogTitle className="text-2xl font-black tracking-tight leading-none">
                {editing ? "Configurar Cupom" : "Criar Novo Cupom"}
              </DialogTitle>
              <p className="text-primary-foreground/70 text-sm mt-2 font-medium">
                {editing ? "Atualize as regras de desconto para este código." : "Defina o código e o valor do desconto."}
              </p>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-4">
              {/* Code */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Código do Cupom</Label>
                <div className="relative">
                  <Input
                    placeholder="EX: VERÃO2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={20}
                    className="h-14 rounded-2xl border-2 border-muted focus:border-primary transition-all font-mono font-black text-xl tracking-[0.2em] uppercase pl-5"
                  />
                  <Tag className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Descrição Curta</Label>
                <Input
                  placeholder="Ex: Desconto de Inauguração"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-12 rounded-xl border-2 border-muted focus:border-primary transition-all font-medium"
                />
              </div>

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                    <SelectTrigger className="h-12 rounded-xl border-2 border-muted font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      <SelectItem value="percentage" className="rounded-lg font-bold">Percentual (%)</SelectItem>
                      <SelectItem value="fixed" className="rounded-lg font-bold">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                    {discountType === "percentage" ? "Valor (%)" : "Valor (R$)"}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="h-12 rounded-xl border-2 border-muted focus:border-primary transition-all font-black text-lg"
                  />
                </div>
              </div>

              {/* Advanced Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Pedido Mínimo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="R$ 0,00"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                    className="h-12 rounded-xl border-2 border-muted focus:border-primary transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Qtd Limite</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ilimitado"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="h-12 rounded-xl border-2 border-muted focus:border-primary transition-all font-bold"
                  />
                </div>
              </div>

              {discountType === "percentage" && (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Desconto Máximo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ilimitado"
                    value={maxDiscountValue}
                    onChange={(e) => setMaxDiscountValue(e.target.value)}
                    className="h-12 rounded-xl border-2 border-muted focus:border-primary transition-all font-bold"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Data de Expiração</Label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-12 rounded-xl border-2 border-muted focus:border-primary transition-all font-medium pr-10"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setDialogOpen(false)}>
                Descartar
              </Button>
              <Button
                className="flex-[2] h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20"
                onClick={handleSubmit}
                disabled={createCoupon.isPending || updateCoupon.isPending}
              >
                {createCoupon.isPending || updateCoupon.isPending ? "Processando..." : editing ? "Salvar Alterações" : "Ativar Cupom"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </BusinessLayout>
  );
}
