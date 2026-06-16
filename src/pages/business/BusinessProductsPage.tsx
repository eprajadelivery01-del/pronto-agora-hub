// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  Plus, Trash2, Edit3, Loader2, ImagePlus, Package,
  DollarSign, X, Check, Eye, EyeOff, ArrowLeft, Layers, ShoppingCart,
  GripVertical, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category?: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  sort_order: number;
  is_featured?: boolean | null;
}

function parseImages(imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed.filter((u: any) => typeof u === "string" && u.startsWith("http"));
  } catch {
    if (imageUrl.startsWith("http")) return [imageUrl];
  }
  return [];
}

export default function BusinessProductsPage() {
  const qc = useQueryClient();
  const { companyId: linkedCompanyId, isLoading: companyLoading } = useCurrentCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const companyId = linkedCompanyId;
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Drag state
  const dragId = useRef<string | null>(null);
  const dragCategory = useRef<string | null>(null);

  useEffect(() => {
    if (companyId) {
      fetchProducts(companyId);
    } else if (!companyLoading) {
      setLoading(false);
    }
  }, [companyId, companyLoading]);

  const fetchProducts = async (cId: string) => {
    setLoading(true);
    try {
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", cId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setProducts(prods || []);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyAndProducts = () => {
    if (companyId) fetchProducts(companyId);
  };

  const toggleActive = async (product: Product) => {
    const { error } = await (supabase as any)
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(product.is_active ? "Produto desativado" : "Produto ativado");
      fetchCompanyAndProducts();
    }
  };

  const toggleFeatured = async (product: Product) => {
    const { error } = await (supabase as any)
      .from("products")
      .update({ is_featured: !product.is_featured })
      .eq("id", product.id);
    if (error) {
      toast.error("Erro ao alterar destaque");
    } else {
      toast.success(product.is_featured ? "Destaque removido" : "Produto destacado");
      fetchCompanyAndProducts();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Deseja realmente remover este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover produto");
    } else {
      toast.success("Produto removido");
      fetchCompanyAndProducts();
    }
  };

  // ── Drag & Drop handlers ──────────────────────────────────────────────────────
  const handleDragStart = useCallback((id: string, category: string) => {
    dragId.current = id;
    dragCategory.current = category;
  }, []);

  const handleDrop = useCallback(async (targetId: string, targetCategory: string) => {
    const srcId = dragId.current;
    const srcCat = dragCategory.current;
    if (!srcId || srcId === targetId || srcCat !== targetCategory) return;

    const catProducts = products.filter(p => (p.category || "Outros") === targetCategory);
    const srcIdx = catProducts.findIndex(p => p.id === srcId);
    const tgtIdx = catProducts.findIndex(p => p.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const reordered = [...catProducts];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i }));

    // Optimistic UI
    setProducts(prev =>
      prev.map(p => {
        const found = updated.find(u => u.id === p.id);
        return found ?? p;
      })
    );

    // Persist
    try {
      await Promise.all(
        updated.map(p =>
          supabase.from("products").update({ sort_order: p.sort_order }).eq("id", p.id)
        )
      );
      toast.success("Ordem salva!");
    } catch {
      toast.error("Erro ao salvar ordem");
      fetchCompanyAndProducts();
    }

    dragId.current = null;
    dragCategory.current = null;
  }, [products]);

  // Extract all unique categories
  const allCategories = Array.from(new Set(products.map(p => p.category || "Outros")));
  
  // Group products by their custom category
  const grouped = allCategories.map(catValue => {
    const predefinedCat = CATEGORY_OPTIONS.find(c => c.value === catValue);
    const label = predefinedCat ? predefinedCat.label : catValue;
    return {
      cat: { value: catValue, label },
      items: products.filter(p => (p.category || "Outros") === catValue).sort((a, b) => a.sort_order - b.sort_order)
    };
  });

  if (showForm || editingProduct) {
    return (
      <BusinessLayout title={editingProduct ? "Editar Produto" : "Novo Produto"}>
        <div className="max-w-4xl mx-auto">
          <ProductForm
            companyId={companyId!}
            product={editingProduct}
            categoryCount={
              editingProduct
                ? products.filter(p => (p.category || "Outros") === (editingProduct.category || "Outros")).length
                : 0
            }
            existingCategories={allCategories}
            onClose={() => { setShowForm(false); setEditingProduct(null); }}
            onSaved={() => { setShowForm(false); setEditingProduct(null); fetchCompanyAndProducts(); }}
          />
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Gestão de Cardápio">
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Seu Catálogo</h2>
            <p className="text-muted-foreground text-sm font-medium">
              Organize os itens que seus clientes podem comprar no marketplace.
            </p>
            <p className="text-xs text-primary/80 font-bold mt-1 flex items-center gap-1">
              <GripVertical className="h-3 w-3" />
              Arraste os cards para reordenar dentro de cada categoria
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={!companyId}
            className="px-8 py-4 rounded-[2rem] gradient-primary text-primary-foreground font-black flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            <Plus className="h-6 w-6" />
            Novo Item
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-12 h-12 rounded-2xl border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Carregando Itens...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-[3rem] p-20 text-center shadow-card">
            <div className="w-24 h-24 rounded-[2rem] bg-muted/50 flex items-center justify-center mx-auto mb-8">
              <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-4">Seu cardápio está vazio</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-10 font-medium">
              Adicione fotos apetitosas e descrições detalhadas para vender mais.
            </p>
            <button
              onClick={() => setShowForm(true)}
              disabled={!companyId}
              className="px-10 py-4 rounded-2xl gradient-primary text-primary-foreground font-black text-lg shadow-xl disabled:opacity-50"
            >
              Começar agora
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(({ cat, items }) => (
              <section key={cat.value}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-5 px-2">
                  <span className="text-2xl">{cat.label.split(" ")[0]}</span>
                  <div>
                    <h3 className="font-black text-xl tracking-tight">
                      {cat.label.replace(/^\S+\s/, "")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? "item" : "itens"} · arraste para reordenar
                    </p>
                  </div>
                  <div className="flex-1 border-b border-dashed border-border/60 ml-2" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={() => setEditingProduct(product)}
                      onDelete={() => deleteProduct(product.id)}
                      onToggle={() => toggleActive(product)}
                      onToggleFeatured={() => toggleFeatured(product)}
                      onDragStart={() => handleDragStart(product.id, product.category || "Outros")}
                      onDrop={() => handleDrop(product.id, product.category || "Outros")}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({
  product, onEdit, onDelete, onToggle, onToggleFeatured, onDragStart, onDrop,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onToggleFeatured: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const images = parseImages(product.image_url);
  const mainImage = images[0];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDrop();
      }}
      className={cn(
        "bg-card border rounded-[2.5rem] overflow-hidden shadow-card transition-all duration-200 group relative",
        !product.is_active && "opacity-60 grayscale-[0.4]",
        isDragging ? "opacity-40 scale-95 cursor-grabbing shadow-none" : "cursor-grab hover:shadow-2xl hover:border-primary/20 hover:-translate-y-0.5",
        isOver ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border/50",
      )}
    >
      {/* Drag Handle — visible on hover */}
      <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
          <GripVertical className="h-3 w-3" />
          Arrastar
        </span>
      </div>

      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {mainImage ? (
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImagePlus className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}

        <div className="absolute top-4 right-4 flex gap-2 flex-wrap justify-end max-w-[70%]">
          {product.is_featured && (
            <div className="bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1">
              <Star className="h-2.5 w-2.5 fill-current" /> Destaque
            </div>
          )}
          {!product.is_active && (
            <div className="bg-destructive text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg">
              Pausado
            </div>
          )}
          <div className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
            <ShoppingCart className="h-3 w-3" /> Marketplace
          </div>
        </div>

        {/* Floating Price */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-background/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 shadow-xl">
            <p className="text-primary font-black text-lg tracking-tight">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-6 space-y-4">
        <div className="min-h-[56px]">
          <h3 className="font-black text-foreground text-lg leading-tight truncate group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 font-medium leading-relaxed">
            {product.description || "Sem descrição disponível"}
          </p>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-5 gap-2 pt-2 border-t border-border">
          <button
            onClick={onEdit}
            className="col-span-2 py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onToggleFeatured}
            className={cn("py-3 rounded-xl flex items-center justify-center transition-all", product.is_featured ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            title={product.is_featured ? "Remover Destaque" : "Destacar Produto"}
          >
            <Star className={cn("h-4 w-4", product.is_featured && "fill-current")} />
          </button>
          <button
            onClick={onToggle}
            className="py-3 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 flex items-center justify-center transition-all"
            title={product.is_active ? "Pausar Vendas" : "Ativar Vendas"}
          >
            {product.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-success" />}
          </button>
          <button
            onClick={onDelete}
            className="py-3 rounded-xl bg-destructive/5 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Form ──────────────────────────────────────────────────────────────
function ProductForm({ companyId, product, categoryCount, existingCategories, onClose, onSaved }: {
  companyId: string;
  product: Product | null;
  categoryCount: number;
  existingCategories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(product?.category || "Outros");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_url ? parseImages(product.image_url) : []);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured || false);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    if (imageUrls.length >= 3) { toast.error("Máximo de 3 fotos"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande! Limite de 5MB."); return; }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `product-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("store-assets").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("store-assets").getPublicUrl(filePath);
      setImageUrls([...imageUrls, data.publicUrl]);
      toast.success("Foto do produto enviada!");
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error("Falha ao enviar imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => setImageUrls(imageUrls.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUrls.length === 0) { toast.error("Adicione pelo menos 1 foto"); return; }

    setSaving(true);
    try {
      const imagePayload = JSON.stringify(imageUrls);
      const payload: Record<string, unknown> = {
        name,
        description: description || null,
        category,
        price: parseFloat(price.replace(",", ".")),
        image_url: imagePayload,
        is_featured: isFeatured,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        // New product appended at end of its category
        payload.sort_order = categoryCount;
        const { error } = await supabase
          .from("products")
          .insert([{ ...payload, company_id: companyId, is_active: true }]);
        if (error) throw error;
        toast.success("Produto publicado!");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <button
        onClick={onClose}
        className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Cardápio
      </button>

      <div className="bg-card border border-border rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
                <Package className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-black text-foreground">Detalhes do Item</h2>
            </div>

            <div className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Nome do Produto *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Combo X-Brasil"
                  className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Categoria *</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Ex: Lanches, Bebidas..."
                  className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                  required
                />
                
                {/* Category Chips */}
                {existingCategories.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide">
                    {existingCategories.map(c => (
                      <button
                        key={`existing-${c}`}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cn(
                          "shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          category === c 
                            ? "bg-primary text-primary-foreground border-primary shadow-md" 
                            : "bg-primary/5 text-primary hover:bg-primary/10 border-primary/20"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Preço de Venda *</label>
                <div className="relative">
                  <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                  <input
                    type="text"
                    value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="Ex: 25.90 ou 25,90"
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-border bg-background/50 font-black outline-none focus:border-primary transition-all text-lg"
                    required
                  />
                </div>
              </div>

              {/* Featured */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-background/50 cursor-pointer hover:bg-primary/5 transition-all">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Star className={cn("h-4 w-4", isFeatured ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} /> 
                      Destaque na Loja
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Exibir este produto no topo do seu cardápio.</div>
                  </div>
                  <div className={cn("w-12 h-6 rounded-full relative transition-colors duration-300", isFeatured ? "bg-amber-500" : "bg-border")}>
                    <div className={cn("absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300", isFeatured ? "translate-x-6" : "")} />
                  </div>
                  <input type="checkbox" className="hidden" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                </label>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Descrição / Ingredientes</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Os clientes são atraídos por boas descrições. Liste os ingredientes ou defina as propriedades do seu lanche."
                  rows={4}
                  className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary resize-none transition-all placeholder:font-normal placeholder:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !name || !price || imageUrls.length === 0}
              className="w-full py-5 rounded-[2rem] gradient-primary text-primary-foreground text-lg font-black shadow-2xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
              {saving ? "Publicando..." : product ? "Salvar Alterações" : "Adicionar ao Marketplace"}
            </button>
          </form>

          {/* Photos Section */}
          <div className="space-y-8 border-l border-border/50 lg:pl-12">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Fotos do Produto ({imageUrls.length}/3)</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden border border-border group shadow-lg">
                  <img src={url} alt="Prod" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-3 left-3 bg-primary text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg">
                      Principal
                    </div>
                  )}
                </div>
              ))}

              {imageUrls.length < 3 && (
                <div className="aspect-square rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors">
                  <ImagePlus className="h-8 w-8 stroke-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Aguardando Foto</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="file"
                  id="prod-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading || imageUrls.length >= 3}
                />
                <label
                  htmlFor="prod-upload"
                  className={cn(
                    "w-full py-8 rounded-[2rem] border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/10 transition-all",
                    (isUploading || imageUrls.length >= 3) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <ImagePlus className="h-8 w-8 text-primary" />}
                  <div className="text-center">
                    <span className="text-sm font-black uppercase tracking-widest text-primary block">Tirar Foto / Galeria</span>
                    <span className="text-[10px] text-muted-foreground font-bold mt-1 block">Use a câmera ou escolha um arquivo</span>
                  </div>
                </label>
              </div>
              <p className="text-[9px] text-muted-foreground italic px-2">📷 Recomendamos fotos quadradas (1080x1080) com fundo limpo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
