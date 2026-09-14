import React, { useState, useRef } from "react";
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
  ClipboardList,
  CornerDownLeft,
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

export interface BulkOptionRow {
  id: string;
  name: string;
  price: string;
  is_active: boolean;
}

export function formatBRL(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Carrega grupos e opções oficiais de um produto existente no Supabase.
 * Fonte oficial: product_option_group_assignments.
 * Fallback: product_option_groups.product_id (legado).
 * Deduplica rigorosamente por group.id para nunca exibir duplicados.
 */
export async function loadProductOptionGroups(productId: string): Promise<OptionGroupDraft[]> {
  try {
    // 1. Buscar via assignments oficial (N:N)
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("product_option_group_assignments")
      .select(`
        group_id,
        product_option_groups:group_id (
          id,
          name,
          min_options,
          max_options,
          required,
          company_id,
          product_options (id, name, price, is_active)
        )
      `)
      .eq("product_id", productId);

    if (assignmentsError) {
      console.warn("Aviso ao carregar assignments:", assignmentsError.message);
    }

    // 2. Buscar legado via product_id direto
    const { data: legacyData, error: legacyError } = await supabase
      .from("product_option_groups")
      .select("*, product_options(*)")
      .eq("product_id", productId)
      .order("created_at");

    if (legacyError) {
      console.warn("Aviso ao carregar grupos legados:", legacyError.message);
    }

    // 3. Combinar e deduplicar rigorosamente por group.id
    const combinedMap = new Map<string, OptionGroupDraft>();

    if (assignmentsData && Array.isArray(assignmentsData)) {
      for (const row of assignmentsData) {
        const g: any = row.product_option_groups;
        if (g && g.id && !combinedMap.has(g.id)) {
          const req = Boolean(g.required);
          const min = req ? Math.max(1, g.min_options ?? 1) : 0;
          const max = Math.max(min, Math.max(1, g.max_options ?? 1));

          combinedMap.set(g.id, {
            id: g.id,
            name: g.name,
            min_options: min,
            max_options: max,
            required: req,
            options: (g.product_options || []).map((o: any) => ({
              id: o.id,
              name: o.name,
              price: Number(o.price || 0),
              is_active: o.is_active ?? true,
            })),
          });
        }
      }
    }

    if (legacyData && Array.isArray(legacyData)) {
      for (const g of legacyData) {
        if (g && g.id && !combinedMap.has(g.id)) {
          const req = Boolean(g.required);
          const min = req ? Math.max(1, g.min_options ?? 1) : 0;
          const max = Math.max(min, Math.max(1, g.max_options ?? 1));

          combinedMap.set(g.id, {
            id: g.id,
            name: g.name,
            min_options: min,
            max_options: max,
            required: req,
            options: (g.product_options || []).map((o: any) => ({
              id: o.id,
              name: o.name,
              price: Number(o.price || 0),
              is_active: o.is_active ?? true,
            })),
          });
        }
      }
    }

    return Array.from(combinedMap.values());
  } catch (err) {
    console.error("Exceção ao carregar grupos do produto:", err);
    return [];
  }
}

/**
 * Sincroniza grupos e opções apenas para produtos NOVOS que acabaram de ser criados.
 * NUNCA executa deleção em massa de product_option_groups para produtos existentes.
 */
export async function saveProductOptionGroups(
  productId: string,
  hasOptions: boolean,
  groups: OptionGroupDraft[],
  isNewProduct: boolean = false,
  companyId?: string
) {
  // Se for edição de produto existente, NÃO fazemos sync em lote destrutivo.
  // As alterações já foram persistidas em tempo real de forma granular e atômica.
  if (!isNewProduct) {
    return;
  }

  if (!hasOptions || !groups || groups.length === 0) {
    return;
  }

  // Insere grupos e opções para o produto recém-criado
  for (const group of groups) {
    let targetGroupId = group.id;

    if (group.isNew || group.id.startsWith("temp_")) {
      const insertPayload: any = {
        name: group.name,
        min_options: group.required ? Math.max(1, group.min_options ?? 1) : 0,
        max_options: Math.max(1, group.max_options ?? 1),
        required: Boolean(group.required),
        product_id: null,
      };
      if (companyId) {
        insertPayload.company_id = companyId;
      }

      const { data: insertedGroup, error: groupError } = await supabase
        .from("product_option_groups")
        .insert(insertPayload)
        .select()
        .single();

      if (groupError || !insertedGroup) {
        console.error("Erro ao inserir grupo do novo produto:", groupError);
        continue;
      }

      targetGroupId = insertedGroup.id;

      if (group.options && group.options.length > 0) {
        const optionsToInsert = group.options.map((opt) => ({
          group_id: targetGroupId,
          name: opt.name,
          price: opt.price,
          is_active: opt.is_active,
        }));
        await supabase.from("product_options").insert(optionsToInsert);
      }
    }

    // Criar a associação oficial N:N
    if (productId && targetGroupId && !targetGroupId.startsWith("temp_")) {
      await supabase
        .from("product_option_group_assignments")
        .insert({
          product_id: productId,
          group_id: targetGroupId,
        });
    }
  }
}

interface ProductOptionGroupsManagerProps {
  productId?: string;
  companyId?: string;
  hasOptions: boolean;
  onToggleHasOptions: (active: boolean) => void;
  groups: OptionGroupDraft[];
  onChange: (groups: OptionGroupDraft[]) => void;
  loadingOptions?: boolean;
}

export function ProductOptionGroupsManager({
  productId,
  companyId,
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

  // Modal de Adicionar Grupo Existente da Loja
  const [addExistingModalOpen, setAddExistingModalOpen] = useState(false);
  const [storeGroups, setStoreGroups] = useState<OptionGroupDraft[]>([]);
  const [loadingStoreGroups, setLoadingStoreGroups] = useState(false);
  const [storeGroupSearch, setStoreGroupSearch] = useState("");

  // Modal de Cadastro em Massa de Opções
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkOptionRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState("");

  // Modal de Edição Individual de Opção
  const [editOptionModalOpen, setEditOptionModalOpen] = useState(false);
  const [editOptionGroupId, setEditOptionGroupId] = useState<string | null>(null);
  const [editOptionId, setEditOptionId] = useState<string | null>(null);
  const [editOptionName, setEditOptionName] = useState("");
  const [editOptionPrice, setEditOptionPrice] = useState("");
  const [editOptionActive, setEditOptionActive] = useState(true);

  // Confirmações de Exclusão / Desvinculação
  const [unlinkGroupTarget, setUnlinkGroupTarget] = useState<OptionGroupDraft | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<OptionGroupDraft | null>(null);
  const [deleteOptionTarget, setDeleteOptionTarget] = useState<{ groupId: string; option: OptionDraft } | null>(null);

  const [isSavingGroup, setIsSavingGroup] = useState(false);

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
    setGroupFormRequired(Boolean(group.required));
    setGroupFormMin(group.required ? (group.min_options ?? 1) : 0);
    setGroupFormMax(group.max_options ?? 20);
    setGroupModalOpen(true);
  };

  const handleSaveGroupModal = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = groupFormName.trim();
    if (!trimmed) {
      toast.error("Informe o nome do grupo.");
      return;
    }

    // REGRA #8: Semântica estrita de obrigatoriedade
    // required = false -> min_options = 0
    // required = true -> min_options >= 1
    const req = Boolean(groupFormRequired);
    const min = req ? Math.max(1, Number(groupFormMin) || 1) : 0;
    const max = Math.max(min, Math.max(1, Number(groupFormMax) || 1));

    if (groupModalMode === "create") {
      if (productId) {
        setIsSavingGroup(true);
        try {
          const insertPayload: any = {
            name: trimmed,
            min_options: min,
            max_options: max,
            required: req,
            product_id: null,
          };
          if (companyId) {
            insertPayload.company_id = companyId;
          }

          const { data: insertedGroup, error: groupInsertError } = await supabase
            .from("product_option_groups")
            .insert(insertPayload)
            .select()
            .single();

          if (groupInsertError || !insertedGroup || !insertedGroup.id) {
            console.error("Erro ao criar grupo no Supabase:", groupInsertError);
            toast.error(`Erro ao criar grupo: ${groupInsertError?.message || "falha ao salvar no banco"}`);
            setIsSavingGroup(false);
            return;
          }

          // Criar o assignment oficial na tabela N:N
          const { error: assignError } = await supabase
            .from("product_option_group_assignments")
            .insert({
              product_id: productId,
              group_id: insertedGroup.id,
            });

          if (assignError) {
            console.warn("Aviso ao vincular assignment:", assignError.message);
          }

          const createdGroup: OptionGroupDraft = {
            id: insertedGroup.id,
            name: insertedGroup.name,
            min_options: min,
            max_options: max,
            required: req,
            options: [],
            isNew: false,
          };

          onToggleHasOptions(true);
          onChange([...groups, createdGroup]);
          setGroupModalOpen(false);
          toast.success(`Grupo "${trimmed}" criado com sucesso!`);
        } catch (err: any) {
          console.error("Exceção ao inserir grupo:", err);
          toast.error("Erro inesperado ao criar grupo.");
        } finally {
          setIsSavingGroup(false);
        }
      } else {
        const newGroup: OptionGroupDraft = {
          id: `temp_group_${Date.now()}`,
          name: trimmed,
          min_options: min,
          max_options: max,
          required: req,
          options: [],
          isNew: true,
        };
        onToggleHasOptions(true);
        onChange([...groups, newGroup]);
        setGroupModalOpen(false);
        toast.success(`Grupo "${trimmed}" criado!`);
      }
    } else if (targetGroupId) {
      const isRealGroup = !targetGroupId.startsWith("temp_");
      if (productId && isRealGroup) {
        setIsSavingGroup(true);
        try {
          const { error: groupUpdateError } = await supabase
            .from("product_option_groups")
            .update({
              name: trimmed,
              min_options: min,
              max_options: max,
              required: req,
            })
            .eq("id", targetGroupId);

          if (groupUpdateError) {
            console.error("Erro ao atualizar grupo no Supabase:", groupUpdateError);
            toast.error(`Erro ao atualizar grupo: ${groupUpdateError.message}`);
            setIsSavingGroup(false);
            return;
          }
        } catch (err: any) {
          console.error("Exceção ao atualizar grupo:", err);
          toast.error("Erro ao atualizar grupo.");
          setIsSavingGroup(false);
          return;
        } finally {
          setIsSavingGroup(false);
        }
      }

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
      setGroupModalOpen(false);
      toast.success("Grupo atualizado com sucesso!");
    }
  };

  // ----------------------------------------------------
  // ADICIONAR GRUPO EXISTENTE DA LOJA (N:N REUTILIZÁVEL)
  // ----------------------------------------------------
  const handleOpenAddExistingModal = async () => {
    setAddExistingModalOpen(true);
    setStoreGroupSearch("");
    if (!companyId) {
      setStoreGroups([]);
      return;
    }

    setLoadingStoreGroups(true);
    try {
      const { data, error } = await supabase
        .from("product_option_groups")
        .select(`
          id,
          name,
          min_options,
          max_options,
          required,
          company_id,
          product_options (id, name, price, is_active)
        `)
        .eq("company_id", companyId)
        .order("name");

      if (error) {
        console.error("Erro ao buscar grupos da loja:", error);
        toast.error("Não foi possível carregar os grupos da loja.");
        setStoreGroups([]);
      } else {
        const loaded: OptionGroupDraft[] = (data || []).map((g: any) => {
          const req = Boolean(g.required);
          const min = req ? Math.max(1, g.min_options ?? 1) : 0;
          const max = Math.max(min, Math.max(1, g.max_options ?? 1));
          return {
            id: g.id,
            name: g.name,
            min_options: min,
            max_options: max,
            required: req,
            options: (g.product_options || []).map((o: any) => ({
              id: o.id,
              name: o.name,
              price: Number(o.price || 0),
              is_active: o.is_active ?? true,
            })),
          };
        });
        setStoreGroups(loaded);
      }
    } catch (err: any) {
      console.error("Exceção ao carregar grupos da loja:", err);
    } finally {
      setLoadingStoreGroups(false);
    }
  };

  const handleAssignExistingGroup = async (groupToAssign: OptionGroupDraft) => {
    if (!groupToAssign) return;

    if (groups.some((g) => g.id === groupToAssign.id)) {
      toast.info(`O grupo "${groupToAssign.name}" já está adicionado a este produto.`);
      return;
    }

    if (productId && !groupToAssign.id.startsWith("temp_")) {
      try {
        const { error: assignErr } = await supabase
          .from("product_option_group_assignments")
          .insert({
            product_id: productId,
            group_id: groupToAssign.id,
          });

        if (assignErr) {
          console.error("Erro ao associar grupo:", assignErr);
          toast.error(`Erro ao associar grupo: ${assignErr.message}`);
          return;
        }
      } catch (err: any) {
        console.error("Exceção ao associar grupo:", err);
        toast.error("Erro inesperado ao associar grupo.");
        return;
      }
    }

    onToggleHasOptions(true);
    onChange([...groups, groupToAssign]);
    toast.success(`Grupo "${groupToAssign.name}" adicionado ao produto!`);
  };

  // ----------------------------------------------------
  // REMOVER DESTE PRODUTO (DELETE SOMENTE EM ASSIGNMENTS)
  // ----------------------------------------------------
  const handleConfirmUnlinkGroup = async () => {
    if (!unlinkGroupTarget) return;
    const target = unlinkGroupTarget;
    const isRealGroup = !target.id.startsWith("temp_");

    if (productId && isRealGroup) {
      try {
        const { error: unlinkError } = await supabase
          .from("product_option_group_assignments")
          .delete()
          .eq("product_id", productId)
          .eq("group_id", target.id);

        if (unlinkError) {
          console.error("Erro ao desvincular grupo:", unlinkError);
          toast.error(`Erro ao desvincular: ${unlinkError.message}`);
          return;
        }
      } catch (err: any) {
        console.error("Exceção ao desvincular:", err);
        toast.error("Erro inesperado ao desvincular grupo.");
        return;
      }
    }

    const updated = groups.filter((g) => g.id !== target.id);
    onChange(updated);
    if (updated.length === 0) {
      onToggleHasOptions(false);
    }
    setUnlinkGroupTarget(null);
    toast.success(`Grupo "${target.name}" removido deste produto. Ele continua disponível para outros produtos da loja.`);
  };

  // ----------------------------------------------------
  // EXCLUIR GRUPO DA LOJA (BLOQUEADO SE HOUVER ASSOCIAÇÕES)
  // ----------------------------------------------------
  const handleOpenDeleteStoreGroup = async (group: OptionGroupDraft) => {
    if (!group) return;
    const isRealGroup = !group.id.startsWith("temp_");

    if (isRealGroup) {
      try {
        const { count, error: countErr } = await supabase
          .from("product_option_group_assignments")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        if (countErr) {
          console.warn("Aviso ao checar vínculos do grupo:", countErr);
        }

        if (count && count > 0) {
          toast.error(
            `Não é possível excluir o grupo "${group.name}". Ele ainda está vinculado a ${count} produto(s). Remova-o dos produtos antes de excluir da loja.`
          );
          return;
        }
      } catch (err: any) {
        console.error("Erro ao checar vínculos:", err);
      }
    }

    setDeleteGroupTarget(group);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    const idToDelete = deleteGroupTarget.id;
    const name = deleteGroupTarget.name;

    if (!idToDelete.startsWith("temp_")) {
      try {
        // Validação estrita: se houver associações ativas, bloqueia
        const { count } = await supabase
          .from("product_option_group_assignments")
          .select("*", { count: "exact", head: true })
          .eq("group_id", idToDelete);

        if (count && count > 0) {
          toast.error(
            `Exclusão bloqueada: O grupo "${name}" está vinculado a ${count} produto(s). Remova o vínculo primeiro.`
          );
          setDeleteGroupTarget(null);
          return;
        }

        const { error: delError } = await supabase
          .from("product_option_groups")
          .delete()
          .eq("id", idToDelete);

        if (delError) {
          console.error("Erro ao remover grupo no Supabase:", delError);
          toast.error(`Erro ao remover grupo: ${delError.message}`);
          return;
        }
      } catch (err: any) {
        console.error("Exceção ao deletar grupo:", err);
        toast.error("Erro ao remover grupo.");
        return;
      }
    }

    const updated = groups.filter((g) => g.id !== idToDelete);
    onChange(updated);
    if (updated.length === 0) {
      onToggleHasOptions(false);
    }
    setDeleteGroupTarget(null);
    toast.success(`Grupo "${name}" excluído da loja com sucesso.`);
  };

  // ----------------------------------------------------
  // CADASTRO EM MASSA DE OPÇÕES (BULK)
  // ----------------------------------------------------
  const handleOpenBulkAdd = (groupId: string) => {
    setBulkTargetGroupId(groupId);
    const initialId = `row_${Date.now()}_0`;
    setBulkRows([
      {
        id: initialId,
        name: "",
        price: "",
        is_active: true,
      },
    ]);
    setBulkPasteOpen(false);
    setBulkPasteText("");
    setBulkModalOpen(true);
    setTimeout(() => {
      document.getElementById(`bulk-name-${initialId}`)?.focus();
    }, 100);
  };

  const handleAddBulkRow = () => {
    const newRowId = `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setBulkRows((prev) => [
      ...prev,
      {
        id: newRowId,
        name: "",
        price: "",
        is_active: true,
      },
    ]);
    setTimeout(() => {
      document.getElementById(`bulk-name-${newRowId}`)?.focus();
    }, 50);
  };

  const handleRemoveBulkRow = (rowId: string) => {
    setBulkRows((prev) => {
      const filtered = prev.filter((r) => r.id !== rowId);
      if (filtered.length === 0) {
        return [{ id: `row_${Date.now()}_0`, name: "", price: "", is_active: true }];
      }
      return filtered;
    });
  };

  const handleUpdateBulkRow = (
    rowId: string,
    field: "name" | "price" | "is_active",
    value: any
  ) => {
    setBulkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  };

  const handlePriceKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    rowId: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === bulkRows.length - 1) {
        // Cria nova linha no final e foca nela
        handleAddBulkRow();
      } else {
        // Foca no nome da próxima linha existente
        const nextRow = bulkRows[index + 1];
        if (nextRow) {
          document.getElementById(`bulk-name-${nextRow.id}`)?.focus();
        }
      }
    }
  };

  // Processa texto colado rápido (ex: Bacon;4 ou Bacon, 4 ou Bacon - 4,00)
  const handleApplyPaste = () => {
    if (!bulkPasteText.trim()) {
      setBulkPasteOpen(false);
      return;
    }

    const lines = bulkPasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedRows: BulkOptionRow[] = [];

    for (const line of lines) {
      let parts: string[] = [];
      if (line.includes(";")) {
        parts = line.split(";");
      } else if (line.includes("\t")) {
        parts = line.split("\t");
      } else if (line.includes(" - ")) {
        parts = line.split(" - ");
      } else if (line.includes(",")) {
        const lastComma = line.lastIndexOf(",");
        const before = line.substring(0, lastComma);
        const after = line.substring(lastComma + 1);
        if (/^\s*\d+(\.\d+)?\s*$/.test(after)) {
          parts = [before, after];
        } else {
          parts = line.split(",");
        }
      } else {
        parts = [line];
      }

      const name = parts[0]?.trim() || "";
      let priceStr = parts[1]?.trim() || "";
      priceStr = priceStr.replace(/[^0-9.,]/g, "");

      if (name) {
        parsedRows.push({
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          price: priceStr,
          is_active: true,
        });
      }
    }

    if (parsedRows.length > 0) {
      setBulkRows((prev) => {
        const isInitialEmpty = prev.length === 1 && !prev[0].name.trim();
        return isInitialEmpty ? parsedRows : [...prev, ...parsedRows];
      });
      toast.success(`${parsedRows.length} opções adicionadas a partir da colagem!`);
      setBulkPasteText("");
      setBulkPasteOpen(false);
    } else {
      toast.error("Não foi possível identificar nomes e preços no texto colado.");
    }
  };

  const handleSaveBulkOptions = async () => {
    if (!bulkTargetGroupId) return;
    const targetGroup = groups.find((g) => g.id === bulkTargetGroupId);
    if (!targetGroup) return;

    // Normalizador de string para checagem de duplicidade robusta (case-insensitive, sem acentos e sem espaços extras)
    const norm = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // 1. Filtra linhas não vazias (ignora linhas em branco no final ou no meio)
    const validCandidates = bulkRows.filter(
      (r) => r.name.trim() !== "" || r.price.trim() !== ""
    );

    if (validCandidates.length === 0) {
      toast.error("Preencha ao menos uma opção para salvar.");
      return;
    }

    // 2. Validação de cada linha preenchida
    for (const r of validCandidates) {
      const trimmedName = r.name.trim();
      if (!trimmedName) {
        toast.error("Informe o nome da opção.");
        return;
      }

      const cleanedPrice = r.price.replace(/[^0-9.,]/g, "").replace(",", ".");
      const priceNum = cleanedPrice === "" ? 0 : parseFloat(cleanedPrice);

      if (isNaN(priceNum) || priceNum < 0) {
        toast.error(`Informe um preço válido para "${trimmedName}".`);
        return;
      }
    }

    // 3. Validação de duplicidade contra opções já existentes no grupo
    const existingNormNames = targetGroup.options.map((o) => norm(o.name));
    for (const r of validCandidates) {
      const rNorm = norm(r.name);
      if (existingNormNames.includes(rNorm)) {
        toast.error(`Já existe uma opção chamada "${r.name.trim()}" neste grupo.`);
        return;
      }
    }

    // 4. Validação de duplicidade entre as próprias novas linhas adicionadas
    const seenBatch = new Set<string>();
    for (const r of validCandidates) {
      const rNorm = norm(r.name);
      if (seenBatch.has(rNorm)) {
        toast.error(`A opção "${r.name.trim()}" foi informada mais de uma vez na lista.`);
        return;
      }
      seenBatch.add(rNorm);
    }

    // 5. Persistência em lote
    setBulkSaving(true);

    try {
      const isGroupInDatabase =
        Boolean(productId) &&
        !targetGroup.isNew &&
        !targetGroup.id.startsWith("temp_");

      if (isGroupInDatabase) {
        // Insere direto no banco de dados
        const recordsToInsert = validCandidates.map((r) => {
          const cleaned = r.price.replace(/[^0-9.,]/g, "").replace(",", ".");
          const priceNum = cleaned === "" ? 0 : parseFloat(cleaned);
          return {
            group_id: targetGroup.id,
            name: r.name.trim(),
            price: priceNum,
            is_active: r.is_active,
          };
        });

        const { data: insertedData, error: insertError } = await supabase
          .from("product_options")
          .insert(recordsToInsert)
          .select();

        if (insertError) {
          console.error("Erro ao salvar opções em massa:", insertError);
          toast.error("Não foi possível salvar todas as opções.");
          setBulkSaving(false);
          return;
        }

        const newOptions: OptionDraft[] = (insertedData || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          price: Number(o.price || 0),
          is_active: o.is_active ?? true,
        }));

        const updated = groups.map((g) =>
          g.id === targetGroup.id ? { ...g, options: [...g.options, ...newOptions] } : g
        );
        onChange(updated);
      } else {
        // Adiciona ao estado local (para produtos novos ainda não criados no banco)
        const newOptions: OptionDraft[] = validCandidates.map((r) => {
          const cleaned = r.price.replace(/[^0-9.,]/g, "").replace(",", ".");
          const priceNum = cleaned === "" ? 0 : parseFloat(cleaned);
          return {
            id: `temp_opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: r.name.trim(),
            price: priceNum,
            is_active: r.is_active,
            isNew: true,
          };
        });

        const updated = groups.map((g) =>
          g.id === targetGroup.id ? { ...g, options: [...g.options, ...newOptions] } : g
        );
        onChange(updated);
      }

      setBulkSaving(false);
      setBulkModalOpen(false);
      toast.success(
        `${validCandidates.length} ${
          validCandidates.length === 1 ? "opção adicionada" : "opções adicionadas"
        } com sucesso.`
      );
    } catch (err) {
      console.error("Exceção ao salvar opções em massa:", err);
      toast.error("Erro inesperado ao salvar opções.");
      setBulkSaving(false);
    }
  };

  // ----------------------------------------------------
  // EDIÇÃO INDIVIDUAL DE OPÇÃO EXISTENTE
  // ----------------------------------------------------
  const handleOpenEditOption = (groupId: string, opt: OptionDraft) => {
    setEditOptionGroupId(groupId);
    setEditOptionId(opt.id);
    setEditOptionName(opt.name);
    setEditOptionPrice(opt.price === 0 ? "0,00" : opt.price.toFixed(2).replace(".", ","));
    setEditOptionActive(opt.is_active);
    setEditOptionModalOpen(true);
  };

  const handleSaveEditOption = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmedName = editOptionName.trim();
    if (!trimmedName) {
      toast.error("Informe o nome da opção.");
      return;
    }

    const cleanedPriceStr = editOptionPrice.replace(/[^0-9.,]/g, "").replace(",", ".");
    const priceNum = cleanedPriceStr === "" ? 0 : parseFloat(cleanedPriceStr);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Informe um preço adicional válido.");
      return;
    }

    if (!editOptionGroupId || !editOptionId) return;

    if (productId && !editOptionId.startsWith("temp_")) {
      try {
        const { error: optUpdateErr } = await supabase
          .from("product_options")
          .update({
            name: trimmedName,
            price: priceNum,
            is_active: editOptionActive,
          })
          .eq("id", editOptionId);

        if (optUpdateErr) {
          console.error("Erro ao atualizar opção no Supabase:", optUpdateErr);
          toast.error(`Erro ao atualizar opção: ${optUpdateErr.message}`);
          return;
        }
      } catch (err: any) {
        console.error("Exceção ao atualizar opção:", err);
        toast.error("Erro ao atualizar opção.");
        return;
      }
    }

    const updated = groups.map((g) => {
      if (g.id === editOptionGroupId) {
        return {
          ...g,
          options: g.options.map((o) =>
            o.id === editOptionId
              ? {
                  ...o,
                  name: trimmedName,
                  price: priceNum,
                  is_active: editOptionActive,
                }
              : o
          ),
        };
      }
      return g;
    });

    onChange(updated);
    setEditOptionModalOpen(false);
    toast.success("Opção atualizada com sucesso!");
  };

  const handleToggleOptionActive = async (groupId: string, optionId: string) => {
    let newStatus = false;
    const targetGroup = groups.find((g) => g.id === groupId);
    const targetOpt = targetGroup?.options.find((o) => o.id === optionId);
    if (!targetOpt) return;

    newStatus = !targetOpt.is_active;

    if (productId && !optionId.startsWith("temp_")) {
      try {
        const { error: toggleErr } = await supabase
          .from("product_options")
          .update({ is_active: newStatus })
          .eq("id", optionId);

        if (toggleErr) {
          console.error("Erro ao alterar status da opção:", toggleErr);
          toast.error("Erro ao atualizar status da opção.");
          return;
        }
      } catch (err: any) {
        console.error("Exceção ao alterar status da opção:", err);
      }
    }

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.map((o) =>
            o.id === optionId ? { ...o, is_active: newStatus } : o
          ),
        };
      }
      return g;
    });

    onChange(updated);
  };

  const handleConfirmDeleteOption = async () => {
    if (!deleteOptionTarget) return;
    const { groupId, option } = deleteOptionTarget;

    if (productId && !option.id.startsWith("temp_")) {
      try {
        const { error: delOptErr } = await supabase
          .from("product_options")
          .delete()
          .eq("id", option.id);

        if (delOptErr) {
          console.error("Erro ao deletar opção no Supabase:", delOptErr);
          toast.error(`Erro ao remover opção: ${delOptErr.message}`);
          return;
        }
      } catch (err: any) {
        console.error("Exceção ao remover opção:", err);
        toast.error("Erro ao remover opção.");
        return;
      }
    }

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

      {/* 2. Área de Grupos Reutilizáveis */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
              GRUPOS DE ADICIONAIS
            </h5>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Crie grupos reutilizáveis para sua loja ou adicione grupos já existentes a este produto.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {companyId && (
              <button
                type="button"
                onClick={handleOpenAddExistingModal}
                className="px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/10 active:scale-95 transition-all shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Adicionar grupo existente
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenCreateGroup}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Criar novo grupo
            </button>
          </div>
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
                Nenhum grupo de adicionais associado
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-0.5 font-medium">
                Crie um novo grupo para este produto ou reutilize um grupo já cadastrado na sua loja.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {companyId && (
                <button
                  type="button"
                  onClick={handleOpenAddExistingModal}
                  className="px-4 py-2 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold inline-flex items-center gap-1.5 hover:bg-primary/10 active:scale-95 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar grupo existente
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenCreateGroup}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Criar novo grupo
              </button>
            </div>
          </div>
        )}

        {/* 3. Cards de Grupos Associados */}
        <div className="space-y-5">
          {groups.map((group) => {
            const isSingleChoice = group.max_options === 1;
            const isRequired = Boolean(group.required);

            let ruleSummary = "";
            if (!isRequired) {
              ruleSummary = isSingleChoice
                ? "Até 1 opção"
                : `Até ${group.max_options ?? 1} opções`;
            } else {
              const minOpt = group.min_options ?? 1;
              const maxOpt = group.max_options ?? minOpt;
              if (minOpt === 1 && maxOpt === 1) {
                ruleSummary = "1 opção";
              } else if (minOpt === maxOpt) {
                ruleSummary = `${minOpt} opções`;
              } else {
                ruleSummary = `De ${minOpt} a ${maxOpt} opções`;
              }
            }

            return (
              <div
                key={group.id}
                className="rounded-3xl border border-border bg-card shadow-sm p-6 space-y-4 transition-all relative overflow-hidden"
              >
                {/* Cabeçalho do Card */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-black text-foreground tracking-tight">
                        {group.name}
                      </h4>
                      {isRequired ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-md border border-rose-500/20">
                          Obrigatório
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/60">
                          Opcional
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                      <span>{isRequired ? "Obrigatório" : "Opcional"}</span>
                      <span>•</span>
                      <span>{ruleSummary}</span>
                      <span>•</span>
                      <span>{group.options.length} {group.options.length === 1 ? "opção" : "opções"}</span>
                    </div>
                  </div>

                  {/* Ações do Card: [Editar] [Remover do produto] + Mais Opções */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditGroup(group)}
                      className="h-8 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground hover:bg-muted transition-all inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnlinkGroupTarget(group)}
                      className="h-8 px-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs"
                      title="Desvincula o grupo deste produto sem apagar da loja"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remover do produto
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                          aria-label="Mais ações do grupo"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => handleOpenEditGroup(group)}>
                          <Edit3 className="h-3.5 w-3.5 mr-2" /> Editar regras do grupo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setUnlinkGroupTarget(group)}
                          className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/20"
                        >
                          <X className="h-3.5 w-3.5 mr-2" /> Remover deste produto
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleOpenDeleteStoreGroup(group)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir grupo da loja
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
                        Adicione várias opções de uma vez para montar rapidamente a personalização deste produto.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenBulkAdd(group.id)}
                        className="mt-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar opções
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
                            <span
                              className={cn(
                                "text-xs shrink-0 select-none",
                                opt.is_active ? "text-muted-foreground" : "text-muted-foreground/40"
                              )}
                            >
                              ○
                            </span>

                            <span
                              className={cn(
                                "font-semibold text-sm truncate",
                                opt.is_active ? "text-foreground" : "text-muted-foreground line-through"
                              )}
                            >
                              {opt.name}
                            </span>

                            {!opt.is_active && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md shrink-0 border border-amber-500/20">
                                DESATIVADO
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={cn(
                                "font-bold text-sm tracking-tight",
                                opt.is_active ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
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

                  {/* Botão + Adicionar opções */}
                  {group.options.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenBulkAdd(group.id)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98"
                    >
                      <Plus className="h-4 w-4" /> Adicionar opções
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
          <div className="space-y-5">
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveGroupModal(e);
                    }
                  }}
                  placeholder="Ex: Turbine seu Lanche, Molhos, Bebidas..."
                  className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Escolha mínima
                  </label>
                  <input
                    type="number"
                    min={groupFormRequired ? 1 : 0}
                    disabled={!groupFormRequired}
                    value={groupFormRequired ? groupFormMin : 0}
                    onChange={(e) => {
                      if (groupFormRequired) {
                        setGroupFormMin(Math.max(1, parseInt(e.target.value) || 1));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveGroupModal(e);
                      }
                    }}
                    className={cn(
                      "w-full h-11 px-4 rounded-xl border text-sm font-bold transition-all focus:outline-none focus:border-primary",
                      groupFormRequired
                        ? "bg-muted/40 border-border text-foreground"
                        : "bg-muted/20 border-border/40 text-muted-foreground cursor-not-allowed"
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                    {groupFormRequired ? "Mínimo obrigatório (≥ 1)" : "0 (Grupo Opcional)"}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Escolha máxima
                  </label>
                  <input
                    type="number"
                    min={groupFormRequired ? Math.max(1, groupFormMin) : 1}
                    value={groupFormMax}
                    onChange={(e) => setGroupFormMax(Math.max(groupFormRequired ? Math.max(1, groupFormMin) : 1, parseInt(e.target.value) || 1))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveGroupModal(e);
                      }
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                    Máximo permitido no pedido
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/40">
                <div>
                  <label className="text-xs font-bold text-foreground block">
                    Obrigatório
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    O cliente é obrigado a selecionar ao menos uma opção?
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setGroupFormRequired(false);
                      setGroupFormMin(0);
                    }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      !groupFormRequired
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Não (Opcional)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupFormRequired(true);
                      setGroupFormMin((prev) => Math.max(1, prev || 1));
                    }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      groupFormRequired
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sim (Obrigatório)
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
                type="button"
                onClick={(e) => handleSaveGroupModal(e)}
                disabled={isSavingGroup}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-2"
              >
                {isSavingGroup && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isSavingGroup
                  ? "Salvando..."
                  : groupModalMode === "create"
                  ? "Criar grupo"
                  : "Salvar alterações"}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL: CADASTRO EM MASSA DE OPÇÕES (BULK ADD) */}
      {/* ==================================================== */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col rounded-3xl p-6 bg-background">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-black text-foreground">
                  Adicionar opções
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Cadastre várias opções de uma vez.
                </DialogDescription>
              </div>

              {/* Botão de Colagem Rápida */}
              <button
                type="button"
                onClick={() => setBulkPasteOpen(!bulkPasteOpen)}
                className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/30 flex items-center gap-1.5 transition-all shrink-0"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {bulkPasteOpen ? "Ocultar colagem" : "Colar lista rápida"}
              </button>
            </div>
          </DialogHeader>

          {/* Área de Colagem Rápida (Expansível) */}
          {bulkPasteOpen && (
            <div className="shrink-0 p-4 bg-muted/40 rounded-2xl border border-border space-y-2.5 my-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Colar lista rápida de opções
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Formato: Nome;Preço (Ex: Bacon;4 ou Cheddar;6,00)
                </span>
              </div>
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder={"Bacon; 4,00\nCheddar; 6,00\nFrango; 6,00\nCalabresa; 6,00\nSalsicha; 3,00"}
                rows={4}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-background border border-border focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkPasteOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-xs"
                >
                  Interpretar e preencher linhas
                </button>
              </div>
            </div>
          )}

          {/* Cabeçalho das Colunas (Apenas Desktop) */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/60 shrink-0">
            <div className="col-span-6">Nome da opção *</div>
            <div className="col-span-3">Preço adicional</div>
            <div className="col-span-2 text-center">Disponível</div>
            <div className="col-span-1 text-center">Ação</div>
          </div>

          {/* Lista de Linhas (com scroll) */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 py-3">
            {bulkRows.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "p-3 rounded-2xl border transition-all",
                  "sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center sm:p-2.5 sm:rounded-xl",
                  "bg-muted/15 border-border/70 hover:border-border"
                )}
              >
                {/* Coluna Nome */}
                <div className="sm:col-span-6 space-y-1 sm:space-y-0">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden block">
                    Nome da opção *
                  </label>
                  <input
                    id={`bulk-name-${row.id}`}
                    type="text"
                    value={row.name}
                    onChange={(e) => handleUpdateBulkRow(row.id, "name", e.target.value)}
                    placeholder="Ex: Bacon, Cheddar, Frango..."
                    disabled={bulkSaving}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Coluna Preço */}
                <div className="sm:col-span-3 space-y-1 sm:space-y-0 mt-2 sm:mt-0">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden block">
                    Preço adicional
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                      R$
                    </span>
                    <input
                      id={`bulk-price-${row.id}`}
                      type="text"
                      value={row.price}
                      onChange={(e) =>
                        handleUpdateBulkRow(
                          row.id,
                          "price",
                          e.target.value.replace(/[^0-9.,]/g, "")
                        )
                      }
                      onKeyDown={(e) => handlePriceKeyDown(e, index, row.id)}
                      placeholder="0,00"
                      disabled={bulkSaving}
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Coluna Disponibilidade */}
                <div className="sm:col-span-2 flex items-center justify-between sm:justify-center mt-2 sm:mt-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden">
                    Disponível
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateBulkRow(row.id, "is_active", !row.is_active)}
                    disabled={bulkSaving}
                    className={cn(
                      "h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border",
                      row.is_active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-muted text-muted-foreground border-border opacity-70"
                    )}
                    title={row.is_active ? "Disponível para os clientes" : "Desativado"}
                  >
                    {row.is_active ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[11px]">Sim</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px]">Não</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Coluna Remover */}
                <div className="sm:col-span-1 flex items-center justify-end sm:justify-center mt-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => handleRemoveBulkRow(row.id)}
                    disabled={bulkSaving}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remover linha"
                    aria-label="Remover linha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Botão + Adicionar outra opção */}
            <button
              type="button"
              onClick={handleAddBulkRow}
              disabled={bulkSaving}
              className="w-full py-2.5 rounded-xl border border-dashed border-primary/50 text-primary hover:bg-primary/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-2 active:scale-98"
            >
              <Plus className="h-4 w-4" />
              Adicionar outra opção
            </button>
          </div>

          {/* Dica de Atalho e Rodapé */}
          <div className="shrink-0 pt-3 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <CornerDownLeft className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                Pressione <strong>ENTER</strong> no preço para criar a próxima opção automaticamente.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                disabled={bulkSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveBulkOptions}
                disabled={bulkSaving}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-2"
              >
                {bulkSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando opções...
                  </>
                ) : (
                  "Salvar opções"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL: EDITAR OPÇÃO INDIVIDUAL */}
      {/* ==================================================== */}
      <Dialog open={editOptionModalOpen} onOpenChange={setEditOptionModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                Editar opção
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
                  value={editOptionName}
                  onChange={(e) => setEditOptionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveEditOption(e);
                    }
                  }}
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
                    value={editOptionPrice}
                    onChange={(e) => setEditOptionPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveEditOption(e);
                      }
                    }}
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
                    onClick={() => setEditOptionActive(true)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all",
                      editOptionActive
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Disponível
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditOptionActive(false)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      !editOptionActive
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
                onClick={() => setEditOptionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => handleSaveEditOption(e)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                Salvar alterações
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL: ADICIONAR GRUPO EXISTENTE DA LOJA (N:N) */}
      {/* ==================================================== */}
      <Dialog open={addExistingModalOpen} onOpenChange={setAddExistingModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-background">
          <div className="space-y-4">
            <DialogHeader>
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
                <Layers className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-black text-foreground">
                Adicionar grupo de adicionais
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Reutilize um grupo já cadastrado em outros produtos com todas as suas opções.
              </DialogDescription>
            </DialogHeader>

            {/* Input de busca */}
            <div>
              <input
                type="text"
                placeholder="Buscar grupo pelo nome..."
                value={storeGroupSearch}
                onChange={(e) => setStoreGroupSearch(e.target.value)}
                className="w-full h-10 px-4 rounded-xl bg-muted/40 border border-border text-xs font-medium text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Lista de Grupos */}
            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {loadingStoreGroups && (
                <div className="p-8 text-center text-xs text-muted-foreground font-bold flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Carregando grupos da loja...
                </div>
              )}

              {!loadingStoreGroups && storeGroups.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/80">
                  Nenhum outro grupo cadastrado nesta loja ainda.
                </div>
              )}

              {!loadingStoreGroups &&
                storeGroups
                  .filter((g) =>
                    !storeGroupSearch.trim() ||
                    g.name.toLowerCase().includes(storeGroupSearch.trim().toLowerCase())
                  )
                  .map((sg) => {
                    const isAlreadyAdded = groups.some((g) => g.id === sg.id);
                    const isReq = Boolean(sg.required);
                    const ruleDesc = isReq
                      ? (sg.min_options === sg.max_options ? `${sg.min_options} opções` : `De ${sg.min_options} a ${sg.max_options} opções`)
                      : `Até ${sg.max_options} opções`;

                    return (
                      <div
                        key={sg.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                          isAlreadyAdded
                            ? "border-border/50 bg-muted/20 opacity-70"
                            : "border-border bg-card hover:border-primary/40 shadow-xs"
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <h5 className="text-sm font-bold text-foreground tracking-tight">
                            {sg.name}
                          </h5>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                            <span>{sg.options.length} {sg.options.length === 1 ? "opção" : "opções"}</span>
                            <span>•</span>
                            <span className={isReq ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                              {isReq ? "Obrigatório" : "Opcional"}
                            </span>
                            <span>•</span>
                            <span>{ruleDesc}</span>
                          </div>
                        </div>

                        {isAlreadyAdded ? (
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl bg-muted border border-border/60">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Já adicionado
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAssignExistingGroup(sg)}
                            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" /> Adicionar
                          </button>
                        )}
                      </div>
                    );
                  })}
            </div>

            <DialogFooter className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setAddExistingModalOpen(false)}
                className="w-full px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Fechar
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIÁLOGO DE CONFIRMAÇÃO: REMOVER DESTE PRODUTO (UNLINK) */}
      {/* ==================================================== */}
      <Dialog open={!!unlinkGroupTarget} onOpenChange={(open) => !open && setUnlinkGroupTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <DialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2">
              <X className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Remover grupo deste produto?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              O grupo <strong>"{unlinkGroupTarget?.name}"</strong> será desvinculado apenas deste item. Ele continuará salvo na sua loja e nos outros produtos associados.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row justify-end gap-2 pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={() => setUnlinkGroupTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmUnlinkGroup}
              className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-700 shadow-sm"
            >
              Remover deste produto
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIÁLOGO DE CONFIRMAÇÃO: EXCLUIR GRUPO DA LOJA */}
      {/* ==================================================== */}
      <Dialog open={!!deleteGroupTarget} onOpenChange={(open) => !open && setDeleteGroupTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background">
          <DialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Excluir grupo da loja?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Esta ação apagará o grupo <strong>"{deleteGroupTarget?.name}"</strong> e todas as suas opções permanentemente da sua loja. Só é permitida se nenhum produto estiver utilizando este grupo.
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
              Excluir da loja
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
