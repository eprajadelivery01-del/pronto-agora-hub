import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useGlobalChatNotifications() {
  const { user, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Use a short random string to avoid channel name collisions across tabs/reloads
    const sessionId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`global-chat-notifications-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Ignore messages sent by the current user
          if (newMessage.sender_id === user.id) return;

          // Only notify if we are NOT currently on the chat page, 
          // OR if we are on the chat page but it's a message for a different conversation?
          // Actually, if we are on the chat page, let's still notify so they know another chat got a message, 
          // unless they are actively in THAT conversation. But we don't have the active conversation state here.
          // For simplicity, we just notify if they are not on the chat page.
          const isChatPage = location.pathname.includes("/chat");
          
          try {
             const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
             audio.volume = 0.5;
             audio.play().catch(e => console.warn("[Audio] Bloqueio de auto-play pelo navegador:", e)); 
          } catch (err) {
             console.error("[Audio] Erro ao reproduzir som:", err);
          }

          const isLojista = hasRole("company");
          toast.info("Nova mensagem recebida!", {
            description: newMessage.content,
            duration: 8000,
            action: isChatPage ? undefined : {
              label: "Abrir Chat",
              onClick: () => navigate(isLojista ? "/business/chat" : "/admin/chat")
            }
          });

          // Invalidate messages and conversations to keep sidebar fresh
          qc.invalidateQueries({ queryKey: ["conversations"] });
          qc.invalidateQueries({ queryKey: ["admin-conversations"] });
          qc.invalidateQueries({ queryKey: ["messages", newMessage.conversation_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname, navigate, hasRole, qc]);
}

export function GlobalChatListener() {
  useGlobalChatNotifications();
  return null;
}
