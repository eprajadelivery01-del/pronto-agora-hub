import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Check, X, Layers, Eye, EyeOff, Tag, DollarSign, CheckCircle2 } from "lucide-react";
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
  groups,
  onChange,
}: ProductOptionGroupsManagerProps) {
  // Controle de criação de novo grupo
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMin, setNewGroupMin] = useState(0);
  const [newGroupMax, setNewGroupMax] = useState(20);
  const [newGroupRequired, setNewGroupRequired] = useState(false);

  // Controle de edição de grupo existente
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupMin, setEditGroupMin] = useState(0);
  const [editGroupMax, setEditGroupMax] = useState(20);
  const [editGroupRequired, setEditGroupRequired] = useState(false);

  // Controle de adição de novo adicional
  const [addingOptionGroupId, setAddingOptionGroupId] = useState<string | null>(null);
  const [newOptName, setNewOptName] = useState("");
  const [newOptPrice, setNewOptPrice] = useState("");
  const [newOptActive, setNewOptActive] = useState(true);

  // Controle de edição de adicional existente
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptName, setEditOptName] = useState("");
  const [editOptPrice, setEditOptPrice] = useState("");
  const [editOptActive, setEditOptActive] = useState(true);

  // ----------------------------------------------------
  // GESTÃO DE GRUPOS
  // ----------------------------------------------------
  const handleOpenCreateGroup = () => {
    setIsCreatingGroup(true);
    setNewGroupName("");
    setNewGroupMin(0);
    setNewGroupMax(20);
    setNewGroupRequired(false);
  };

  const handleSaveNewGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      toast.error("Informe o nome do grupo.");
      return;
    }

    const min = Math.max(0, Number(newGroupMin) || 0);
    const max = Math.max(min, Math.max(1, Number(newGroupMax) || 1));

    const newGroup: OptionGroupDraft = {
      id: `temp_group_${Date.now()}`,
      name: trimmed,
      min_options: min,
      max_options: max,
      required: newGroupRequired || min > 0,
      options: [],
      isNew: true,
    };

    onChange([...groups, newGroup]);
    setIsCreatingGroup(false);
    toast.success(`Grupo "${trimmed}" adicionado! Agora cadastre os adicionais dele.`);
  };

  const handleStartEditGroup = (group: OptionGroupDraft) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupMin(group.min_options);
    setEditGroupMax(group.max_options);
    setEditGroupRequired(group.required);
  };

  const handleSaveEditGroup = (groupId: string) => {
    const trimmed = editGroupName.trim();
    if (!trimmed) {
      toast.error("O nome do grupo não pode ser vazio.");
      return;
    }

    const min = Math.max(0, Number(editGroupMin) || 0);
    const max = Math.max(min, Math.max(1, Number(editGroupMax) || 1));

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          name: trimmed,
          min_options: min,
          max_options: max,
          required: editGroupRequired || min > 0,
        };
      }
      return g;
    });

    onChange(updated);
    setEditingGroupId(null);
    toast.success("Regras do grupo atualizadas!");
  };

  const handleDeleteGroup = (group: OptionGroupDraft) => {
    if (!confirm(`Deseja realmente excluir o grupo "${group.name}" e todos os seus adicionais?`)) {
      return;
    }

    onChange(groups.filter((g) => g.id !== group.id));
    if (editingGroupId === group.id) setEditingGroupId(null);
    if (addingOptionGroupId === group.id) setAddingOptionGroupId(null);
    toast.success(`Grupo "${group.name}" removido.`);
  };

  // ----------------------------------------------------
  // GESTÃO DE ADICIONAIS DENTRO DE UM GRUPO
  // ----------------------------------------------------
  const handleOpenAddOption = (groupId: string) => {
    setAddingOptionGroupId(groupId);
    setNewOptName("");
    setNewOptPrice("");
    setNewOptActive(true);
  };

  const handleSaveNewOption = (groupId: string) => {
    const trimmedName = newOptName.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do adicional (ex: Bacon).");
      return;
    }

    const cleanedPriceStr = newOptPrice.replace(/[^0-9.,]/g, "").replace(",", ".");
    const priceNum = cleanedPriceStr === "" ? 0 : parseFloat(cleanedPriceStr);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Informe um preço válido (ex: 6,00 ou 0 para grátis).");
      return;
    }

    const newOpt: OptionDraft = {
      id: `temp_opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      price: priceNum,
      is_active: newOptActive,
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
    setAddingOptionGroupId(null);
    setNewOptName("");
    setNewOptPrice("");
    setNewOptActive(true);
    toast.success(`Adicional "${trimmedName}" adicionado ao grupo!`);
  };

  const handleStartEditOption = (opt: OptionDraft) => {
    setEditingOptionId(opt.id);
    setEditOptName(opt.name);
    setEditOptPrice(opt.price === 0 ? "0,00" : opt.price.toFixed(2).replace(".", ","));
    setEditOptActive(opt.is_active);
  };

  const handleSaveEditOption = (groupId: string, optionId: string) => {
    const trimmedName = editOptName.trim();
    if (!trimmedName) {
      toast.error("O nome do adicional não pode ser vazio.");
      return;
    }

    const cleanedPriceStr = editOptPrice.replace(/[^0-9.,]/g, "").replace(",", ".");
    const priceNum = cleanedPriceStr === "" ? 0 : parseFloat(cleanedPriceStr);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Informe um preço válido.");
      return;
    }

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.map((o) =>
            o.id === optionId
              ? {
                  ...o,
                  name: trimmedName,
                  price: priceNum,
                  is_active: editOptActive,
                }
              : o
          ),
        };
      }
      return g;
    });

    onChange(updated);
    setEditingOptionId(null);
    toast.success("Adicional atualizado!");
  };

  const handleDeleteOption = (groupId: string, option: OptionDraft) => {
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
    if (editingOptionId === option.id) setEditingOptionId(null);
    toast.success(`Adicional "${option.name}" removido.`);
  };

  const handleToggleOptionStatus = (groupId: string, optionId: string) => {
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border/60">
        <div>
          <h4 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Grupos de Adicionais / Complementos
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie grupos para seus adicionais (ex: "Turbine seu Lanche", "Escolha seu Molho", "Bebidas Extras").
          </p>
        </div>

        {!isCreatingGroup && (
          <button
            type="button"
            onClick={handleOpenCreateGroup}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-md shrink-0"
          >
            <Plus className="h-4 w-4" />
            Adicionar Grupo
          </button>
        )}
      </div>

      {/* Formulário de Novo Grupo */}
      {isCreatingGroup && (
        <div className="rounded-3xl border-2 border-primary/40 bg-card p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                +
              </div>
              <h5 className="text-sm font-black text-foreground uppercase tracking-wide">
                Novo Grupo de Adicionais
              </h5>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatingGroup(false)}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-foreground block mb-1">
                Nome do Grupo *
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Turbine seu Lanche"
                className="w-full h-11 px-4 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Escolha Mínima
                </label>
                <input
                  type="number"
                  min="0"
                  value={newGroupMin}
                  onChange={(e) => setNewGroupMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-11 px-4 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  0 = opcional / cliente não é obrigado a escolher
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Escolha Máxima
                </label>
                <input
                  type="number"
                  min="1"
                  value={newGroupMax}
                  onChange={(e) => setNewGroupMax(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-11 px-4 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  1 = seleção única (Radio) / 2 ou mais = múltipla escolha
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="text-xs font-bold text-foreground">Obrigatório:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewGroupRequired(false)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold border transition-all",
                    !newGroupRequired
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => setNewGroupRequired(true)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold border transition-all",
                    newGroupRequired
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  Sim
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => setIsCreatingGroup(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveNewGroup}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-sm"
            >
              Criar Grupo
            </button>
          </div>
        </div>
      )}

      {/* Lista de Grupos Existentes */}
      {groups.length === 0 && !isCreatingGroup ? (
        <div className="p-8 rounded-3xl border-2 border-dashed border-border text-center bg-muted/20 space-y-3">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div>
            <p className="text-sm font-bold text-foreground">
              Nenhum grupo de adicionais configurado
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique no botão acima para adicionar seu primeiro grupo (ex: "Turbine seu Lanche").
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateGroup}
            className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar Grupo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const isEditingThisGroup = editingGroupId === group.id;
            const isAddingOptionThisGroup = addingOptionGroupId === group.id;

            return (
              <div
                key={group.id}
                className="rounded-3xl border border-border bg-card shadow-lg p-6 space-y-5 transition-all relative overflow-hidden"
              >
                {/* Linha de Destaque Superior do Card */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 to-primary/30" />

                {/* Edição do Grupo ou Cabeçalho do Grupo */}
                {isEditingThisGroup ? (
                  <div className="bg-muted/40 p-4 rounded-2xl border border-border/80 space-y-4">
                    <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                      Editar Regras do Grupo
                    </h5>

                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">
                        Nome do Grupo *
                      </label>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-foreground block mb-1">
                          Escolha Mínima
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editGroupMin}
                          onChange={(e) => setEditGroupMin(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-foreground block mb-1">
                          Escolha Máxima
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editGroupMax}
                          onChange={(e) => setEditGroupMax(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs font-bold text-foreground">Obrigatório:</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditGroupRequired(false)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold border transition-all",
                            !editGroupRequired
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          Não
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditGroupRequired(true)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold border transition-all",
                            editGroupRequired
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          Sim
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditGroup(group.id)}
                        className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Título do Grupo */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-base font-black text-foreground tracking-tight">
                          {group.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1 font-medium">
                          <span>Escolha mínima: <strong className="text-foreground">{group.min_options}</strong></span>
                          <span>•</span>
                          <span>Escolha máxima: <strong className="text-foreground">{group.max_options}</strong></span>
                          <span>•</span>
                          <span>
                            Obrigatório:{" "}
                            <strong className={group.required ? "text-rose-600 font-bold" : "text-foreground"}>
                              {group.required ? "Sim" : "Não"}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditGroup(group)}
                          className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                          title="Editar regras do grupo"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Editar grupo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group)}
                          className="px-3 py-1.5 rounded-xl border border-border hover:bg-destructive/10 text-xs font-bold text-destructive transition-all flex items-center gap-1.5"
                          title="Excluir grupo"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir grupo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Divisor de Seção de Adicionais */}
                <div className="border-t border-border/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                      ADICIONAIS ({group.options.length})
                    </span>
                  </div>

                  {/* Lista de Adicionais Cadastrados */}
                  {group.options.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/60">
                      Nenhum adicional cadastrado.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 border border-border/40 rounded-2xl overflow-hidden bg-background/50">
                      {group.options.map((opt) => {
                        const isEditingThisOption = editingOptionId === opt.id;

                        if (isEditingThisOption) {
                          return (
                            <div
                              key={opt.id}
                              className="p-4 bg-muted/40 space-y-3 animate-in fade-in duration-200"
                            >
                              <div className="text-xs font-bold text-foreground">
                                Editar Adicional
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                                    Nome *
                                  </label>
                                  <input
                                    type="text"
                                    value={editOptName}
                                    onChange={(e) => setEditOptName(e.target.value)}
                                    placeholder="Ex: Bacon"
                                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                                    Preço * (ex: 6,00 ou 0)
                                  </label>
                                  <input
                                    type="text"
                                    value={editOptPrice}
                                    onChange={(e) => setEditOptPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                                    placeholder="0,00"
                                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editOptActive}
                                    onChange={(e) => setEditOptActive(e.target.checked)}
                                    className="h-4 w-4 rounded border-border text-primary accent-primary"
                                  />
                                  <span className="text-xs font-semibold text-foreground">
                                    Disponível para venda (Ativo)
                                  </span>
                                </label>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingOptionId(null)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditOption(group.id, opt.id)}
                                    className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                                  >
                                    Salvar Alterações
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              "flex items-center justify-between px-4 py-3 text-sm transition-colors",
                              !opt.is_active && "bg-muted/30 opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={cn("font-bold text-foreground truncate", !opt.is_active && "line-through text-muted-foreground")}>
                                {opt.name}
                              </span>
                              {!opt.is_active && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md">
                                  Pausado
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              <span className="font-extrabold text-foreground text-xs sm:text-sm">
                                {opt.price === 0
                                  ? "Grátis"
                                  : `R$ ${opt.price.toFixed(2).replace(".", ",")}`}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOptionStatus(group.id, opt.id)}
                                  className={cn(
                                    "p-1.5 rounded-lg border border-border/40 transition-colors",
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
                                  onClick={() => handleStartEditOption(opt)}
                                  className="p-1.5 rounded-lg border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Editar adicional"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOption(group.id, opt)}
                                  className="p-1.5 rounded-lg border border-border/40 hover:bg-destructive/10 text-destructive transition-colors"
                                  title="Excluir adicional"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Formulário Inline de Adicionar Adicional */}
                  {isAddingOptionThisGroup ? (
                    <div className="p-4 rounded-2xl bg-secondary/30 border-2 border-primary/30 space-y-3 animate-in fade-in duration-200">
                      <div className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-primary" /> Novo Adicional para "{group.name}"
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Nome do Adicional *
                          </label>
                          <input
                            type="text"
                            value={newOptName}
                            onChange={(e) => setNewOptName(e.target.value)}
                            placeholder="Ex: Bacon, Cheddar, Ovo..."
                            className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Preço Adicional * (R$)
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={newOptPrice}
                              onChange={(e) => setNewOptPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                              placeholder="Ex: 6,00 (ou 0 para grátis)"
                              className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newOptActive}
                            onChange={(e) => setNewOptActive(e.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary accent-primary"
                          />
                          <span className="text-xs font-semibold text-foreground">
                            Disponível para venda imediatamente
                          </span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAddingOptionGroupId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveNewOption(group.id)}
                            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 shadow-sm"
                          >
                            Salvar Adicional
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAddOption(group.id)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Plus className="h-4 w-4" /> Adicionar Adicional
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
