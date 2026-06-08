// @ts-nocheck
import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  Plus, Trash2, Edit3, Loader2, ImagePlus, Package,
  DollarSign, X, Check, Eye, EyeOff, ArrowLeft, Layers, Info, ShoppingCart, GripVertical
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
  sort_order?: number;
}

export default function BusinessProductsPage() {
  const qc = useQueryClient();
  const { companyId: linkedCompanyId, isLoading: companyLoading } = useCurrentCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const companyId = linkedCompanyId;
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
        .order("created_at", { ascending: false });
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

  const categories = [...new Set(products.map((product) => product.category || 'Outros'))];

  const categoryDisplayNames: Record<string, string> = {
    'sorvetes': 'Sorvetes e Picolés',
    'alcoolicas': 'Bebidas Alcoólicas',
    'porcoes': 'Porções',
    'perfumaria': 'Perfumaria',
    'padaria': 'Padaria',
    'Hamburguer': 'Hambúrguer Artesanal',
    'hamburguer_artesanal': 'Hambúrguer Artesanal',
    'Assados': 'Assados',
    'Acompanhamentos': 'Acompanhamentos',
    'Marmita': 'Marmita',
    'Mercado': 'Mercado',
    'Farmácia': 'Farmácia',
    'Bebidas': 'Bebidas',
    'Doces': 'Doces',
    'Pet Shop': 'Pet Shop',
    'Shopping': 'Shopping',
    'Outros': 'Outros',
    'Pizza': 'Pizza',
    'Lanches': 'Lanches'
  };

  const formatCategoryName = (cat: string) => categoryDisplayNames[cat] || cat;

  if (showForm || editingProduct) {
    return (
      <BusinessLayout title={editingProduct ? "Editar Produto" : "Novo Produto"}>
         <div className="max-w-4xl mx-auto">
            <ProductForm
              companyId={companyId!}
              product={editingProduct}
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
            {categories.map((category) => {
              const categoryProducts = products.filter((p) => (p.category || 'Outros') === category);
              if (categoryProducts.length === 0) return null;

              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-2 h-6 bg-primary rounded-full shadow-lg shadow-primary/20" />
                    <h3 className="text-xl font-black text-foreground tracking-tight">{formatCategoryName(category)}</h3>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-xs font-black uppercase">{categoryProducts.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onEdit={() => setEditingProduct(product)}
                        onDelete={() => deleteProduct(product.id)}
                        onToggle={() => toggleActive(product)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}

// â”€â”€â”€ Product Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProductCard({ product, onEdit, onDelete, onToggle }: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const images = parseImages(product.image_url);
  const mainImage = images[0];

  return (
    <div className={cn(
      "bg-card border border-border/50 rounded-[2.5rem] overflow-hidden shadow-card transition-all hover:shadow-2xl hover:border-primary/20 group",
      !product.is_active && "opacity-60 grayscale-[0.5]"
    )}>
      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {mainImage ? (
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImagePlus className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}
        
        <div className="absolute top-4 right-4 flex gap-2">
            {!product.is_active && (
                <div className="bg-destructive text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg">
                    Item Pausado
                </div>
            )}
            <div className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                <ShoppingCart className="h-3 w-3" /> Marketplace
            </div>
        </div>

        {/* Floating Price */}
        <div className="absolute bottom-4 left-4">
            <div className="bg-background/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 shadow-xl">
                <p className="text-primary font-black text-lg tracking-tight">R$ {product.price.toFixed(2).replace(".", ",")}</p>
            </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-6 space-y-4">
        <div className="min-h-[56px]">
          <h3 className="font-black text-foreground text-lg leading-tight truncate group-hover:text-primary transition-colors">{product.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 font-medium leading-relaxed">{product.description || "Sem descrição disponível"}</p>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
          <button
            onClick={onEdit}
            className="col-span-2 py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar
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

// â”€â”€â”€ Product Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProductForm({ companyId, product, onClose, onSaved }: {
  companyId: string;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(product?.category || "Outros");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_url ? parseImages(product.image_url) : []);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    if (imageUrls.length >= 3) {
      toast.error("Máximo de 3 fotos");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande! Limite de 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `product-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      setImageUrls([...imageUrls, data.publicUrl]);
      toast.success("Foto do produto enviada!");
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error("Falha ao enviar imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  const addImageUrl = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (imageUrls.length >= 3) {
      toast.error("Máximo de 3 fotos");
      return;
    }
    if (!url.startsWith("http")) {
      toast.error("Insira uma URL válida");
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
      toast.error("Adicione pelo menos 1 foto");
      return;
    }

    setSaving(true);
    try {
      const imagePayload = JSON.stringify(imageUrls);
      const payload = {
        name,
        description: description || null,
        category,
        price: parseFloat(price.replace(',', '.')),
        image_url: imagePayload,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase.from("products").insert([{ ...payload, company_id: companyId, is_active: true }]);
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
      <button onClick={onClose} className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">
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
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Combo X-Brasil"
                      className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                      required
                    />
                  </div>
                  
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Categoria *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                      required
                    >
                      <option value="">Selecione uma categoria</option>
                      <option value="Pizza">🍕 Pizza</option>
                      <option value="Lanches">🍔 Lanches</option>
                      <option value="Hamburguer">🔥 Hambúrguer Artesanal</option>
                      <option value="Padaria">🥐 Padaria</option>
                      <option value="Assados">🍗 Assados</option>
                      <option value="Acompanhamentos">🥗 Acompanhamentos</option>
                      <option value="Marmita">🍱 Marmita</option>
                      <option value="sorvetes">🍦 Sorvetes e Picolés</option>
                      <option value="alcoolicas">🍷 Bebidas Alcoólicas</option>
                      <option value="porcoes">🍟 Porções</option>
                      <option value="Mercado">🛒 Mercado</option>
                      <option value="Farmácia">💊 Farmácia</option>
                      <option value="Perfumaria">✨ Perfumaria</option>
                      <option value="Bebidas">🥤 Bebidas</option>
                      <option value="Doces">🍫 Doces</option>
                      <option value="Pet Shop">🐾 Pet Shop</option>
                      <option value="Shopping">🛍️ Shopping</option>
                      <option value="Outros">🍽️ Categoria Geral (Outros)</option>
                    </select>
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Preço de Venda *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                      <input
                        type="text"
                        value={price}
                        onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                        placeholder="Ex: 25.90 ou 25,90"
                        className="w-full pl-14 pr-6 py-4 rounded-2xl border border-border bg-background/50 font-black outline-none focus:border-primary transition-all text-lg"
                        required
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Descrição / Ingredientes</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
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
                {saving ? "Publicando..." : (product ? "Salvar Alterações" : "Adicionar ao Marketplace")}
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

// â”€â”€â”€ Helper for parsing image_url â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

