import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { calculateUnreadCount } from "@/services/chat";

export function useUnreadChatCount(companyId?: string) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const calculateUnread = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      // Busca todas as conversas e suas mensagens
      const { data: rawConvs, error } = await supabase
        .from("conversations")
        .select("id, order_id, participants, created_at, messages(id, content, created_at, sender_id)")
        .order("created_at", { ascending: false });

      if (error || !rawConvs) return;

      // Agrupa por order_id para unificar conversas duplicadas do mesmo pedido
      const orderGroups: Record<string, any[]> = {};
      const directList: any[] = [];

      rawConvs.forEach((conv: any) => {
        if (conv.order_id) {
          if (!orderGroups[conv.order_id]) orderGroups[conv.order_id] = [];
          orderGroups[conv.order_id].push(conv);
        } else {
          directList.push(conv);
        }
      });

      const mergedOrders = Object.values(orderGroups).map((group) => {
        const primary = group[0];
        const allIds = group.map((c) => c.id);
        const allMessages = group
          .flatMap((c) => c.messages || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Deduplica mensagens por ID ou conteúdo
        const seen = new Set<string>();
        const deduplicated = allMessages.filter((m) => {
          const key = m.id || `${m.sender_id}_${m.content}_${m.created_at}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return {
          ...primary,
          all_ids: allIds,
          messages: deduplicated,
        };
      });

      const allUnified = [...mergedOrders, ...directList];
      const readTimestamps = JSON.parse(localStorage.getItem("chat_read_timestamps") || "{}");

      // Conta quantas conversas têm mensagens não lidas pendentes
      let unreadConversations = 0;
      for (const conv of allUnified) {
        const count = calculateUnreadCount(conv, user.id, companyId, readTimestamps);
        if (count > 0) {
          unreadConversations++;
        }
      }

      setUnreadCount(unreadConversations);
    } catch (err) {
      console.warn("[useUnreadChatCount] Erro ao calcular não lidos:", err);
    }
  }, [user?.id, companyId]);

  useEffect(() => {
    calculateUnread();

    const handleStorageOrUpdate = () => calculateUnread();
    window.addEventListener("storage", handleStorageOrUpdate);
    window.addEventListener("chat_read_update", handleStorageOrUpdate);

    // Escuta novas mensagens em tempo real
    const channel = supabase
      .channel(`unread-counter-${Math.random().toString(36).substring(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        calculateUnread();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        calculateUnread();
      })
      .subscribe();

    return () => {
      window.removeEventListener("storage", handleStorageOrUpdate);
      window.removeEventListener("chat_read_update", handleStorageOrUpdate);
      supabase.removeChannel(channel);
    };
  }, [calculateUnread]);

  return unreadCount;
}
