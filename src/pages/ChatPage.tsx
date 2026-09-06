import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BikeIcon } from "@/components/icons/BikeIcon";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { 
  MessageSquare, User, Loader2, Send, HelpCircle, CheckCheck, Search, Trash2, Eraser,
  Bot, Sparkles, CheckCircle2, RotateCcw, Clock, ShieldCheck, ChevronLeft, Store, Save,
  Zap, MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  useMessages, useSendMessage, useDeleteConversation, getAdminId, getDirectConversation,
  DEFAULT_AUTO_MESSAGE, getStoreAutoMessageConfig, saveStoreAutoMessageConfig
} from "@/services/chat";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/services/companies";

export default function ChatPage() {
  const { user, hasRole } = useAuth();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [isClearingEmpty, setIsClearingEmpty] = useState(false);
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get("order_id");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const isLojista = hasRole('company');
  const Layout = isLojista ? BusinessLayout : AdminLayout;
  const qc = useQueryClient();

  const { data: companyData } = useCompany(user?.id, user?.email);
  const [autoMessageEnabled, setAutoMessageEnabled] = useState(true);
  const [autoMessageText, setAutoMessageText] = useState(DEFAULT_AUTO_MESSAGE);
  const [isSavingAutoMessage, setIsSavingAutoMessage] = useState(false);
  const [isLoadingAutoMessage, setIsLoadingAutoMessage] = useState(true);
  const [autoMessageSaveSuccess, setAutoMessageSaveSuccess] = useState(false);

  useEffect(() => {
    if (companyData?.id) {
      setIsLoadingAutoMessage(true);
      getStoreAutoMessageConfig(companyData.id)
        .then((cfg) => {
          setAutoMessageEnabled(cfg.auto_message_enabled);
          setAutoMessageText(cfg.auto_message || DEFAULT_AUTO_MESSAGE);
        })
        .catch((err) => {
          console.error("Erro ao carregar configuração de mensagem automática:", err);
        })
        .finally(() => {
          setIsLoadingAutoMessage(false);
        });
    }
  }, [companyData?.id]);

  const handleSaveAutoMessage = async () => {
    if (!companyData?.id) {
      toast.error("Loja não encontrada. Verifique suas credenciais.");
      return;
    }
    setIsSavingAutoMessage(true);
    try {
      await saveStoreAutoMessageConfig(companyData.id, {
        auto_message_enabled: autoMessageEnabled,
        auto_message: autoMessageText.trim() || DEFAULT_AUTO_MESSAGE,
      });
      setAutoMessageSaveSuccess(true);
      setTimeout(() => setAutoMessageSaveSuccess(false), 3000);
      qc.invalidateQueries({ queryKey: ["company", user?.id, user?.email] });
      toast.success("Configurações de mensagem automática salvas com sucesso!", {
        description: autoMessageEnabled 
          ? "Esta mensagem será enviada no chat sempre que você aceitar um pedido." 
          : "O disparo automático foi desativado.",
      });
    } catch (err: any) {
      console.error("Erro ao salvar mensagem automática:", err);
      toast.error("Erro ao salvar: " + (err?.message || "Tente novamente"));
    } finally {
      setIsSavingAutoMessage(false);
    }
  };

  const [readTimestamps, setReadTimestamps] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTimestamps = () => {
      setReadTimestamps(JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}'));
    };
    updateTimestamps();
    window.addEventListener('chat_read_update', updateTimestamps);
    return () => window.removeEventListener('chat_read_update', updateTimestamps);
  }, []);

  // Fetch Admin ID
  const { data: adminId } = useQuery({
    queryKey: ["admin-id", user?.id],
    queryFn: () => getAdminId(user?.id),
    enabled: isLojista && !!user?.id
  });

  const handleStartAdminChat = async () => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (!adminId) {
      toast.error("Nenhum administrador encontrado no sistema no momento.");
      return;
    }
    try {
      const conv = await getDirectConversation(user.id, adminId);
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      setSelectedConv(conv);
    } catch (err) {
      console.error("Erro ao iniciar chat com admin:", err);
      toast.error("Erro ao iniciar a conversa");
    }
  };
  
  const { data: conversations, isLoading: loadingConvs, isError } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at, sender_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Global Realtime listener for incoming messages
  useEffect(() => {
    if (!user?.id) return;
    const channelId = `admin-chat-global-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["conversations", user.id] });
          if (selectedConv?.id) {
            qc.invalidateQueries({ queryKey: ["messages", selectedConv.id] });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations" },
        () => {
          qc.invalidateQueries({ queryKey: ["conversations", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedConv?.id, qc]);

  useEffect(() => {
    const handleUrlParams = async () => {
      if (conversations && orderIdParam && !selectedConv) {
        let convForOrder = conversations.find((c: any) => c.order_id === orderIdParam);
        
        if (!convForOrder && searchParams.get("customer_id") && user) {
          const customerId = searchParams.get("customer_id");
          const { data: created } = await supabase
            .from("conversations")
            .insert({ 
              order_id: orderIdParam, 
              participants: [user.id, customerId],
              topic: "Suporte do Pedido" 
            })
            .select("*, messages(content, created_at, sender_id)")
            .single();
          
          if (created) {
            convForOrder = created;
            qc.invalidateQueries({ queryKey: ["conversations", user.id] });
          }
        }

        if (convForOrder) {
          setSelectedConv(convForOrder);
        }
      }
    };
    handleUrlParams();
  }, [conversations, orderIdParam, selectedConv, searchParams, user, qc]);

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
        .select("id, user_id, name, logo_url")
        .or(`user_id.in.(${participantIds.join(',')}),id.in.(${participantIds.join(',')})`);

      const { data: drivers } = await supabase
        .from("delivery_drivers")
        .select("user_id")
        .in("user_id", participantIds);

      const { data: customers } = await supabase
        .from("customers")
        .select("id, user_id, name, phone")
        .or(`user_id.in.(${participantIds.join(',')}),id.in.(${participantIds.join(',')})`);

      const map: Record<string, any> = {};
      data?.forEach(p => {
        map[p.user_id] = { ...p };
      });
      customers?.forEach(cust => {
        const idMap = (idToMap: string) => {
          if (!map[idToMap]) map[idToMap] = { user_id: idToMap };
          if (!map[idToMap].full_name || map[idToMap].full_name === 'Usuário' || map[idToMap].full_name.startsWith('Usuário #')) {
            map[idToMap].full_name = cust.name;
          }
          map[idToMap].role = map[idToMap].role || 'customer';
        };
        if (cust.user_id) idMap(cust.user_id);
        if (cust.id) idMap(cust.id);
      });
      companies?.forEach(c => {
        const idMap = (idToMap: string) => {
          if (!map[idToMap]) map[idToMap] = { user_id: idToMap };
          map[idToMap].full_name = c.name;
          map[idToMap].avatar_url = c.logo_url;
          map[idToMap].role = 'company';
        };
        if (c.user_id) idMap(c.user_id);
        if (c.id) idMap(c.id);
      });
      drivers?.forEach(d => {
        if (d.user_id && d.user_id !== adminId) {
          const profile = data?.find(p => p.user_id === d.user_id);
          if (!map[d.user_id]) map[d.user_id] = { user_id: d.user_id };
          map[d.user_id].full_name = profile?.full_name || map[d.user_id].full_name || "Entregador";
          map[d.user_id].avatar_url = profile?.avatar_url || map[d.user_id].avatar_url || null;
          map[d.user_id].role = 'driver';
        }
      });

      if (adminId) {
        if (!map[adminId]) map[adminId] = { user_id: adminId };
        map[adminId].role = 'admin';
        map[adminId].full_name = map[adminId].full_name || 'Suporte É Pra Já';
      }

      return map;
    },
  });

  const { data: messages, isLoading: loadingMessages } = useMessages(selectedConv?.id);
  const sendMessageMutation = useSendMessage();
  const deleteConversationMutation = useDeleteConversation();

  useEffect(() => {
    if (selectedConv) {
      const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
      readTimestamps[selectedConv.id] = new Date().toISOString();
      localStorage.setItem('chat_read_timestamps', JSON.stringify(readTimestamps));
      window.dispatchEvent(new Event('chat_read_update'));
    }
  }, [selectedConv, messages]);

  // Auto-scroll down when messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !selectedConv) return;
    const contentToSend = message.trim();
    setMessage("");
    
    sendMessageMutation.mutate({
      conversationId: selectedConv.id,
      content: contentToSend
    }, {
      onError: (err) => {
        console.error("Failed to send message:", err);
        toast.error("Erro ao enviar mensagem");
      }
    });
  };

  const handleDeleteConversation = async (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Tem certeza que deseja apagar esta conversa e todo o seu histórico?")) return;

    try {
      await deleteConversationMutation.mutateAsync(convId);
      toast.success("Conversa apagada com sucesso!");
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
      }
    } catch (err: any) {
      console.error("Erro ao apagar conversa:", err);
      toast.error("Erro ao apagar conversa: " + (err.message || "Tente novamente"));
    }
  };

  const handleClearEmptyConversations = async () => {
    const emptyConvs = (conversations || []).filter((c: any) => !c.messages || c.messages.length === 0);
    if (emptyConvs.length === 0) {
      toast.info("Não há conversas vazias para limpar.");
      return;
    }

    if (!window.confirm(`Deseja apagar todas as ${emptyConvs.length} conversas vazias (sem mensagens)?`)) return;

    setIsClearingEmpty(true);
    try {
      const ids = emptyConvs.map((c: any) => c.id);
      await supabase.from("conversations").delete().in("id", ids);
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      toast.success(`${emptyConvs.length} conversas vazias apagadas!`);
      if (selectedConv && ids.includes(selectedConv.id)) {
        setSelectedConv(null);
      }
    } catch (err: any) {
      console.error("Erro ao limpar conversas vazias:", err);
      toast.error("Erro ao limpar conversas vazias");
    } finally {
      setIsClearingEmpty(false);
    }
  };

  const getOtherParticipantId = (conv: any) => {
    return conv.participants?.find((id: string) => id !== user?.id) || conv.participants?.[0];
  };

  const getConvTitle = (conv: any) => {
    if (conv.order_id) return `Pedido #${conv.order_id.slice(-6).toUpperCase()}`;
    
    let extractedTopic = null;
    if (conv.messages && conv.messages.length > 0) {
      const firstMsg = [...conv.messages].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      if (firstMsg?.content?.startsWith('[Assunto:')) {
        extractedTopic = firstMsg.content.replace('[Assunto:', '').replace(']', '').trim();
      }
    }

    const otherId = getOtherParticipantId(conv);
    const otherProfile = profilesMap?.[otherId];
    
    if (otherProfile?.full_name) {
      return extractedTopic ? `${otherProfile.full_name} (${extractedTopic})` : otherProfile.full_name;
    }

    if (otherId) {
      return extractedTopic || `Usuário #${otherId.slice(0, 6).toUpperCase()}`;
    }

    return extractedTopic || (conv.title !== 'Conversa' ? conv.title : null) || conv.topic || "Conversa";
  };

  const renderConvIcon = (conv: any) => {
    if (conv.topic === 'driver_application') return <BikeIcon className="h-5 w-5" />;
    return conv.order_id ? <MessageSquare className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />;
  };

  // Sort conversations by latest message time, active conversations at the top
  const sortedConversations = useMemo(() => {
    if (!conversations) return [];
    
    const list = [...conversations].sort((a, b) => {
      const lastMsgA = a.messages && a.messages.length > 0 
        ? Math.max(...a.messages.map((m: any) => new Date(m.created_at).getTime()))
        : new Date(a.created_at).getTime();

      const lastMsgB = b.messages && b.messages.length > 0 
        ? Math.max(...b.messages.map((m: any) => new Date(m.created_at).getTime()))
        : new Date(b.created_at).getTime();

      return lastMsgB - lastMsgA;
    });

    if (!searchFilter.trim()) return list;

    const term = searchFilter.toLowerCase();
    return list.filter((conv) => {
      const title = getConvTitle(conv).toLowerCase();
      const lastMsg = conv.messages?.[0]?.content?.toLowerCase() || "";
      const orderId = conv.order_id?.toLowerCase() || "";
      return title.includes(term) || lastMsg.includes(term) || orderId.includes(term);
    });
  }, [conversations, profilesMap, searchFilter]);

  return (
    <Layout title="Chat" subtitle="Central de atendimento e mensagens automáticas">
      <div className="flex h-full w-full min-w-0 min-h-0 min-h-[500px] bg-card rounded-2xl shadow-card border border-border overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/30 min-w-0 overflow-hidden">
          <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between gap-2">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-widest opacity-60">Conversas ({sortedConversations.length})</h3>
            <div className="flex items-center gap-1.5">
              {!isLojista && (
                <button
                  onClick={handleClearEmptyConversations}
                  disabled={isClearingEmpty}
                  title="Limpar todas as conversas vazias"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[0.65rem] font-bold uppercase tracking-wider hover:bg-destructive/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isClearingEmpty ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eraser className="h-3 w-3" />}
                  <span>Limpar Vazias</span>
                </button>
              )}
              {isLojista && (
                <>
                  <button 
                    onClick={() => setSelectedConv(null)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[0.65rem] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer",
                      !selectedConv
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                    title="Configurar mensagem automática enviada ao aceitar pedido"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Msg Auto</span>
                  </button>
                  <button 
                    onClick={handleStartAdminChat}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[0.65rem] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Admin
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-border/50 bg-background/50">
            <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-xl border border-border/60">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Buscar conversa ou nome..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full font-medium"
              />
            </div>
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
            ) : sortedConversations.length === 0 ? (
              <div className="p-8 text-center opacity-40">
                <p className="text-xs font-bold uppercase">Nenhuma conversa</p>
              </div>
            ) : (
              sortedConversations.map((conv) => {
                const sortedMessages = conv.messages ? [...conv.messages].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
                const lastMsg = sortedMessages[0];
                const otherId = getOtherParticipantId(conv);
                const otherProfile = otherId ? profilesMap?.[otherId] : null;
                
                const convReadAt = readTimestamps[conv.id];
                const unreadCount = sortedMessages.filter((m: any) => {
                  const isMe = (m.sender_id === user?.id && m.content?.endsWith('\u200B')) || m.sender_id === user?.id;
                  if (isMe) return false;
                  if (!convReadAt) return true;
                  return new Date(m.created_at) > new Date(convReadAt);
                }).length;
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={cn(
                      "w-full p-4 text-left transition-all border-b border-border/40 relative group cursor-pointer flex items-center justify-between",
                      selectedConv?.id === conv.id ? "bg-card shadow-sm z-10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        conv.topic === 'driver_application' ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary"
                      )}>
                        {renderConvIcon(conv)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate">
                          {otherProfile?.full_name || getConvTitle(conv)} {otherProfile?.role === 'driver' && <span className="text-xs font-normal text-muted-foreground ml-1">(Entregador)</span>}
                          {conv.order_id && <span className="text-[10px] font-black text-primary uppercase ml-1">(Pedido #{conv.order_id.slice(0, 4)})</span>}
                          </span>
                          {lastMsg && (
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(lastMsg.created_at), "HH:mm")}
                              </span>
                              {unreadCount > 0 && selectedConv?.id !== conv.id && (
                                <span className="inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-muted-foreground truncate mt-0.5">
                          {otherProfile?.role === 'company' ? "Lojista" : otherProfile?.role === 'driver' ? "Entregador" : "Cliente"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 truncate italic mt-1">
                          {lastMsg?.content?.replace(/\u200B/g, '') || "Inicie a conversa..."}
                        </p>
                      </div>
                    </div>

                    {/* Botão de Excluir Conversa Individual na Lista */}
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      title="Apagar conversa"
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {selectedConv?.id === conv.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                  </div>
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
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                      {profilesMap?.[getOtherParticipantId(selectedConv)]?.role === 'company' ? "Lojista Parceiro" : profilesMap?.[getOtherParticipantId(selectedConv)]?.role === 'driver' ? "Entregador Parceiro" : "Cliente"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isLojista && (
                    <button
                      onClick={() => setSelectedConv(null)}
                      title="Configurar Mensagem Automática"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all cursor-pointer mr-1"
                    >
                      <Bot className="h-4 w-4" />
                      <span className="hidden md:inline">Mensagem Auto</span>
                    </button>
                  )}
                  {/* Botão de Apagar Conversa Aberta */}
                  <button
                    onClick={() => handleDeleteConversation(selectedConv.id)}
                    title="Apagar esta conversa e mensagens"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Apagar Chat</span>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-muted/20 relative z-0">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full relative z-10">
                    <div className="bg-card border border-border px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-[13px] text-muted-foreground font-medium">Carregando mensagens...</span>
                    </div>
                  </div>
                ) : messages && messages.length > 0 ? (
                  messages.map((msg) => {
                    const isTestAccountHack = msg.content.endsWith('\u200B');
                    const isMe = (msg.sender_id === user?.id) || isTestAccountHack;
                    const displayContent = msg.content.replace(/\u200B/g, '');

                    return (
                      <div key={msg.id} className={cn("flex flex-col w-full relative z-10", isMe ? "items-end" : "items-start")}>
                        <div 
                          className={cn(
                            "relative max-w-[75%] px-3.5 py-2.5 rounded-2xl shadow-sm",
                            isMe 
                              ? "bg-[#2b5278] rounded-br-[4px] text-[#ffffff]" 
                              : "bg-[#182533] rounded-bl-[4px] text-[#ffffff]"
                          )}
                        >
                          <div className="flex flex-col">
                            <p className="text-[15px] leading-[20px] whitespace-pre-wrap pr-10">
                              {displayContent}
                            </p>
                            <div className="flex items-center justify-end gap-1 absolute bottom-1 right-2">
                              <span className={cn("text-[11px]", isMe ? "text-[#7aa4c7]" : "text-[#547c9e]")}>
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
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                    <MessageSquare className="h-10 w-10 text-primary mb-2" />
                    <p className="text-sm font-semibold">Nenhuma mensagem nesta conversa ainda.</p>
                    <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem abaixo para falar com o contato.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 bg-card border-t border-border z-10">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                  <div className="flex-1 bg-muted/50 border border-border rounded-full flex items-center px-4 h-12 shadow-sm">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Digite uma mensagem..."
                      className="flex-1 bg-transparent border-none focus:outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className="w-12 h-12 rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
                    ) : (
                      <Send className="h-5 w-5 text-primary-foreground ml-1" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : isLojista ? (
            /* Região de Mensagem Automática do Lojista */
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-muted/10">
              <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
                {/* Cabeçalho da Seção */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-foreground tracking-tight">Mensagem Automática de Aceite</h2>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                          autoMessageEnabled ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-muted text-muted-foreground border border-border"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", autoMessageEnabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                          {autoMessageEnabled ? "Disparo Ativo" : "Disparo Pausado"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Esta mensagem é disparada automaticamente no chat com o cliente assim que você clica em <strong>"Aceitar Pedido"</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveAutoMessage}
                    disabled={isSavingAutoMessage || isLoadingAutoMessage}
                    className="self-start sm:self-center px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAutoMessage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : autoMessageSaveSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        <span>Salvo!</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Salvar Mensagem</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Grid: Configuração à Esquerda e Simulador do Cliente à Direita */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Painel de Edição (7 colunas) */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Toggle de ativação */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-foreground block">Ativar Envio Automático</span>
                        <p className="text-xs text-muted-foreground">
                          Ao clicar em "Aceitar Pedido" no painel, a conversa será iniciada e esta mensagem será entregue no celular do cliente.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoMessageEnabled(!autoMessageEnabled)}
                        className={cn(
                          "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-sm",
                          autoMessageEnabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                        )}
                        title={autoMessageEnabled ? "Clique para desativar" : "Clique para ativar"}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                            autoMessageEnabled ? "translate-x-7" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>

                    {/* Campo de Texto */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Texto da Mensagem de Boas-vindas
                        </label>
                        <button
                          type="button"
                          onClick={() => setAutoMessageText(DEFAULT_AUTO_MESSAGE)}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          title="Restaurar o modelo padrão de boas-vindas"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restaurar Padrão</span>
                        </button>
                      </div>

                      <textarea
                        value={autoMessageText}
                        onChange={(e) => setAutoMessageText(e.target.value)}
                        rows={8}
                        placeholder="Escreva a mensagem automática que seu cliente vai receber..."
                        className="w-full p-4 rounded-2xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all font-medium leading-relaxed"
                      />

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>💡 O cliente receberá no chat exatamente com essa formatação.</span>
                        <span className="font-bold">{autoMessageText.length} caracteres</span>
                      </div>
                    </div>

                    {/* Dica operacional */}
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <strong>Transparência e Confiança:</strong> O envio imediato tranquiliza o cliente, confirmando que seu estabelecimento já está preparando a comida e reduzindo cancelamentos ou dúvidas no chat.
                      </p>
                    </div>
                  </div>

                  {/* Simulador Visual do Celular do Cliente (5 colunas) */}
                  <div className="lg:col-span-5 flex flex-col items-center">
                    <div className="w-full text-center mb-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        📱 Como o cliente vê no celular
                      </span>
                    </div>

                    {/* Moldura do Celular */}
                    <div className="w-full max-w-[340px] rounded-[2.5rem] border-4 border-muted-foreground/20 bg-background shadow-2xl overflow-hidden flex flex-col min-h-[540px]">
                      {/* Top Bar Simulada */}
                      <div className="px-5 pt-3 pb-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground select-none border-b border-border/20">
                        <span>19:51</span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span>4G</span>
                          <span>📶</span>
                          <span>🔋81%</span>
                        </div>
                      </div>

                      {/* Header da Loja (igual print) */}
                      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 bg-card/60">
                        <ChevronLeft className="h-5 w-5 text-rose-500 shrink-0" />
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                          {companyData?.logo_url ? (
                            <img src={companyData.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Store className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-foreground truncate leading-tight">
                            {companyData?.name || "Sua Loja Delivery"}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground">Loja</p>
                        </div>
                      </div>

                      {/* Conteúdo do Chat no Celular */}
                      <div className="flex-1 p-4 bg-muted/20 space-y-4 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                        <div className="space-y-3">
                          {/* Resposta rápida (igual print) */}
                          <div className="text-center space-y-2 pt-2">
                            <div className="text-2xl">⭐</div>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              Geralmente, essa loja responde rápido
                            </p>
                            <div className="flex items-center justify-center gap-2 flex-wrap text-[9px] font-bold">
                              <span className="bg-card border border-border/60 px-2.5 py-1 rounded-full text-muted-foreground flex items-center gap-1 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                responde em média de 2 min
                              </span>
                              <span className="bg-card border border-border/60 px-2.5 py-1 rounded-full text-muted-foreground flex items-center gap-1 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                responde 98% das vezes
                              </span>
                            </div>
                          </div>

                          {/* Data */}
                          <div className="text-center my-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full">
                              HOJE
                            </span>
                          </div>

                          {/* Caixa de Aviso de Segurança (idêntico ao print) */}
                          <div className="bg-card border border-border/70 rounded-2xl p-3 text-center space-y-1 shadow-xs">
                            <p className="text-[11px] font-black text-foreground">Mensagem automática</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              Não aceite cobrança na entrega se o pedido foi pago pelo app e nunca compartilhe dados pessoais em conversas de chat ou telefone.
                            </p>
                          </div>

                          {/* Balão da Mensagem Automática digitada */}
                          <div className="flex items-start gap-2 pt-1">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0 mt-1">
                              {companyData?.logo_url ? (
                                <img src={companyData.logo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Store className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 bg-card border border-border/80 rounded-2xl rounded-tl-xs p-3 shadow-sm text-foreground max-w-[85%] relative">
                              <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-medium">
                                {autoMessageText || "Olá! Seu pedido já chegou até a gente..."}
                              </p>
                              <span className="text-[9px] text-muted-foreground/70 block text-right mt-1">
                                {format(new Date(), "HH:mm")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Barra inferior simulada de digitação */}
                        <div className="pt-2">
                          <div className="bg-card border border-border rounded-full px-3 py-2 flex items-center justify-between text-muted-foreground text-xs shadow-xs">
                            <span className="text-[11px]">Mensagem...</span>
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <Send className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-muted/20">
              <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-6 animate-bounce duration-[3s]">
                <MessageSquare className="h-10 w-10 text-primary" />
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
