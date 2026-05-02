import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, User, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMessages, useSendMessage } from "@/services/chat";
import { useAuth } from "@/hooks/useAuth";

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [message, setMessage] = useState("");
  
  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: messages, isLoading: loadingMessages } = useMessages(selectedConv?.id);
  const sendMessageMutation = useSendMessage();

  const handleSend = async () => {
    if (!message.trim() || !selectedConv) return;
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConv.id,
        content: message.trim()
      });
      setMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AdminLayout title="Suporte / Chat" subtitle="Gerenciamento de conversas em tempo real">
      <div className="flex h-[calc(100vh-180px)] bg-card rounded-2xl shadow-card border border-border overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-muted/30">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Conversas</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={cn(
                  "w-full p-4 text-left hover:bg-muted transition-colors border-b border-border/50",
                  selectedConv?.id === conv.id && "bg-muted"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">Pedido #{conv.order_id?.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.messages?.[0]?.content || "Sem mensagens"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">Pedido #{selectedConv.order_id?.slice(0, 8)}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages?.map((msg) => (
                  <div key={msg.id} className={cn("flex flex-col max-w-[70%]", msg.sender_id === user?.id ? "ml-auto items-end" : "items-start")}>
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm",
                      msg.sender_id === user?.id 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted text-foreground rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-muted border-none rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p className="text-sm font-medium">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
