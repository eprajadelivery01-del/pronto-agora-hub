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

export const DEFAULT_AUTO_MESSAGE = `Olá! Pedido confirmado com sucesso! 🚀✨
Nossa equipe já iniciou o preparo com todo capricho e atenção aos detalhes.

Qualquer dúvida ou observação sobre seu pedido, estamos à sua disposição aqui pelo chat. Bom apetite! 🍽️🛵`;

export async function getStoreAutoMessageConfig(companyId: string) {
  if (!companyId) return { auto_message_enabled: true, auto_message: DEFAULT_AUTO_MESSAGE };
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("opening_hours")
      .eq("id", companyId)
      .maybeSingle();

    if (error) throw error;
    const hours = typeof data?.opening_hours === "string" 
      ? JSON.parse(data.opening_hours) 
      : (data?.opening_hours || {});

    return {
      auto_message_enabled: hours.auto_message_enabled !== false,
      auto_message: typeof hours.auto_message === "string" ? hours.auto_message : DEFAULT_AUTO_MESSAGE,
    };
  } catch (e) {
    console.error("Erro ao buscar configuração de mensagem automática:", e);
    return { auto_message_enabled: true, auto_message: DEFAULT_AUTO_MESSAGE };
  }
}

export async function saveStoreAutoMessageConfig(
  companyId: string, 
  config: { auto_message_enabled: boolean; auto_message: string }
) {
  if (!companyId) throw new Error("ID da empresa não informado");
  
  const { data } = await supabase
    .from("companies")
    .select("opening_hours")
    .eq("id", companyId)
    .maybeSingle();

  const currentHours = typeof data?.opening_hours === "string"
    ? JSON.parse(data.opening_hours)
    : (data?.opening_hours || {});

  const updatedHours = {
    ...currentHours,
    auto_message_enabled: config.auto_message_enabled,
    auto_message: config.auto_message,
  };

  const { error } = await supabase
    .from("companies")
    .update({ opening_hours: updatedHours })
    .eq("id", companyId);

  if (error) throw error;
  return updatedHours;
}

export async function sendOrderAutoWelcomeMessage(
  orderId: string, 
  companyId?: string, 
  customerId?: string
) {
  try {
    if (!orderId) return;

    // 1. Obter dados da loja para verificar se a mensagem automática está ativa
    let company: any = null;
    if (companyId) {
      const { data } = await supabase
        .from("companies")
        .select("id, user_id, opening_hours")
        .eq("id", companyId)
        .maybeSingle();
      company = data;
    }

    let orderInfo: any = null;
    if (!company || !customerId) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, company_id, customer_id, user_id")
        .eq("id", orderId)
        .maybeSingle();
      orderInfo = orderData;

      if (!company && orderData?.company_id) {
        const { data } = await supabase
          .from("companies")
          .select("id, user_id, opening_hours")
          .eq("id", orderData.company_id)
          .maybeSingle();
        company = data;
      }
    }

    if (!company) return;

    const openingHours = typeof company.opening_hours === "string"
      ? JSON.parse(company.opening_hours)
      : (company.opening_hours || {});

    // Se a mensagem automática estiver desabilitada explicitamente pelo lojista, não envia
    if (openingHours.auto_message_enabled === false) {
      return;
    }

    const messageText = (openingHours.auto_message || DEFAULT_AUTO_MESSAGE).trim();
    if (!messageText) return;

    const senderUserId = company.user_id;
    if (!senderUserId) return;

    const targetCustomer = customerId || orderInfo?.user_id || orderInfo?.customer_id;

    // 2. Localizar ou criar a conversa do pedido
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id, participants")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!conversation) {
      const participants = Array.from(new Set([
        senderUserId,
        targetCustomer,
        orderInfo?.user_id,
        orderInfo?.customer_id
      ].filter(Boolean)));

      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          order_id: orderId,
          participants: participants.length > 0 ? participants : [senderUserId],
          topic: "Suporte do Pedido"
        })
        .select()
        .single();

      if (convErr) {
        console.error("[AutoMessage] Erro ao criar conversa para o pedido:", convErr);
        return;
      }
      conversation = newConv;
    }

    if (!conversation?.id) return;

    // 3. Trava de Idempotência: verificar se a mensagem já foi enviada nesta conversa
    const { data: existingMessages } = await supabase
      .from("messages")
      .select("id, content, sender_id")
      .eq("conversation_id", conversation.id);

    const cleanMsgText = messageText.replace(/\u200B/g, "").trim();
    const alreadySent = existingMessages?.some(m => {
      const c = (m.content || "").replace(/\u200B/g, "").trim();
      return m.sender_id === senderUserId && (
        c === cleanMsgText ||
        c.includes("Seu pedido já chegou até a gente")
      );
    });

    if (alreadySent) {
      console.log(`[AutoMessage] Mensagem automática já enviada para o pedido #${orderId.slice(0, 6)}`);
      return;
    }

    // 4. Inserir a mensagem automática no chat
    const { error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: senderUserId,
        content: messageText + "\u200B"
      });

    if (msgErr) {
      console.error("[AutoMessage] Erro ao inserir mensagem automática:", msgErr);
    } else {
      console.log(`[AutoMessage] Mensagem automática enviada com sucesso para o pedido #${orderId.slice(0, 6).toUpperCase()}`);
    }
  } catch (err) {
    console.error("[AutoMessage] Erro inesperado ao enviar mensagem de boas-vindas:", err);
  }
}

