import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * FUNÇÕES
 */
export async function getConversation(orderId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDirectConversation(userId: string, targetUserId: string) {
  // First try to find existing direct conversation
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("*")
    .is("order_id", null)
    .contains("participants", [userId, targetUserId])
    .maybeSingle();

  if (existing) return existing;

  // If not found, create one
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      participants: [userId, targetUserId],
      order_id: null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAdminId(currentUserId?: string) {
  // 1. Tentar pegar a administradora absoluta via RPC (ignora RLS e busca pelo email)
  try {
    const { data: rpcAdminId, error: rpcErr } = await supabase.rpc('get_davinyn_admin_id');
    if (!rpcErr && rpcAdminId) {
      return rpcAdminId;
    }
  } catch (e) {
    console.error("RPC get_davinyn_admin_id não encontrado ainda.");
  }

  // 2. Fallback: Busca na tabela user_roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
    
  if (roles && roles.length > 0) {
    const adminIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", adminIds);
      
    if (profiles && profiles.length > 0) {
      const davinyn = profiles.find(p => p.full_name && p.full_name.toLowerCase().includes('davinyn'));
      if (davinyn) return davinyn.user_id;
      
      const filtered = profiles.filter(p => p.user_id !== currentUserId);
      if (filtered.length > 0) return filtered[0].user_id;
      return profiles[0].user_id;
    }
    
    const filteredIds = adminIds.filter(id => id !== currentUserId);
    if (filteredIds.length > 0) return filteredIds[0];
    return adminIds[0];
  }

  // Fallback 1: Buscar em profiles
  const { data: profileData } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("role", "admin");
    
  if (profileData && profileData.length > 0) {
    const davinyn = profileData.find(p => p.full_name && p.full_name.toLowerCase().includes('davinyn'));
    if (davinyn) return davinyn.user_id;
    return profileData[0].user_id;
  }

  // Fallback 2: Buscar e-mail específico (davinyn)
  const { data: specificAdmin } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("full_name", "%davinyn%")
    .limit(1)
    .maybeSingle();
    
  if (specificAdmin?.user_id) return specificAdmin.user_id;

  return null;
}

export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * HOOKS
 */
export function useChat(orderId: string) {
  return useQuery({
    queryKey: ["conversation", orderId],
    queryFn: () => getConversation(orderId),
    enabled: !!orderId,
  });
}

export function useMessages(conversationId?: string) {
  const qc = useQueryClient();

  // Escuta Realtime para novas mensagens
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => (conversationId ? getMessages(conversationId) : null),
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      return sendMessage(conversationId, user.id, content + '\u200B');
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });
}

export async function deleteConversation(conversationId: string) {
  // 1. Deletar mensagens da conversa
  await supabase.from("messages").delete().eq("conversation_id", conversationId);
  // 2. Deletar a conversa
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw error;
  return true;
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });
}

