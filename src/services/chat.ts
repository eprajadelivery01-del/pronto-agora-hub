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
      // Adiciona um zero-width space invisível no final da mensagem para identificar que foi enviada pelo admin
      // Isso permite que o usuário teste com a MESMA CONTA no marketplace e no admin panel sem quebrar os lados dos balões.
      return sendMessage(conversationId, user.id, content + '\u200B');
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
    },
  });
}
