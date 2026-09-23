// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { supabase, withSessionRetry, isJwtExpiredError } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  Plus, Trash2, Edit3, Loader2, ImagePlus, Package,
  DollarSign, X, Check, Eye, EyeOff, ArrowLeft, Layers, ShoppingCart,
  GripVertical, Star, Upload, Sliders,
  ChevronDown, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizeStorageImage } from "@/lib/imageOptimization";
import { BulkImportModal } from "@/components/business/BulkImportModal";
import { ProductOptionGroupsManager, loadProductOptionGroups, saveProductOptionGroups, OptionGroupDraft } from "@/components/business/ProductOptionGroupsManager";
import { useTouchDragSort } from "@/hooks/useTouchDragSort";

// ── Handle de categoria: HTML5 nativo no desktop, touch events no mobile ───────
function CategoryDragHandle({
  category,
  label,
  onDragStartCategory,
  onDragEndCategory,
  onTouchDropCategory,
}: {
  category: string;
  label: string;
  onDragStartCategory: () => void;
  onDragEndCategory: () => void;
  onTouchDropCategory: (targetCategory: string) => void;
}) {
  const touchRef = useTouchDragSort<HTMLDivElement>({
    selfId: category,
    targetSelector: "[data-category-header]",
    targetAttribute: "data-category-header",
    enabled: CATEGORY_DRAG_ENABLED,
    onStart: onDragStartCategory,
    onEnd: onDragEndCategory,
    onDrop: (targetCategory) => onTouchDropCategory(targetCategory),
  });

  return (
    <div
      ref={touchRef}
      role="button"
      tabIndex={0}
      {...(CATEGORY_DRAG_ENABLED
        ? {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
              e.stopPropagation();
              e.dataTransfer.setData("application/x-category", category);
              e.dataTransfer.effectAllowed = "move";
              onDragStartCategory();
            },
            onDragEnd: onDragEndCategory,
          }
        : {})}
      onClick={(e) => e.stopPropagation()}
      title="Segure e arraste este ícone para reordenar a categoria"
      aria-label={`Arrastar para reordenar categoria ${label}`}
      className={cn(
        "p-2 rounded-xl text-muted-foreground transition-colors shrink-0",
        CATEGORY_DRAG_ENABLED && "cursor-grab active:cursor-grabbing hover:text-foreground hover:bg-muted/70 select-none touch-none"
      )}
    >
      <GripVertical className="h-5 w-5" />
    </div>
  );
}

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
  product_option_groups?: {
    id: string;
    name: string;
    min_options: number;
    max_options: number;
    required: boolean;
    product_options?: { id: string; name: string; price: number; is_active: boolean }[];
  }[];
}

const GLOBAL_CATEGORIES = [
  "Lanches",
  "Mercado",
  "Farmácia",
  "Restaurante",
  "Petiscaria",
  "Bebidas",
  "Shopping"
];

export const isForbiddenCategory = (cat: string | null | undefined): boolean => {
  if (!cat || typeof cat !== "string") return true;
  const lower = cat.trim().toLowerCase();
  return lower.includes("teste") || lower.includes("test");
};

// Drag de CATEGORIAS: mesmo padrão do produto (HTML5 nativo, sem pointer events).
const CATEGORY_DRAG_ENABLED = true;

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
  const { companyId: linkedCompanyId, company, isLoading: companyLoading } = useCurrentCompany();
  const companyId = linkedCompanyId;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Ordem manual de categorias e estado de recolhimento
  const [customCategoryOrder, setCustomCategoryOrder] = useState<string[]>([]);
  // Categorias realmente visíveis na tela (fonte de verdade para reordenar/limpar)
  const visibleCategoriesRef = useRef<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(`@epraja_collapsed_cats_${linkedCompanyId || "default"}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Drag state para produtos (NÍVEL 2)
  const dragId = useRef<string | null>(null);
  const dragCategory = useRef<string | null>(null);

  // Drag state para categorias (NÍVEL 1)
  const dragCategoryRef = useRef<string | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // (sem pointer events: categorias e produtos usam HTML5 nativo / touch events)


  // Sincroniza a ordem salva em company.category_order
  useEffect(() => {
    if (company?.category_order) {
      if (Array.isArray(company.category_order)) {
        setCustomCategoryOrder(company.category_order);
      } else if (typeof company.category_order === "string") {
        try {
          const parsed = JSON.parse(company.category_order);
          if (Array.isArray(parsed)) setCustomCategoryOrder(parsed);
        } catch {}
      }
    }
  }, [company?.category_order]);

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
        .select(`
          *,
          product_option_group_assignments (
            group_id,
            product_option_groups:group_id (
              id, name, min_options, max_options, required,
              product_options (id, name, price, is_active)
            )
          ),
          product_option_groups (
            id, name, min_options, max_options, required,
            product_options (id, name, price, is_active)
          )
        `)
        .eq("company_id", cId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      const normalizedProds = (prods || []).map((p: any) => {
        const groupsMap = new Map<string, any>();
        if (p.product_option_group_assignments && Array.isArray(p.product_option_group_assignments)) {
          for (const a of p.product_option_group_assignments) {
            const g = a.product_option_groups;
            if (g && g.id) {
              groupsMap.set(g.id, {
                ...g,
                min_options: g.required ? (g.min_options ?? 1) : 0,
              });
            }
          }
        }
        if (p.product_option_groups && Array.isArray(p.product_option_groups)) {
          for (const g of p.product_option_groups) {
            if (g && g.id && !groupsMap.has(g.id)) {
              groupsMap.set(g.id, {
                ...g,
                min_options: g.required ? (g.min_options ?? 1) : 0,
              });
            }
          }
        }
        return {
          ...p,
          product_option_groups: Array.from(groupsMap.values()),
        };
      });

      setProducts(normalizedProds);
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

    const { error } = await withSessionRetry(() =>
      supabase.from("products").delete().eq("id", id)
    );

    if (!error) {
      toast.success("Produto removido");
      fetchCompanyAndProducts();
      return;
    }

    const err = error as { code?: string; message?: string };

    // Produto já usado em pedidos: não pode ser apagado (FK). Desativamos.
    if (err.code === "23503") {
      const { error: deactivateError } = await withSessionRetry(() =>
        (supabase as any).from("products").update({ is_active: false }).eq("id", id)
      );
      if (deactivateError) {
        toast.error("Não foi possível remover nem desativar este produto.");
        return;
      }
      toast.success("Produto já usado em pedidos: foi desativado e não aparece mais no app.");
      fetchCompanyAndProducts();
      return;
    }

    if (isJwtExpiredError(error)) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }

    toast.error(`Erro ao remover produto: ${err.message || "erro desconhecido"}`);
  };


  // ── Drag & Drop handlers — restaurados de e4519e3 ─────────────────────────────
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

    setProducts(prev =>
      prev.map(p => {
        const found = updated.find(u => u.id === p.id);
        return found ?? p;
      })
    );

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

  // Mesmo fluxo do desktop, acionado pelo arrasto por toque (mobile)
  const handleTouchDropProduct = useCallback((sourceId: string, targetId: string) => {
    const source = products.find(p => p.id === sourceId);
    const target = products.find(p => p.id === targetId);
    
    if (!source || !target) return;
    dragId.current = sourceId;
    dragCategory.current = source.category || "Outros";
    handleDrop(targetId, target.category || "Outros");
  }, [products, handleDrop]);

  // ── Controle de Recolhimento de Categorias ────────────────────────────────────
  const toggleCategoryCollapse = (catValue: string) => {
    setCollapsedCategories(prev => {
      const next = { ...prev, [catValue]: !prev[catValue] };
      try {
        if (companyId) {
          localStorage.setItem(`@epraja_collapsed_cats_${companyId}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  // ── Persistência de Ordem das Categorias (com merge de concorrência e rollback) ─
  const saveCategoryOrder = async (newOrder: string[], previousOrder: string[]) => {
    setCustomCategoryOrder(newOrder);
    if (!companyId) return;

    try {
      // 1. Busca estado remoto recente para preservar categorias novas criadas concorrentemente
      let remoteCategories: string[] = [];
      try {
        const { data: compData } = await supabase
          .from("companies")
          .select("category_order")
          .eq("id", companyId)
          .maybeSingle();

        if (compData?.category_order) {
          if (Array.isArray(compData.category_order)) {
            remoteCategories = compData.category_order;
          } else if (typeof compData.category_order === "string") {
            try { remoteCategories = JSON.parse(compData.category_order); } catch {}
          }
        }
      } catch (fetchErr) {
        console.warn("Aviso ao ler category_order remoto:", fetchErr);
      }

      // 2. Preserva quaisquer categorias remotas novas que não constem na nova ordem local
      const mergedOrderRaw = [
        ...newOrder,
        ...remoteCategories.filter(c => typeof c === "string" && !newOrder.includes(c))
      ];

      // 3. Descarta categorias que não existem mais (evita crescer indefinidamente)
      const existing = visibleCategoriesRef.current;
      const mergedOrder = existing.length > 0
        ? mergedOrderRaw.filter(c => existing.includes(c))
        : mergedOrderRaw;



      const { error } = await (supabase as any)
        .from("companies")
        .update({ category_order: mergedOrder })
        .eq("id", companyId);

      if (error) {
        console.error("Erro ao salvar ordem das categorias:", error);
        // Rollback para a ordem anterior em caso de erro
        setCustomCategoryOrder(previousOrder);
        if (error.message?.includes("category_order") || error.code === "42703") {
          toast.info("Atenção: migration de category_order pendente no banco.");
        } else {
          toast.error("Não foi possível salvar a nova ordem. Ordem anterior restaurada.");
        }
      } else {
        toast.success("Ordem das categorias salva!");
        qc.invalidateQueries({ queryKey: ["current-company"] });
      }
    } catch (err) {
      console.error("Exceção ao persistir category_order:", err);
      setCustomCategoryOrder(previousOrder);
      toast.error("Erro de conexão ao salvar a ordem das categorias.");
    }
  };

  // ── Reordenação de Categorias (NÍVEL 1) ────────────────────────────────────────
  const reorderCategories = useCallback((sourceCat: string, targetCat: string) => {
    if (!sourceCat || !targetCat || sourceCat === targetCat) return;

    setCustomCategoryOrder(prev => {
      const visible = visibleCategoriesRef.current;

      // Base = ordem salva + qualquer categoria visível ainda não registrada (ex.: recém-criada)
      let currentList = prev.length > 0 ? [...prev] : [...visible];
      for (const cat of visible) {
        if (!currentList.includes(cat)) currentList.push(cat);
      }

      const srcIdx = currentList.indexOf(sourceCat);
      const tgtIdx = currentList.indexOf(targetCat);
      if (srcIdx === -1 || tgtIdx === -1) return prev;

      const previousOrder = [...prev];
      const [moved] = currentList.splice(srcIdx, 1);
      currentList.splice(tgtIdx, 0, moved);

      saveCategoryOrder(currentList, previousOrder);
      return currentList;
    });
  }, [companyId]);

  // Drag de categoria usa exclusivamente HTML5 nativo (sem pointer events).


  // Extrai todas as categorias únicas dos produtos cadastrados
  const rawCategories = Array.from(
    new Set(
      products
        .map(p => {
          const raw = p.category ? p.category.trim() : "Lanches";
          return isForbiddenCategory(raw) ? "Lanches" : raw;
        })
        .filter(Boolean)
    )
  );

  // Aplica ordem manual de categorias configurada pelo lojista, com fallback natural
  const allCategories = (() => {
    if (customCategoryOrder && customCategoryOrder.length > 0) {
      const ordered = customCategoryOrder.filter(c => rawCategories.includes(c));
      const remaining = rawCategories.filter(c => !customCategoryOrder.includes(c));
      return [...ordered, ...remaining];
    }
    return rawCategories;
  })();

  // Mantém customCategoryOrder sincronizado caso existam novas categorias
  useEffect(() => {
    if (allCategories.length > 0 && customCategoryOrder.length === 0) {
      setCustomCategoryOrder(allCategories);
    }
  }, [allCategories.length]);
  
  // Agrupa produtos por categoria, preservando a ordem definida
  const grouped = allCategories.map(catValue => {
    return {
      cat: { value: catValue, label: catValue },
      items: products
        .filter(p => {
          const raw = p.category ? p.category.trim() : "Lanches";
          const resolved = isForbiddenCategory(raw) ? "Lanches" : raw;
          return resolved === catValue;
        })
        .sort((a, b) => a.sort_order - b.sort_order)
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
            onClose={() => { setShowForm(false); setEditingProduct(null); fetchCompanyAndProducts(); }}
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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setIsBulkImportOpen(true)}
              disabled={!companyId}
              className="px-6 py-4 rounded-[2rem] bg-secondary text-foreground font-black flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              Importar Lote
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              disabled={!companyId}
              className="px-8 py-4 rounded-[2rem] gradient-primary text-primary-foreground font-black flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              <Plus className="h-6 w-6" />
              Novo Item
            </button>
          </div>
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
              type="button"
              onClick={() => setShowForm(true)}
              disabled={!companyId}
              className="px-10 py-4 rounded-2xl gradient-primary text-primary-foreground font-black text-lg shadow-xl disabled:opacity-50"
            >
              Começar agora
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(({ cat, items }) => {
              const isCollapsed = !!collapsedCategories[cat.value];
              const isDraggingThis = draggingCategory === cat.value;
              const isDropTarget = dragOverCategory === cat.value;

              return (
                <section
                  key={cat.value}
                  data-category-name={cat.value}
                  className="transition-all duration-200 rounded-3xl"
                >
                  {/* Cabeçalho da Categoria — handlers de drag só existem se CATEGORY_DRAG_ENABLED */}
                  <div
                    data-category-header={cat.value}
                    {...(CATEGORY_DRAG_ENABLED
                      ? {
                          onDragOver: (e: React.DragEvent) => {
                            if (dragCategoryRef.current && dragCategoryRef.current !== cat.value) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (dragOverCategory !== cat.value) {
                                setDragOverCategory(cat.value);
                              }
                            }
                          },
                          onDragLeave: (e: React.DragEvent) => {
                            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                              if (dragOverCategory === cat.value) {
                                setDragOverCategory(null);
                              }
                            }
                          },
                          onDrop: (e: React.DragEvent) => {
                            if (dragCategoryRef.current) {
                              e.preventDefault();
                              const src = dragCategoryRef.current;
                              dragCategoryRef.current = null;
                              setDraggingCategory(null);
                              setDragOverCategory(null);
                              reorderCategories(src, cat.value);
                            }
                          },
                        }
                      : {})}
                    className={cn(
                      "flex items-center justify-between gap-3 mb-5 px-3 py-2.5 rounded-2xl bg-card border shadow-sm transition-colors select-none data-[drop-target=true]:border-primary data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-primary/30",
                      isDropTarget ? "border-primary ring-2 ring-primary/30" : "border-border/50",
                      isDraggingThis && "cursor-grabbing"
                    )}
                  >
                    {/* Handle de categoria (NÍVEL 1) — HTML5 nativo no desktop, touch no mobile */}
                    <CategoryDragHandle
                      category={cat.value}
                      label={cat.label}
                      onDragStartCategory={() => {
                        dragCategoryRef.current = cat.value;
                        setDraggingCategory(cat.value);
                      }}
                      onDragEndCategory={() => {
                        dragCategoryRef.current = null;
                        setDraggingCategory(null);
                        setDragOverCategory(null);
                      }}
                      onTouchDropCategory={(targetCat) => {
                        dragCategoryRef.current = null;
                        setDraggingCategory(null);
                        setDragOverCategory(null);
                        reorderCategories(cat.value, targetCat);
                      }}
                    />


                    {/* Botão de Título e Seta para Recolher / Expandir */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(cat.value)}
                      aria-label={isCollapsed ? `Expandir categoria ${cat.label}` : `Recolher categoria ${cat.label}`}
                      className="flex items-center gap-2.5 text-left min-w-0 flex-1 group/toggle py-1 cursor-pointer"
                    >
                      <span className="p-1 rounded-lg text-muted-foreground group-hover/toggle:text-foreground group-hover/toggle:bg-muted transition-colors shrink-0">
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-primary" />
                        )}
                      </span>

                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4 text-primary" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-lg sm:text-xl tracking-tight text-foreground truncate group-hover/toggle:text-primary transition-colors">
                            {cat.label}
                          </h3>
                          {isCollapsed && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                              Recolhida
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {items.length} {items.length === 1 ? "item" : "itens"} · toque para {isCollapsed ? "expandir" : "recolher"}
                        </p>
                      </div>
                    </button>

                    <div className="flex-1 border-b border-dashed border-border/60 ml-2 hidden sm:block" />
                  </div>

                  {/* Grid de produtos (oculta visualmente quando a categoria estiver recolhida) */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
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
                          onTouchDropProduct={(targetId) => handleTouchDropProduct(product.id, targetId)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {companyId && (
        <BulkImportModal 
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          companyId={companyId}
          onSuccess={() => {
            setIsBulkImportOpen(false);
            fetchCompanyAndProducts();
          }}
        />
      )}
    </BusinessLayout>
  );
}

// ── Product Card (NÍVEL 2 - PRODUTO NATIVO) ───────────────────────────────────
function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
  onToggleFeatured,
  onDragStart,
  onDrop,
  onTouchDropProduct,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onToggleFeatured: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onTouchDropProduct?: (targetId: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);

  // Arrasto por toque (mobile) — mesmo fluxo, sem pointer events
  const touchRef = useTouchDragSort<HTMLDivElement>({
    selfId: product.id,
    targetSelector: "[data-product-id]",
    targetAttribute: "data-product-id",
    onStart: () => {
      setIsDragging(true);
      onDragStart();
    },
    onEnd: () => setIsDragging(false),
    onDrop: (targetId) => onTouchDropProduct?.(targetId),
  });

  const images = parseImages(product.image_url);
  const mainImage = images[0];

  // Contadores reais de personalização
  const groups = product.product_option_groups || [];
  const totalGroups = groups.length;
  const totalOptions = groups.reduce((acc, g) => {
    const activeOpts = (g.product_options || []).filter((o: any) => o.is_active !== false);
    return acc + activeOpts.length;
  }, 0);
  const hasPersonalization = totalGroups > 0;

  const groupText = `${totalGroups} ${totalGroups === 1 ? "grupo" : "grupos"}`;
  const optionText = `${totalOptions} ${totalOptions === 1 ? "opção" : "opções"}`;
  const personalizationSummary = `${groupText} · ${optionText}`;

  return (
    <div
      ref={touchRef}
      data-product-id={product.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", product.id);
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
      }}
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
        "bg-card border rounded-[2rem] overflow-hidden shadow-card transition-all duration-200 group relative flex flex-col h-full data-[drop-target=true]:border-primary data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-primary/30",
        !product.is_active && "opacity-75 grayscale-[0.3]",
        isDragging ? "cursor-grabbing" : "cursor-grab hover:shadow-xl hover:border-primary/25",
        isOver ? "border-primary ring-2 ring-primary/30" : "border-border/60",
      )}
    >
      {/* Drag Handle — visível no hover com pointer-events-none para que qualquer clique/arraste nele acione o card diretamente */}
      <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
          <GripVertical className="h-3 w-3" />
          Arrastar
        </span>
      </div>

      {/* Image Container com aspect-ratio consistente */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {mainImage ? (
          <img
            src={optimizeStorageImage(mainImage, { width: 400 })}
            alt={product.name}
            draggable={false}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/60">
            <ImagePlus className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Badges sutis no topo direito */}
        <div className="absolute top-3 right-3 flex gap-1.5 flex-wrap justify-end">
          {product.is_featured && (
            <span
              className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1"
              title="Produto em destaque no topo do cardápio"
            >
              <Star className="h-3 w-3 fill-current" /> Destaque
            </span>
          )}
          {!product.is_active && (
            <span
              className="bg-destructive text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md"
              title="Vendas pausadas para este produto"
            >
              Pausado
            </span>
          )}
        </div>

        {/* Floating Price em pill elegante */}
        <div className="absolute bottom-3 left-3">
          <div className="bg-background/95 backdrop-blur-md px-3 py-1 rounded-full border border-border/50 shadow-md">
            <span className="text-foreground font-black text-sm tracking-tight">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
      </div>

      {/* Info & Content — flexível para altura uniforme */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3
            className="font-black text-foreground text-base leading-snug truncate group-hover:text-primary transition-colors"
            title={product.name}
          >
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 font-medium leading-relaxed min-h-[2rem]">
            {product.description || "Sem descrição disponível"}
          </p>

          {/* Área de Personalização / Adicionais Limpa e Discreta */}
          {hasPersonalization ? (
            <div
              className="mt-3 flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-muted/40 border border-border/60 text-foreground transition-colors"
              title={personalizationSummary}
              aria-label={`Produto possui ${groupText} de personalização e ${optionText}`}
            >
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sliders className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/90 leading-none">
                  Personalização
                </p>
                <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                  {personalizationSummary}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 min-h-[42px] hidden sm:block" aria-hidden="true" />
          )}
        </div>

        {/* Actions Grid ancorado no rodapé */}
        <div className="flex flex-col gap-2 pt-3 border-t border-border/60 mt-auto">
          <button
            type="button"
            onClick={onEdit}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onToggleFeatured}
              className={cn(
                "h-9 rounded-xl flex items-center justify-center transition-all border text-xs",
                product.is_featured
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-amber-500/25"
                  : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={product.is_featured ? "Remover Destaque" : "Destacar Produto no Topo"}
              aria-label={product.is_featured ? "Remover Destaque" : "Destacar Produto no Topo"}
            >
              <Star className={cn("h-4 w-4", product.is_featured && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "h-9 rounded-xl flex items-center justify-center transition-all border text-xs",
                product.is_active
                  ? "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "bg-destructive/15 border-destructive/30 text-destructive hover:bg-destructive/25"
              )}
              title={product.is_active ? "Pausar Vendas" : "Ativar Vendas"}
              aria-label={product.is_active ? "Pausar Vendas" : "Ativar Vendas"}
            >
              {product.is_active ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-destructive" />}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="h-9 rounded-xl bg-muted/40 border border-border/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 flex items-center justify-center transition-all"
              title="Excluir Produto"
              aria-label="Excluir Produto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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
  const initialCategory = product?.category && !isForbiddenCategory(product.category)
    ? product.category.trim()
    : "Lanches";
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(initialCategory);
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_url ? parseImages(product.image_url) : []);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured || false);
  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [hasOptions, setHasOptions] = useState(false);
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      const safeCat = product.category && !isForbiddenCategory(product.category) ? product.category.trim() : "Lanches";
      setCategory(safeCat);
      setPrice(product.price?.toString() || "");
      setImageUrls(product.image_url ? parseImages(product.image_url) : []);
      setIsFeatured(product.is_featured || false);
    }
  }, [product]);

  useEffect(() => {
    if (product?.id) {
      setLoadingOptions(true);
      loadProductOptionGroups(product.id).then((grps) => {
        if (grps && grps.length > 0) {
          setHasOptions(true);
          setOptionGroups(grps);
        } else {
          setHasOptions(false);
          setOptionGroups([]);
        }
        setLoadingOptions(false);
      }).catch(() => {
        setLoadingOptions(false);
      });
    } else {
      setHasOptions(false);
      setOptionGroups([]);
    }
  }, [product?.id]);

  const customCategoriesFromStore = (existingCategories || []).filter(
    (c) => c && typeof c === "string" && !GLOBAL_CATEGORIES.includes(c) && !isForbiddenCategory(c)
  );

  const currentTrimmedCategory = category ? category.trim() : "";
  const isCurrentCategoryNew =
    currentTrimmedCategory &&
    !GLOBAL_CATEGORIES.includes(currentTrimmedCategory) &&
    !isForbiddenCategory(currentTrimmedCategory) &&
    !customCategoriesFromStore.includes(currentTrimmedCategory);

  const allCustomCategories = [
    ...customCategoriesFromStore,
    ...(isCurrentCategoryNew ? [currentTrimmedCategory] : []),
  ].filter(c => !isForbiddenCategory(c));

  const ALL_CHIPS = [
    ...GLOBAL_CATEGORIES.map((c) => ({ name: c, type: "global" })),
    ...allCustomCategories.map((c) => ({ name: c, type: "custom" })),
  ].filter(chip => !isForbiddenCategory(chip.name));

  const MAX_VISIBLE = ALL_CHIPS.length;
  const displayedChips = ALL_CHIPS;
  const hiddenCount = 0;

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
      const publicUrl = data.publicUrl;
      setImageUrls([...imageUrls, publicUrl]);
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
    if (isSubmittingRef.current) return;
    if (imageUrls.length === 0) { toast.error("Adicione pelo menos 1 foto"); return; }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const imagePayload = JSON.stringify(imageUrls);
      const safeCategory = isForbiddenCategory(category) ? "Lanches" : (category?.trim() || "Lanches");
      const payload: Record<string, unknown> = {
        name,
        description: description || null,
        category: safeCategory,
        price: parseFloat(price.replace(",", ".")),
        image_url: imagePayload,
        is_featured: isFeatured,
      };

      let savedProductId = product?.id;

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        payload.sort_order = categoryCount;
        const { data: newProd, error } = await supabase
          .from("products")
          .insert([{ ...payload, company_id: companyId, is_active: true }])
          .select("id")
          .single();
        if (error) throw error;
        savedProductId = newProd?.id;
        toast.success("Produto publicado!");
      }

      // Sincroniza grupos de adicionais e opções apenas se for um novo produto
      const isNewProduct = !product;
      if (savedProductId && isNewProduct) {
        await saveProductOptionGroups(savedProductId, hasOptions, optionGroups, true, companyId);
      }

      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <button
        type="button"
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
                  value={isForbiddenCategory(category) ? "Lanches" : category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Ex: Lanches, Bebidas..."
                  className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                  required
                />
                
                {/* Category Chips com destaque azul para categorias novas/customizadas */}
                <div className="flex flex-wrap gap-2 pb-2 pt-1">
                  {displayedChips.map(chip => {
                    const isSelected = category === chip.name;
                    const isCustom = chip.type === 'custom';

                    return (
                      <button
                        key={`${chip.type}-${chip.name}`}
                        type="button"
                        onClick={() => setCategory(chip.name)}
                        className={cn(
                          "shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm flex items-center gap-1.5",
                          isCustom
                            ? isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 scale-105 ring-2 ring-blue-400"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-300 font-extrabold"
                            : isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200 font-bold"
                        )}
                      >
                        {isCustom && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        {chip.name}
                        {isCustom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-700 ml-1 font-black uppercase">
                            Nova
                          </span>
                        )}
                      </button>
                    );
                  })}
                  
                  {!showAllCategories && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(true)}
                      className="shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dashed border-border text-muted-foreground hover:bg-muted/50"
                    >
                      +{hiddenCount} MAIS
                    </button>
                  )}
                  {showAllCategories && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(false)}
                      className="shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dashed border-border text-muted-foreground hover:bg-muted/50"
                    >
                      OCULTAR
                    </button>
                  )}
                </div>
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

              {/* Personalização / Adicionais */}
              <div className="pt-4 border-t border-border/60">
                <ProductOptionGroupsManager
                  productId={product?.id}
                  companyId={companyId}
                  hasOptions={hasOptions}
                  onToggleHasOptions={setHasOptions}
                  groups={optionGroups}
                  onChange={setOptionGroups}
                  loadingOptions={loadingOptions}
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
                  <img src={optimizeStorageImage(url, { width: 300 })} alt="Prod" loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
