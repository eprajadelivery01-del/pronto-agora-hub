import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, User, Loader2, Send, Bike, HelpCircle, CheckCheck } from "lucide-react";
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
        .select("*, messages(content, created_at)")
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
        .select("user_id")
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
          const profile = data?.find(p => p.user_id === d.user_id);
          if (!map[d.user_id]) map[d.user_id] = { user_id: d.user_id };
          map[d.user_id].full_name = profile?.full_name || map[d.user_id].full_name || "Entregador";
          map[d.user_id].avatar_url = profile?.avatar_url || map[d.user_id].avatar_url || null;
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
    
    // Tenta extrair o Assunto da primeira mensagem caso seja um chat de suporte
    let extractedTopic = null;
    if (conv.messages && conv.messages.length > 0) {
      const firstMsg = [...conv.messages].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      if (firstMsg?.content?.startsWith('[Assunto:')) {
        extractedTopic = firstMsg.content.replace('[Assunto:', '').replace(']', '').trim();
      }
    }

    const otherId = getOtherParticipantId(conv);
    const otherProfile = profilesMap?.[otherId];
    
    return extractedTopic || otherProfile?.full_name || (conv.title !== 'Conversa' ? conv.title : null) || conv.topic || "Usuário Anônimo";
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
                // Pega as mensagens ordenadas corretamente
                const sortedMessages = conv.messages ? [...conv.messages].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
                const lastMsg = sortedMessages[0];
                
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
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#EFEAE2] dark:bg-[#0B141A] relative z-0">
                <div className="absolute inset-0 bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] opacity-[0.08] dark:opacity-[0.03] mix-blend-multiply dark:mix-blend-screen pointer-events-none z-0" />
                
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full relative z-10">
                    <div className="bg-white dark:bg-[#202C33] px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#008069] dark:text-[#00A884]" />
                      <span className="text-[13px] text-muted-foreground">Carregando mensagens...</span>
                    </div>
                  </div>
                ) : messages?.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex flex-col w-full relative z-10", isMe ? "items-end" : "items-start")}>
                      <div 
                        className={cn(
                          "relative max-w-[75%] px-2.5 py-1.5 rounded-[12px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
                          isMe 
                            ? "bg-[#D9FDD3] dark:bg-[#005C4B] rounded-tr-[4px] text-[#111B21] dark:text-[#E9EDEF]" 
                            : "bg-white dark:bg-[#202C33] rounded-tl-[4px] text-[#111B21] dark:text-[#E9EDEF]"
                        )}
                      >
                        <div className="flex flex-col">
                          <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap pl-1 pr-2 pt-1 pb-4">
                            {msg.content}
                          </p>
                          <div className="flex items-center justify-end gap-1 absolute bottom-1 right-2">
                            <span className={cn("text-[11px]", isMe ? "text-[#667781] dark:text-[#8696A0]" : "text-[#667781] dark:text-[#8696A0]")}>
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                            {isMe && (
                              <CheckCheck className="h-[14px] w-[14px] text-[#53BDEB]" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-3 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-border z-10">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                  <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-full flex items-center px-4 h-11 shadow-sm">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Digite sua resposta..."
                      className="flex-1 bg-transparent border-none focus:outline-none text-[15px] text-[#111B21] dark:text-[#E9EDEF] placeholder:text-[#8696A0]"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className="w-11 h-11 rounded-full bg-[#00A884] text-white disabled:opacity-50 hover:bg-[#008F6F] transition-all shadow-sm flex items-center justify-center shrink-0 active:scale-95"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <Send className="h-5 w-5 text-white ml-1" />
                    )}
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
