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

      // Agrupa e unifica todas as conversas pelo mesmo participante/cliente (estilo WhatsApp)
      const participantGroups: Record<string, any[]> = {};

      rawConvs.forEach((conv: any) => {
        const otherId = conv.participants?.find((id: string) => id && id !== user?.id && id !== companyId)
          || conv.participants?.find((id: string) => id && id !== user?.id)
          || conv.participants?.[0]
          || conv.id;

        if (!participantGroups[otherId]) {
          participantGroups[otherId] = [];
        }
        participantGroups[otherId].push(conv);
      });

      const allUnified = Object.values(participantGroups).map((group) => {
        const sortedConvs = [...group].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const primary = sortedConvs[0];
        const allIds = Array.from(new Set(group.map((c) => c.id)));
        const allMessages = group
          .flatMap((c) => c.messages || [])
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const seen = new Set<string>();
        const deduplicated = allMessages.filter((m) => {
          if (!m) return false;
          if (m.id && seen.has(m.id)) return false;

          const clean = (m.content || "").replace(/\u200B/g, "").trim();
          const timeBucket = Math.floor(new Date(m.created_at).getTime() / (120 * 1000));
          const contentKey = `${m.sender_id}_${clean}_${timeBucket}`;
          if (seen.has(contentKey)) return false;

          if (m.id) seen.add(m.id);
          seen.add(contentKey);
          return true;
        });

        return {
          ...primary,
          all_ids: allIds,
          messages: deduplicated,
        };
      });
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
