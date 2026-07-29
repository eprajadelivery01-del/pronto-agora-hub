import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAudioAlert, sendNativeDeviceNotification } from "@/hooks/useAudioAlert";

export function useGlobalChatNotifications() {
  const { user, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { playAlert } = useAudioAlert();

  useEffect(() => {
    if (!user) return;

    const sessionId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`global-notifications-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.sender_id === user.id) return;

          // Check location inside callback to keep subscription stable
          const isChatPage = window.location.pathname.includes("/chat");
          
          try {
             playAlert();
          } catch (err) {
             console.error("[Audio] Erro ao reproduzir som:", err);
          }

          // Fetch sender name for better notification
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", newMessage.sender_id)
            .single();

          let senderName = profile?.full_name;
          
          if (!senderName) {
            const { data: company } = await supabase
              .from("companies")
              .select("name")
              .eq("user_id", newMessage.sender_id)
              .single();
            senderName = company?.name;
          }

          if (!senderName) {
            const { data: driver } = await supabase
              .from("delivery_drivers")
              .select("full_name")
              .eq("user_id", newMessage.sender_id)
              .single();
            senderName = driver?.full_name;
          }

          // Notificar na central de notificações nativa do celular/desktop
          sendNativeDeviceNotification(senderName || "Nova mensagem recebida!", {
            body: newMessage.content,
            tag: `chat-msg-${newMessage.conversation_id}`,
          });

          toast.info(senderName || "Nova mensagem recebida!", {
            description: newMessage.content,
            duration: 8000,
            action: isChatPage ? undefined : {
              label: "Abrir Chat",
              onClick: () => navigate(hasRole("company") ? "/business/chat" : "/admin/chat")
            }
          });

          qc.invalidateQueries({ queryKey: ["conversations"] });
          qc.invalidateQueries({ queryKey: ["admin-conversations"] });
          qc.invalidateQueries({ queryKey: ["messages", newMessage.conversation_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate, qc]); // Removed location.pathname to keep channel stable
}

export function GlobalChatListener() {
  useGlobalChatNotifications();
  return null;
}
