import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Layers,
  Eye,
  EyeOff,
  MoreVertical,
  Sliders,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface OptionDraft {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  isNew?: boolean;
}

export interface OptionGroupDraft {
  id: string;
  name: string;
  min_options: number;
  max_options: number;
  required: boolean;
  options: OptionDraft[];
  isNew?: boolean;
}

export function formatBRL(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Carrega grupos e opções oficiais de um produto existente no Supabase
 */
export async function loadProductOptionGroups(productId: string): Promise<OptionGroupDraft[]> {
  try {
    const { data, error } = await supabase
      .from("product_option_groups")
      .select("*, product_options(*)")
      .eq("product_id", productId)
      .order("created_at");

    if (error) {
      console.error("Erro ao carregar grupos:", error);
      return [];
    }

    return (data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      min_options: g.min_options ?? 0,
      max_options: g.max_options ?? 1,
      required: g.required ?? false,
      options: (g.product_options || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price || 0),
        is_active: o.is_active ?? true,
      })),
    }));
  } catch (err) {
    console.error("Exceção ao carregar grupos do produto:", err);
    return [];
  }
}

/**
 * Sincroniza e persiste grupos e opções no banco de dados (product_option_groups e product_options)
 */
export async function saveProductOptionGroups(
  productId: string,
  hasOptions: boolean,
  groups: OptionGroupDraft[]
) {
  if (!hasOptions || groups.length === 0) {
    await supabase.from("product_option_groups").delete().eq("product_id", productId);
    return;
  }

  // 1. Busca grupos já existentes no banco para detectar exclusões
  const { data: existingGroups } = await supabase
    .from("product_option_groups")
    .select("id, product_options(id)")
    .eq("product_id", productId);

  const existingGroupIds = (existingGroups || []).map((g: any) => g.id);
  const currentGroupIds = groups.filter((g) => !g.isNew && !g.id.startsWith("temp_")).map((g) => g.id);

  // Deleta grupos que foram removidos
  const groupsToDelete = existingGroupIds.filter((id: string) => !currentGroupIds.includes(id));
  if (groupsToDelete.length > 0) {
    await supabase.from("product_option_groups").delete().in("id", groupsToDelete);
  }

  // 2. Salva / Atualiza cada grupo
  for (const group of groups) {
    let groupId = group.id;
    const isNewGroup = group.isNew || group.id.startsWith("temp_");

    if (isNewGroup) {
      const { data: createdGroup, error: grpErr } = await supabase
        .from("product_option_groups")
        .insert({
          product_id: productId,
          name: group.name,
          min_options: group.min_options,
          max_options: group.max_options,
          required: group.required,
        })
        .select("id")
        .single();

      if (grpErr || !createdGroup) {
        console.error("Erro ao criar grupo de opções:", grpErr);
        continue;
      }
      groupId = createdGroup.id;
    } else {
      await supabase
        .from("product_option_groups")
        .update({
          name: group.name,
          min_options: group.min_options,
          max_options: group.max_options,
          required: group.required,
        })
        .eq("id", groupId);
    }

    // 3. Salva / Atualiza opções do grupo
    const existingGroupRecord = (existingGroups || []).find((g: any) => g.id === groupId);
    const existingOptionIds = (existingGroupRecord?.product_options || []).map((o: any) => o.id);
    const currentOptionIds = group.options
      .filter((o) => !o.isNew && !o.id.startsWith("temp_"))
      .map((o) => o.id);

    // Deleta opções removidas do grupo
    const optionsToDelete = existingOptionIds.filter((id: string) => !currentOptionIds.includes(id));
    if (optionsToDelete.length > 0) {
      await supabase.from("product_options").delete().in("id", optionsToDelete);
    }

    for (const opt of group.options) {
      const isNewOpt = opt.isNew || opt.id.startsWith("temp_");
      if (isNewOpt) {
        await supabase.from("product_options").insert({
          group_id: groupId,
          name: opt.name,
          price: opt.price,
          is_active: opt.is_active,
        });
      } else {
        await supabase
          .from("product_options")
          .update({
            name: opt.name,
            price: opt.price,
            is_active: opt.is_active,
          })
          .eq("id", opt.id);
      }
    }
  }
}

interface ProductOptionGroupsManagerProps {
  productId?: string;
  hasOptions: boolean;
  onToggleHasOptions: (active: boolean) => void;
  groups: OptionGroupDraft[];
  onChange: (groups: OptionGroupDraft[]) => void;
  loadingOptions?: boolean;
}

export function ProductOptionGroupsManager({
  hasOptions,
  onToggleHasOptions,
  groups,
  onChange,
  loadingOptions,
}: ProductOptionGroupsManagerProps) {
  // Modal de Grupo (Criar / Editar)
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<"create" | "edit">("create");
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [groupFormName, setGroupFormName] = useState("");
  const [groupFormMin, setGroupFormMin] = useState(0);
  const [groupFormMax, setGroupFormMax] = useState(20);
  const [groupFormRequired, setGroupFormRequired] = useState(false);

  // Modal de Opção (Criar / Editar)
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [optionModalMode, setOptionModalMode] = useState<"create" | "edit">("create");
  const [targetOptionGroupId, setTargetOptionGroupId] = useState<string | null>(null);
  const [targetOptionId, setTargetOptionId] = useState<string | null>(null);
  const [optionFormName, setOptionFormName] = useState("");
  const [optionFormPrice, setOptionFormPrice] = useState("");
  const [optionFormActive, setOptionFormActive] = useState(true);

  // Confirmações de Exclusão
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<OptionGroupDraft | null>(null);
  const [deleteOptionTarget, setDeleteOptionTarget] = useState<{ groupId: string; option: OptionDraft } | null>(null);

  // ----------------------------------------------------
  // HANDLERS DE GRUPO
  // ----------------------------------------------------
  const handleOpenCreateGroup = () => {
    setGroupModalMode("create");
    setTargetGroupId(null);
    setGroupFormName("");
    setGroupFormMin(0);
    setGroupFormMax(20);
    setGroupFormRequired(false);
    setGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group: OptionGroupDraft) => {
    setGroupModalMode("edit");
    setTargetGroupId(group.id);
    setGroupFormName(group.name);
    setGroupFormMin(group.min_options);
    setGroupFormMax(group.max_options);
    setGroupFormRequired(group.required);
    setGroupModalOpen(true);
  };

  const handleSaveGroupModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupFormName.trim();
    if (!trimmed) {
      toast.error("Informe o nome do grupo.");
      return;
    }

    const min = Math.max(0, Number(groupFormMin) || 0);
    const max = Math.max(min, Math.max(1, Number(groupFormMax) || 1));
    const req = groupFormRequired || min > 0;

    if (groupModalMode === "create") {
      const newGroup: OptionGroupDraft = {
        id: `temp_group_${Date.now()}`,
        name: trimmed,
        min_options: min,
        max_options: max,
        required: req,
        options: [],
        isNew: true,
      };
      onChange([...groups, newGroup]);
      toast.success(`Grupo "${trimmed}" criado!`);
    } else if (targetGroupId) {
      const updated = groups.map((g) =>
        g.id === targetGroupId
          ? {
              ...g,
              name: trimmed,
              min_options: min,
              max_options: max,
              required: req,
            }
          : g
      );
      onChange(updated);
      toast.success("Grupo atualizado com sucesso!");
    }

    setGroupModalOpen(false);
  };

  const handleConfirmDeleteGroup = () => {
    if (!deleteGroupTarget) return;
    const idToDelete = deleteGroupTarget.id;
    const name = deleteGroupTarget.name;
    onChange(groups.filter((g) => g.id !== idToDelete));
    setDeleteGroupTarget(null);
    toast.success(`Grupo "${name}" excluído.`);
  };

  // ----------------------------------------------------
  // HANDLERS DE OPÇÃO
  // ----------------------------------------------------
  const handleOpenCreateOption = (groupId: string) => {
    setOptionModalMode("create");
    setTargetOptionGroupId(groupId);
    setTargetOptionId(null);
    setOptionFormName("");
    setOptionFormPrice("");
    setOptionFormActive(true);
    setOptionModalOpen(true);
  };

  const handleOpenEditOption = (groupId: string, opt: OptionDraft) => {
    setOptionModalMode("edit");
    setTargetOptionGroupId(groupId);
    setTargetOptionId(opt.id);
    setOptionFormName(opt.name);
    setOptionFormPrice(opt.price === 0 ? "0,00" : opt.price.toFixed(2).replace(".", ","));
    setOptionFormActive(opt.is_active);
    setOptionModalOpen(true);
  };

  const handleSaveOptionModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = optionFormName.trim();
    if (!trimmedName) {
      toast.error("Informe o nome da opção (ex: Bacon, Cheddar).");
      return;
    }

    const cleanedPriceStr = optionFormPrice.replace(/[^0-9.,]/g, "").replace(",", ".");
    const priceNum = cleanedPriceStr === "" ? 0 : parseFloat(cleanedPriceStr);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Informe um preço adicional válido (ex: 6,00 ou 0 para grátis).");
      return;
    }

    if (!targetOptionGroupId) return;

    if (optionModalMode === "create") {
      const newOpt: OptionDraft = {
        id: `temp_opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmedName,
        price: priceNum,
        is_active: optionFormActive,
        isNew: true,
      };

      const updated = groups.map((g) => {
        if (g.id === targetOptionGroupId) {
          return { ...g, options: [...g.options, newOpt] };
        }
        return g;
      });

      onChange(updated);
      toast.success(`Opção "${trimmedName}" adicionada!`);
    } else if (targetOptionId) {
      const updated = groups.map((g) => {
        if (g.id === targetOptionGroupId) {
          return {
            ...g,
            options: g.options.map((o) =>
              o.id === targetOptionId
                ? {
                    ...o,
                    name: trimmedName,
                    price: priceNum,
                    is_active: optionFormActive,
                  }
                : o
            ),
          };
        }
        return g;
      });

      onChange(updated);
      toast.success("Opção atualizada!");
    }

    setOptionModalOpen(false);
  };

  const handleToggleOptionActive = (groupId: string, optionId: string) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.map((o) =>
            o.id === optionId ? { ...o, is_active: !o.is_active } : o
          ),
        };
      }
      return g;
    });

    onChange(updated);
  };

  const handleConfirmDeleteOption = () => {
    if (!deleteOptionTarget) return;
    const { groupId, option } = deleteOptionTarget;

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.filter((o) => o.id !== option.id),
        };
      }
      return g;
    });

    onChange(updated);
    setDeleteOptionTarget(null);
    toast.success(`Opção "${option.name}" removida.`);
  };

  // ----------------------------------------------------
  // ESTADO DESATIVADO
  // ----------------------------------------------------
  if (!hasOptions) {
    return (
      <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-foreground uppercase tracking-wider">
            Personalização
          </h4>
          <p className="text-xs text-muted-foreground font-medium">
            Este produto não possui opções de personalização.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggleHasOptions(true)}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-md shrink-0"
        >
          Ativar
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // ESTADO ATIVADO
  // ----------------------------------------------------
  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho da Seção Ativada */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h4 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            PERSONALIZAÇÃO
          </h4>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            O cliente poderá escolher entre as opções configuradas abaixo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggleHasOptions(false)}
          className="text-xs font-bold text-muted-foreground hover:text-destructive px-3 py-1.5 rounded-lg border border-border/60 hover:border-destructive/30 hover:bg-destructive/5 transition-all self-start sm:self-auto"
        >
          Desativar
        </button>
      </div>

      {/* 2. Área de Grupos */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
              GRUPOS DE OPÇÕES
            </h5>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Organize os adicionais em grupos para facilitar a escolha do cliente.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateGroup}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            Novo grupo
          </button>
        </div>

        {/* Loading indicator */}
        {loadingOptions && (
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground p-4 bg-muted/20 rounded-2xl border border-dashed border-border">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Carregando grupos e opções...
          </div>
        )}

        {/* Empty state de grupos */}
        {!loadingOptions && groups.length === 0 && (
          <div className="p-8 rounded-3xl border-2 border-dashed border-border/80 text-center bg-muted/20 space-y-3">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Nenhum grupo de opções criado
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-0.5 font-medium">
                Crie grupos como "Turbine seu Lanche", "Escolha seu Molho" ou "Bebidas" para organizar as opções.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateGroup}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Criar primeiro grupo
            </button>
          </div>
        )}

        {/* 3. Cards de Grupos Independentes */}
        <div className="space-y-5">
          {groups.map((group) => {
            const isSingleChoice = group.max_options === 1;
            const isRequired = group.required || group.min_options > 0;

            let ruleSummary = "";
            if (isSingleChoice && isRequired) {
              ruleSummary = "Escolha 1 opção • Obrigatório";
            } else if (isSingleChoice) {
              ruleSummary = "Escolha até 1 opção • Opcional";
            } else if (!isRequired) {
              ruleSummary = `Escolha de 0 a ${group.max_options} opções • Opcional`;
            } else {
              ruleSummary = `Escolha de ${group.min_options} a ${group.max_options} opções • Obrigatório`;
            }

            return (
              <div
                key={group.id}
                className="rounded-3xl border border-border bg-card shadow-sm p-6 space-y-4 transition-all relative overflow-hidden"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-black text-foreground tracking-tight">
                        {group.name}
                      </h4>
                      {isRequired ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-md border border-rose-500/20">
                          OBRIGATÓRIO
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/60">
                          OPCIONAL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {ruleSummary}
                    </p>
                  </div>

                  {/* Menu ⋮ do Grupo */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-8 w-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        aria-label="Ações do grupo"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleOpenEditGroup(group)}>
                        <Edit3 className="h-3.5 w-3.5 mr-2" /> Editar grupo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteGroupTarget(group)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir grupo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Separador */}
                <div className="border-t border-border/50 pt-3 space-y-3">
                  {/* Contador de Opções */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                      OPÇÕES ({group.options.length})
                    </span>
                  </div>

                  {/* Lista de Opções */}
                  {group.options.length === 0 ? (
                    <div className="py-7 px-4 text-center bg-muted/20 rounded-2xl border border-dashed border-border/80 space-y-2.5">
                      <div className="text-base text-primary/80 font-bold">✦</div>
                      <p className="text-xs font-bold text-foreground">Nenhuma opção cadastrada</p>
                      <p className="text-[11px] text-muted-foreground max-w-xs mx-auto font-medium">
                        Adicione opções para o cliente escolher ao pedir este item.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateOption(group.id)}
                        className="mt-1 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar primeira opção
                      </button>
                    </div>
                  ) : (
                    <div className="border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40 bg-background/50">
                      {group.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 text-sm transition-colors",
                            !opt.is_active && "bg-muted/30"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Marcador ○ */}
                            <span className={cn("text-xs shrink-0 select-none", opt.is_active ? "text-muted-foreground" : "text-muted-foreground/40")}>
                              ○
                            </span>

                            <span className={cn(
                              "font-semibold text-sm truncate",
                              opt.is_active ? "text-foreground" : "text-muted-foreground line-through"
                            )}>
                              {opt.name}
                            </span>

                            {!opt.is_active && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md shrink-0 border border-amber-500/20">
                                DESATIVADO
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={cn(
                              "font-bold text-sm tracking-tight",
                              opt.is_active ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {formatBRL(opt.price)}
                            </span>

                            {/* Menu ⋮ da Opção */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  aria-label="Ações da opção"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleOpenEditOption(group.id, opt)}>
                                  <Edit3 className="h-3.5 w-3.5 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleOptionActive(group.id, opt.id)}>
                                  {opt.is_active ? (
                                    <>
                                      <EyeOff className="h-3.5 w-3.5 mr-2 text-amber-600" /> Desativar
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Ativar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteOptionTarget({ groupId: group.id, option: opt })}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botão + Adicionar opção */}
                  {group.options.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateOption(group.id)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98"
                    >
                      <Plus className="h-4 w-4" /> Adicionar opção
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL: CRIAR / EDITAR GRUPO DE OPÇÕES */}
      {/* ==================================================== */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <form onSubmit={handleSaveGroupModal} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                {groupModalMode === "create" ? "Novo grupo de opções" : "Editar grupo de opções"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Defina quantas opções o cliente poderá escolher.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Nome do grupo *
                </label>
                <input
                  type="text"
                  value={groupFormName}
                  onChange={(e) => setGroupFormName(e.target.value)}
                  placeholder="Ex: Turbine seu Lanche"
                  className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Escolha mínima
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={groupFormMin}
                    onChange={(e) => setGroupFormMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                    Mínimo = quantidade mínima obrigatória
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Escolha máxima
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={groupFormMax}
                    onChange={(e) => setGroupFormMax(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                    Máximo = quantidade máxima permitida
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/40">
                <div>
                  <label className="text-xs font-bold text-foreground block">
                    Obrigatório
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    O cliente é obrigado a selecionar uma opção?
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60">
                  <button
                    type="button"
                    onClick={() => setGroupFormRequired(false)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      !groupFormRequired
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupFormRequired(true)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      groupFormRequired
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                {groupModalMode === "create" ? "Criar grupo" : "Salvar alterações"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL: CRIAR / EDITAR OPÇÃO */}
      {/* ==================================================== */}
      <Dialog open={optionModalOpen} onOpenChange={setOptionModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <form onSubmit={handleSaveOptionModal} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                {optionModalMode === "create" ? "Nova opção" : "Editar opção"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Esse valor será acrescentado ao preço do produto quando o cliente escolher esta opção.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Nome da opção *
                </label>
                <input
                  type="text"
                  value={optionFormName}
                  onChange={(e) => setOptionFormName(e.target.value)}
                  placeholder="Ex: Bacon, Cheddar, Barbecue..."
                  className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Preço adicional *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <input
                    type="text"
                    value={optionFormPrice}
                    onChange={(e) => setOptionFormPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0,00"
                    className="w-full h-11 pl-11 pr-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                  Deixe 0,00 para opções gratuitas
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/40">
                <div>
                  <label className="text-xs font-bold text-foreground block">
                    Disponibilidade
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Define se o cliente pode pedir esta opção agora
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60">
                  <button
                    type="button"
                    onClick={() => setOptionFormActive(true)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all",
                      optionFormActive
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Disponível
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptionFormActive(false)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      !optionFormActive
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Indisponível
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setOptionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                {optionModalMode === "create" ? "Adicionar opção" : "Salvar alterações"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIÁLOGO DE CONFIRMAÇÃO: EXCLUIR GRUPO */}
      {/* ==================================================== */}
      <Dialog open={!!deleteGroupTarget} onOpenChange={(open) => !open && setDeleteGroupTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <DialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Excluir grupo?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Todas as opções cadastradas no grupo <strong>"{deleteGroupTarget?.name}"</strong> também serão removidas.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row justify-end gap-2 pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={() => setDeleteGroupTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteGroup}
              className="px-5 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 shadow-sm"
            >
              Excluir grupo
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIÁLOGO DE CONFIRMAÇÃO: EXCLUIR OPÇÃO */}
      {/* ==================================================== */}
      <Dialog open={!!deleteOptionTarget} onOpenChange={(open) => !open && setDeleteOptionTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <DialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <Trash2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Excluir esta opção?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tem certeza que deseja remover a opção <strong>"{deleteOptionTarget?.option.name}"</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row justify-end gap-2 pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={() => setDeleteOptionTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteOption}
              className="px-5 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 shadow-sm"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
