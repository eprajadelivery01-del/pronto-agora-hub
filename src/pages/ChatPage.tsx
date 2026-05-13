import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, User, Loader2, Send, Bike, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMessages, useSendMessage } from "@/services/chat";
import { useAuth } from "@/hooks/useAuth";

export default function ChatPage() {
  const { user, profile, hasRole } = useAuth();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [message, setMessage] = useState("");
  
  const isLojista = hasRole('company');
  const Layout = isLojista ? BusinessLayout : AdminLayout;
  
  const { data: conversations, isLoading: loadingConvs, isError } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Profiles map for conversation display
  const { data: profilesMap } = useQuery({
    queryKey: ["profiles-map", conversations?.length],
    enabled: !!conversations && conversations.length > 0,
    queryFn: async () => {
      if (!conversations) return {};
      const participantIds = Array.from(new Set(
        conversations.flatMap(c => c.participants || [])
      ));
      
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", participantIds);

      const { data: companies } = await supabase
        .from("companies")
        .select("user_id, name, logo_url")
        .in("user_id", participantIds);

      const { data: drivers } = await supabase
        .from("delivery_drivers")
        .select("user_id, full_name, avatar_url")
        .in("user_id", participantIds);

      const map: Record<string, any> = {};
      data?.forEach(p => {
        map[p.user_id] = { ...p };
      });
      companies?.forEach(c => {
        if (c.user_id) {
          if (!map[c.user_id]) map[c.user_id] = { user_id: c.user_id };
          map[c.user_id].full_name = c.name;
          map[c.user_id].avatar_url = c.logo_url;
          map[c.user_id].role = 'company';
        }
      });
      drivers?.forEach(d => {
        if (d.user_id) {
          if (!map[d.user_id]) map[d.user_id] = { user_id: d.user_id };
          map[d.user_id].full_name = d.full_name;
          map[d.user_id].avatar_url = d.avatar_url;
          map[d.user_id].role = 'driver';
        }
      });
      return map;
    },
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

  const getOtherParticipantId = (conv: any) => {
    return conv.participants?.find((id: string) => id !== user?.id);
  };

  const getConvTitle = (conv: any) => {
    if (conv.order_id) return `Pedido #${conv.order_id.slice(-6).toUpperCase()}`;
    const otherId = getOtherParticipantId(conv);
    const otherProfile = profilesMap?.[otherId];
    return otherProfile?.full_name || conv.title || conv.topic || "Suporte Geral";
  };

  const getConvIcon = (conv: any) => {
    if (conv.topic === 'driver_application') return Bike;
    return conv.order_id ? MessageSquare : HelpCircle;
  };

  return (
    <Layout title="Suporte / Chat" subtitle="Gerenciamento de conversas em tempo real">
      <div className="flex h-[calc(100vh-180px)] bg-card rounded-2xl shadow-card border border-border overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-muted/30">
          <div className="p-4 border-b border-border bg-card/50">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-widest opacity-60">Conversas Ativas</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingConvs ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="p-8 text-center opacity-40">
                <p className="text-xs font-bold uppercase text-destructive">Erro ao carregar</p>
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-8 text-center opacity-40">
                <p className="text-xs font-bold uppercase">Nenhuma conversa</p>
              </div>
            ) : (
              conversations?.map((conv) => {
                const Icon = getConvIcon(conv);
                const lastMsg = conv.messages ? conv.messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={cn(
                      "w-full p-4 text-left transition-all border-b border-border/40 relative group",
                      selectedConv?.id === conv.id ? "bg-white shadow-sm z-10" : "hover:bg-white/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        conv.topic === 'driver_application' ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-foreground truncate">{getConvTitle(conv)}</p>
                          {lastMsg && (
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(lastMsg.created_at), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-muted-foreground truncate mt-0.5">
                          {profilesMap?.[getOtherParticipantId(conv)]?.role === 'admin' ? "Suporte (Admin)" : "Usuário / Entregador"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 truncate italic mt-1">
                          {lastMsg?.content || "Iniciando conversa..."}
                        </p>
                      </div>
                    </div>
                    {selectedConv?.id === conv.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 flex flex-col bg-background relative">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                    {profilesMap?.[getOtherParticipantId(selectedConv)]?.avatar_url ? (
                      <img src={profilesMap[getOtherParticipantId(selectedConv)].avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <span className="font-black text-sm block">{getConvTitle(selectedConv)}</span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-95">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages?.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "items-start")}>
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm font-medium shadow-sm leading-relaxed",
                        isMe 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-card text-foreground border border-border/60 rounded-tl-none"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-[9px] font-black text-muted-foreground/60 mt-1 uppercase tracking-widest px-1">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card/80 backdrop-blur-md">
                <div className="flex gap-3 max-w-4xl mx-auto">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Digite sua resposta..."
                    className="flex-1 bg-muted/50 border-border/40 rounded-2xl px-5 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none border shadow-inner"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-all shadow-lg flex items-center justify-center active:scale-95"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 rounded-[2rem] bg-muted flex items-center justify-center mb-6 animate-bounce duration-[3s]">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-2">Central de Atendimento</h3>
              <p className="text-sm text-muted-foreground max-w-xs font-medium">Selecione uma conversa ao lado para começar a responder seus clientes e futuros entregadores.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
