import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Check, X, Layers, ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

/**
 * Carrega grupos e opções oficiais de um produto existente
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
    // Se o lojista definiu que não possui opções, remove grupos existentes desse produto
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
  groups: OptionGroupDraft[];
  onChange: (groups: OptionGroupDraft[]) => void;
}

export function ProductOptionGroupsManager({
  productId,
  groups,
  onChange,
}: ProductOptionGroupsManagerProps) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingMinOptions, setEditingMinOptions] = useState(0);
  const [editingMaxOptions, setEditingMaxOptions] = useState(1);
  const [editingRequired, setEditingRequired] = useState(false);

  // Estado para adicionar nova opção
  const [addingOptionGroupId, setAddingOptionGroupId] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("");

  const handleOpenAddGroup = () => {
    const tempId = `temp_group_${Date.now()}`;
    const newGroup: OptionGroupDraft = {
      id: tempId,
      name: "",
      min_options: 0,
      max_options: 1,
      required: false,
      options: [],
      isNew: true,
    };
    onChange([...groups, newGroup]);
    setEditingGroupId(tempId);
    setEditingGroupName("");
    setEditingMinOptions(0);
    setEditingMaxOptions(1);
    setEditingRequired(false);
  };

  const handleStartEditGroup = (group: OptionGroupDraft) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingMinOptions(group.min_options);
    setEditingMaxOptions(group.max_options);
    setEditingRequired(group.required);
  };

  const handleSaveGroupEdit = (groupId: string) => {
    if (!editingGroupName.trim()) {
      toast.error("O nome do grupo não pode ser vazio.");
      return;
    }
    const min = Math.max(0, Number(editingMinOptions) || 0);
    const max = Math.max(min, Math.max(1, Number(editingMaxOptions) || 1));

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          name: editingGroupName.trim(),
          min_options: min,
          max_options: max,
          required: editingRequired || min > 0,
        };
      }
      return g;
    });

    onChange(updated);
    setEditingGroupId(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    onChange(groups.filter((g) => g.id !== groupId));
    if (editingGroupId === groupId) setEditingGroupId(null);
  };

  const handleAddOption = (groupId: string) => {
    if (!newOptionName.trim()) {
      toast.error("Informe o nome do adicional.");
      return;
    }
    const priceNum = parseFloat(newOptionPrice.replace(",", ".")) || 0;
    if (priceNum < 0) {
      toast.error("O preço não pode ser negativo.");
      return;
    }

    const tempOptId = `temp_opt_${Date.now()}`;
    const newOpt: OptionDraft = {
      id: tempOptId,
      name: newOptionName.trim(),
      price: priceNum,
      is_active: true,
      isNew: true,
    };

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: [...g.options, newOpt],
        };
      }
      return g;
    });

    onChange(updated);
    setNewOptionName("");
    setNewOptionPrice("");
    setAddingOptionGroupId(null);
  };

  const handleDeleteOption = (groupId: string, optionId: string) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.filter((o) => o.id !== optionId),
        };
      }
      return g;
    });
    onChange(updated);
  };

  const handleToggleOptionStatus = (groupId: string, optionId: string) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.map((o) => (o.id === optionId ? { ...o, is_active: !o.is_active } : o)),
        };
      }
      return g;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Grupos de Adicionais / Complementos</h4>
          <p className="text-xs text-muted-foreground">
            Ex: "Turbine seu Lanche", "Molho Verde Grátis", etc.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddGroup}
          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Adicionar Grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-border text-center bg-muted/20">
          <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs font-semibold text-muted-foreground">
            Nenhum grupo de adicionais configurado para este produto.
          </p>
          <button
            type="button"
            onClick={handleOpenAddGroup}
            className="mt-3 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Criar o primeiro grupo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, groupIdx) => {
            const isEditing = editingGroupId === group.id;

            return (
              <div
                key={group.id || groupIdx}
                className="rounded-2xl border border-border bg-card p-4 space-y-3 transition-all"
              >
                {isEditing ? (
                  <div className="space-y-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                    <div>
                      <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                        Nome do Grupo
                      </label>
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        placeholder="Ex: Turbine seu Lanche"
                        className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                          Escolha Mínima
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingMinOptions}
                          onChange={(e) => setEditingMinOptions(parseInt(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                          Escolha Máxima
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editingMaxOptions}
                          onChange={(e) => setEditingMaxOptions(parseInt(e.target.value) || 1)}
                          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id={`req_${group.id}`}
                        checked={editingRequired}
                        onChange={(e) => setEditingRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary accent-primary"
                      />
                      <label
                        htmlFor={`req_${group.id}`}
                        className="text-xs font-semibold text-foreground cursor-pointer"
                      >
                        Obrigatório (o cliente deve escolher ao menos uma opção)
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveGroupEdit(group.id)}
                        className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                      >
                        Salvar Grupo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{group.name || "Sem Nome"}</span>
                        {group.required && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded-md">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {group.max_options === 1
                          ? "Escolha única (1 opção)"
                          : `Escolha de ${group.min_options} até ${group.max_options} opções`}
                        {" • "}
                        <span className="font-medium text-foreground">
                          {group.options.length} {group.options.length === 1 ? "adicional" : "adicionais"}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEditGroup(group)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar regras do grupo"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        title="Excluir grupo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de Opções do Grupo */}
                <div className="pl-2 pt-2 border-t border-border/40 space-y-2">
                  <div className="space-y-1.5">
                    {group.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/30 border border-border/30 text-xs transition-colors",
                          !opt.is_active && "opacity-50 grayscale"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{opt.name}</span>
                          <span className="text-muted-foreground font-bold">
                            {opt.price === 0
                              ? "Grátis"
                              : `+ R$ ${opt.price.toFixed(2).replace(".", ",")}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleOptionStatus(group.id, opt.id)}
                            className={cn(
                              "p-1 rounded-md transition-colors",
                              opt.is_active
                                ? "text-emerald-600 hover:bg-emerald-500/10"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                            title={opt.is_active ? "Pausar adicional" : "Ativar adicional"}
                          >
                            {opt.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOption(group.id, opt.id)}
                            className="p-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir adicional"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Adicionar nova opção */}
                  {addingOptionGroupId === group.id ? (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={newOptionName}
                        onChange={(e) => setNewOptionName(e.target.value)}
                        placeholder="Nome (ex: Bacon)"
                        className="flex-1 h-9 px-3 rounded-xl bg-background border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOptionPrice}
                          onChange={(e) => setNewOptionPrice(e.target.value)}
                          placeholder="Preço (ex: 6,00)"
                          className="w-28 h-9 px-3 rounded-xl bg-background border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddOption(group.id)}
                          className="px-3 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingOptionGroupId(null);
                            setNewOptionName("");
                            setNewOptionPrice("");
                          }}
                          className="px-2 h-9 rounded-xl text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingOptionGroupId(group.id);
                        setNewOptionName("");
                        setNewOptionPrice("");
                      }}
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 pt-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Adicional
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
