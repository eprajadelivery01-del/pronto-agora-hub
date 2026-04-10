import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Edit3, Loader2, ImagePlus, Package,
  DollarSign, X, Check, Eye, EyeOff, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
}

export default function BusinessProductsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchCompanyAndProducts();
  }, [user]);

  const fetchCompanyAndProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);
        const { data: prods } = await supabase
          .from("products")
          .select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false });
        setProducts(prods || []);
      }
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    } finally {
      setLoading(false);
    }
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

  if (showForm || editingProduct) {
    return (
      <BusinessLayout title={editingProduct ? "Editar Produto" : "Novo Produto"}>
        <ProductForm
          companyId={companyId!}
          product={editingProduct}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onSaved={() => { setShowForm(false); setEditingProduct(null); fetchCompanyAndProducts(); }}
        />
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Meus Produtos">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Catálogo de Produtos</h2>
            <p className="text-muted-foreground text-sm font-medium">
              Gerencie os produtos que aparecem na sua vitrine do marketplace.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={!companyId}
            className="px-6 py-3.5 rounded-2xl gradient-primary text-primary-foreground font-bold flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Adicionar Produto
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-3xl p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhum produto cadastrado</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Adicione seus produtos para começar a vender no marketplace.
            </p>
            <button
              onClick={() => setShowForm(true)}
              disabled={!companyId}
              className="px-6 py-3 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-lg disabled:opacity-50"
            >
              Cadastrar Primeiro Produto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => setEditingProduct(product)}
                onDelete={() => deleteProduct(product.id)}
                onToggle={() => toggleActive(product)}
              />
            ))}
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}

// ─── Product Card ────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete, onToggle }: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  // image_url can be a JSON array of URLs or a single URL string
  const images = parseImages(product.image_url);
  const mainImage = images[0];

  return (
    <div className={cn(
      "bg-card border rounded-3xl overflow-hidden shadow-card transition-all hover:shadow-xl group",
      product.is_active ? "border-border/50" : "border-destructive/20 opacity-70"
    )}>
      {/* Image */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {mainImage ? (
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImagePlus className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
            +{images.length - 1} fotos
          </div>
        )}
        {!product.is_active && (
          <div className="absolute top-3 left-3 bg-destructive/90 text-destructive-foreground text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            Desativado
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 space-y-3">
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight truncate">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description || "Sem descrição"}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-primary">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            onClick={onEdit}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <Edit3 className="h-4 w-4" /> Editar
          </button>
          <button
            onClick={onToggle}
            className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors"
            title={product.is_active ? "Desativar" : "Ativar"}
          >
            {product.is_active ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-success" />}
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 rounded-xl border border-border hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Form ────────────────────────────────────────────
function ProductForm({ companyId, product, onClose, onSaved }: {
  companyId: string;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_url ? parseImages(product.image_url) : []);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const addImageUrl = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (imageUrls.length >= 3) {
      toast.error("Máximo de 3 fotos por produto");
      return;
    }
    // Basic url validation
    if (!url.startsWith("http")) {
      toast.error("Insira uma URL válida (começando com http)");
      return;
    }
    setImageUrls([...imageUrls, url]);
    setNewUrl("");
  };

  const removeImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageUrls.length === 0) {
      toast.error("É obrigatório adicionar pelo menos 1 foto do produto");
      return;
    }

    setSaving(true);
    try {
      // Store images as JSON array string in image_url
      const imagePayload = JSON.stringify(imageUrls);

      if (product) {
        // Update
        const { error } = await (supabase as any)
          .from("products")
          .update({
            name,
            description: description || null,
            price: parseFloat(price),
            image_url: imagePayload,
          })
          .eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        // Insert
        const { error } = await (supabase as any)
          .from("products")
          .insert([{
            company_id: companyId,
            name,
            description: description || null,
            price: parseFloat(price),
            image_url: imagePayload,
            is_active: true,
          }]);
        if (error) throw error;
        toast.success("Produto cadastrado!");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300">
      <button onClick={onClose} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Catálogo
      </button>

      <div className="bg-card border border-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <h2 className="text-2xl font-black text-foreground mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          {product ? "Editar Produto" : "Novo Produto"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* Name */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Nome do Produto *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Hambúrguer Artesanal"
              className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva seu produto: ingredientes, tamanho, sabor..."
              rows={3}
              className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary resize-none transition-all text-base"
            />
          </div>

          {/* Price */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Preço (R$) *</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-base"
                required
              />
            </div>
          </div>

          {/* Images Section */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Fotos do Produto * <span className="text-primary">({imageUrls.length}/3)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">É obrigatório ter pelo menos 1 foto. Máximo de 3 fotos.</p>

            {/* Current images preview */}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-border group">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-2 left-2 text-[9px] font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-full uppercase">Principal</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add image URL */}
            {imageUrls.length < 3 && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ImagePlus className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="Cole a URL da foto aqui..."
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
                  />
                </div>
                <button
                  type="button"
                  onClick={addImageUrl}
                  className="px-5 py-3.5 rounded-2xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving || !name || !price || imageUrls.length === 0}
              className="w-full py-5 rounded-2xl gradient-primary text-primary-foreground text-lg font-black shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all"
            >
              {saving && <Loader2 className="h-6 w-6 animate-spin" />}
              {saving ? "Salvando..." : (product ? "Salvar Alterações" : "Publicar no Marketplace")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helper for parsing image_url ────────────────────────────
function parseImages(imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed.filter((u: any) => typeof u === "string" && u.startsWith("http"));
  } catch {
    // It's a single URL string
    if (imageUrl.startsWith("http")) return [imageUrl];
  }
  return [];
}
