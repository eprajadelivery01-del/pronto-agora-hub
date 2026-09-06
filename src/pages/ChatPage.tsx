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
  Zap, MessageCircle, Smartphone, Smile, Heart
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

  const handleInsertEmoji = (emoji: string) => {
    setAutoMessageText((prev) => prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + emoji);
  };

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
  }, [conversations, profilesMap]);



  return (
    <Layout title="Chat" subtitle="Central de atendimento e mensagens automáticas">
      <div className="flex h-full w-full min-w-0 min-h-0 min-h-[550px] bg-card rounded-2xl shadow-card border border-border overflow-hidden">
        {/* Sidebar de Conversas e Navegação */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/20 min-w-0 overflow-hidden">
          {/* Topo da Sidebar: Título e Ação Secundária */}
          <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-xs uppercase tracking-wider">Conversas</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {sortedConversations.length}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {!isLojista && (
                <button
                  onClick={handleClearEmptyConversations}
                  disabled={isClearingEmpty}
                  title="Limpar todas as conversas vazias"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[0.65rem] font-bold uppercase tracking-wider hover:bg-destructive/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isClearingEmpty ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eraser className="h-3 w-3" />}
                  <span>Limpar</span>
                </button>
              )}
              {isLojista && (
                <button 
                  onClick={handleStartAdminChat}
                  title="Falar com o Suporte Geral do Aplicativo"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[0.65rem] font-bold uppercase tracking-wider transition-colors border border-border cursor-pointer shadow-2xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* Atalho Destacado: Mensagem Automática (Para Lojista) */}
          {isLojista && (
            <div className="p-3 border-b border-border/70 bg-background/60">
              <button 
                onClick={() => setSelectedConv(null)}
                className={cn(
                  "w-full p-3 rounded-xl transition-all flex items-center gap-3 text-left border cursor-pointer relative group",
                  !selectedConv
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card hover:bg-muted/50 border-border/80 text-foreground"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                  !selectedConv ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                )}>
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs truncate">Mensagem Automática</span>
                    <span className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      autoMessageEnabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"
                    )} />
                  </div>
                  <p className={cn(
                    "text-[10px] truncate mt-0.5",
                    !selectedConv ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {autoMessageEnabled ? "Ativa ao aceitar pedidos" : "Envio desativado"}
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Campo de Busca */}
          <div className="p-3 border-b border-border/50 bg-background/40">
            <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-xl border border-border/60 focus-within:border-primary/50 transition-colors">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Buscar conversa ou pedido..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full font-medium"
              />
            </div>
          </div>

          {/* Lista de Conversas */}
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
                      "w-full p-3.5 text-left transition-all border-b border-border/40 relative group cursor-pointer flex items-center justify-between",
                      selectedConv?.id === conv.id ? "bg-card shadow-sm z-10" : "hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs",
                        conv.topic === 'driver_application' ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary"
                      )}>
                        {renderConvIcon(conv)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs truncate">
                            {otherProfile?.full_name || getConvTitle(conv)} {otherProfile?.role === 'driver' && <span className="text-[10px] font-normal text-muted-foreground ml-1">(Entregador)</span>}
                            {conv.order_id && <span className="text-[10px] font-black text-primary uppercase ml-1">(#{conv.order_id.slice(0, 4)})</span>}
                          </span>
                          {lastMsg && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 ml-1">
                              {format(new Date(lastMsg.created_at), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className="text-[10px] text-muted-foreground truncate italic">
                            {lastMsg?.content?.replace(/\u200B/g, '') || "Inicie a conversa..."}
                          </p>
                          {unreadCount > 0 && selectedConv?.id !== conv.id && (
                            <span className="inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      title="Apagar conversa"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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

        {/* Área Central / Janela Principal */}
        <div className="flex-1 flex flex-col bg-background relative min-w-0">
          {selectedConv ? (
            <>
              {/* Header da Conversa Ativa */}
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all cursor-pointer mr-1"
                    >
                      <Bot className="h-4 w-4" />
                      <span className="hidden sm:inline">Msg Automática</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteConversation(selectedConv.id)}
                    title="Apagar esta conversa"
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages && messages.length > 0 ? (
                  messages.map((msg: any) => {
                    const isMe = (msg.sender_id === user?.id && msg.content?.endsWith('\u200B')) || msg.sender_id === user?.id;
                    const cleanContent = msg.content ? msg.content.replace(/\u200B/g, '') : '';
                    
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[80%] md:max-w-[70%]",
                          isMe ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl p-4 shadow-2xs whitespace-pre-wrap break-words leading-relaxed text-sm",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-xs"
                              : "bg-muted/80 text-foreground rounded-bl-xs border border-border/40"
                          )}
                        >
                          {cleanContent}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isMe && <CheckCheck className="h-3.5 w-3.5 text-primary/70" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-10 w-10 stroke-1 mb-2 opacity-30" />
                    <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-muted-foreground/60">Envie a primeira mensagem para iniciar a conversa.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra de Envio */}
              <div className="p-3 border-t border-border bg-card/50 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Digite sua resposta..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 bg-muted/60 text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 text-sm outline-none border border-border/60 focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0 cursor-pointer shadow-xs"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : isLojista ? (
            /* ========================================================================= */
            /* Região de Mensagem Automática de Aceite - Design Ultra Premium & Moderno   */
            /* ========================================================================= */
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gradient-to-b from-background via-background to-muted/20">
              <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
                
                {/* Header Banner com Glassmorphism e Efeito de Iluminação */}
                <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-28 -mt-28" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 text-white shrink-0">
                        <Bot className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                            Mensagem Automática de Aceite
                          </h2>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors border",
                            autoMessageEnabled 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                              : "bg-muted text-muted-foreground border-border"
                          )}>
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              autoMessageEnabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                            )} />
                            {autoMessageEnabled ? "Envio Ativado" : "Envio Desativado"}
                          </span>
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                          Saudação enviada automaticamente para o celular do cliente assim que você clica em <strong>"Aceitar Pedido"</strong>. Agiliza seu atendimento e deixa seu cliente seguro.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveAutoMessage}
                      disabled={isSavingAutoMessage || isLoadingAutoMessage}
                      className="shrink-0 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider hover:opacity-95 active:scale-98 transition-all shadow-md shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingAutoMessage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : autoMessageSaveSuccess ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-white" />
                          <span>Salvo com Sucesso!</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Salvar Configuração</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grid 2 Colunas: Configuração (7 colunas) + Simulador Idêntico ao Print (5 colunas) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Coluna Esquerda: Controles, Modelos e Editor */}
                  <div className="lg:col-span-7 space-y-5">
                    
                    {/* Switch de Ativação Rápida */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-bold text-foreground">Disparar ao Aceitar Pedido</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {autoMessageEnabled 
                            ? "Ao aceitar um pedido no painel, este recado chega imediatamente no chat do cliente."
                            : "O disparo está pausado. Nenhuma mensagem automática será enviada ao aceitar pedidos."}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAutoMessageEnabled(!autoMessageEnabled)}
                        className={cn(
                          "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner",
                          autoMessageEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                        )}
                        title={autoMessageEnabled ? "Clique para pausar" : "Clique para ativar"}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                            autoMessageEnabled ? "translate-x-7" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>

                    {/* Editor de Texto da Mensagem */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Texto da Mensagem de Boas-vindas
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoMessageText(DEFAULT_AUTO_MESSAGE)}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-colors"
                          title="Restaurar a mensagem padrão de boas-vindas"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restaurar Padrão</span>
                        </button>
                      </div>

                      {/* Emojis Rápidos */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                        <span className="text-[10px] font-bold text-muted-foreground shrink-0 mr-1">Inserir:</span>
                        {[
                          { emoji: "😁", label: "Sorriso" },
                          { emoji: "✨", label: "Brilho" },
                          { emoji: "💛", label: "Coração" },
                          { emoji: "🍔", label: "Hambúrguer" },
                          { emoji: "🍟", label: "Batata" },
                          { emoji: "🛵", label: "Moto" },
                          { emoji: "🍕", label: "Pizza" },
                          { emoji: "🥤", label: "Refrigerante" },
                          { emoji: "😋", label: "Delícia" },
                          { emoji: "👨‍🍳", label: "Chef" },
                          { emoji: "📦", label: "Pacote" },
                          { emoji: "🚀", label: "Rápido" }
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleInsertEmoji(item.emoji)}
                            className="shrink-0 px-2 py-1 rounded-lg bg-muted hover:bg-primary/15 hover:text-primary text-xs transition-all border border-border/60 hover:border-primary/40 active:scale-95 cursor-pointer"
                            title={`Inserir ${item.label}`}
                          >
                            {item.emoji}
                          </button>
                        ))}
                      </div>

                      {/* Textarea */}
                      <textarea
                        value={autoMessageText}
                        onChange={(e) => setAutoMessageText(e.target.value)}
                        rows={9}
                        placeholder="Escreva aqui a mensagem que seu cliente receberá..."
                        className="w-full p-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/10 outline-none resize-none transition-all font-medium leading-relaxed"
                      />

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span className="text-[11px]">As quebras de linha digitadas serão mantidas no balão do cliente.</span>
                        <span className="font-bold text-[11px] bg-muted px-2.5 py-0.5 rounded-full">{autoMessageText.length} caracteres</span>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Simulador Mobile Fiel e Proporcional */}
                  <div className="lg:col-span-5 flex flex-col items-center">
                    <div className="w-full max-w-[360px] flex items-center justify-between px-2 mb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Smartphone className="h-4 w-4 text-primary" />
                        <span>Simulador do Cliente</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Ao Vivo
                      </span>
                    </div>

                    {/* Chassi do Celular com Design Moderno e Fino */}
                    <div className="w-full max-w-[360px] rounded-[2.75rem] p-2.5 bg-zinc-950 border border-zinc-700/80 shadow-2xl flex flex-col select-none">
                      
                      {/* Speaker / Câmera Superior */}
                      <div className="w-20 h-3 bg-zinc-900 rounded-full mx-auto mb-1.5 flex items-center justify-end px-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                      </div>

                      {/* Tela Interna Branca Clean com Altura Ideal */}
                      <div className="rounded-[2.2rem] overflow-hidden bg-white text-zinc-900 flex flex-col h-[590px] border border-zinc-200/50 shadow-inner">
                        
                        {/* 1. Barra de Status */}
                        <div className="px-5 pt-2 pb-1 flex items-center justify-between text-[11px] font-bold text-zinc-800">
                          <span>19:51</span>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-[10px]">📍</span>
                            <span className="text-[10px]">📶</span>
                            <span className="font-semibold text-[9px]">4G</span>
                            <div className="flex items-center gap-0.5 bg-zinc-800 text-white text-[8px] font-bold px-1 py-0.2 rounded-sm">
                              <span>81%</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Topbar do Estabelecimento */}
                        <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2.5 bg-white">
                          <ChevronLeft className="h-5 w-5 stroke-[2.5] text-[#ea1d2c] shrink-0" />
                          <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden border border-zinc-200 shrink-0 shadow-2xs">
                            {companyData?.logo_url ? (
                              <img src={companyData.logo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Store className="h-4.5 w-4.5 text-zinc-700" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-bold text-zinc-900 truncate leading-tight">
                              {companyData?.name || "Tes Tes"}
                            </p>
                            <p className="text-[11px] text-zinc-400 font-normal leading-none mt-0.5">Loja</p>
                          </div>
                        </div>

                        {/* 3. Área Central do Chat */}
                        <div className="flex-1 p-3.5 bg-white flex flex-col justify-between overflow-y-auto custom-scrollbar">
                          <div className="space-y-3">
                            
                            {/* Estrela Dourada + Resposta Rápida */}
                            <div className="text-center space-y-1 pt-0.5">
                              <div className="text-xl leading-none">⭐</div>
                              <p className="text-[11.5px] font-medium text-zinc-700">
                                Geralmente, essa loja responde rápido
                              </p>

                              {/* Colunas lado a lado com divisória central */}
                              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-zinc-100 max-w-[280px] mx-auto">
                                <div className="flex items-center gap-1.5 justify-center pr-2 border-r border-zinc-200">
                                  <div className="relative">
                                    <Clock className="h-3.5 w-3.5 text-zinc-700" />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white" />
                                  </div>
                                  <div className="text-left text-[9px] text-zinc-600 font-medium leading-tight">
                                    <span>responde em média</span>
                                    <br />
                                    <span className="font-bold text-zinc-800">de 2 min</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 justify-center pl-1">
                                  <div className="relative">
                                    <MessageCircle className="h-3.5 w-3.5 text-zinc-700" />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white" />
                                  </div>
                                  <div className="text-left text-[9px] text-zinc-600 font-medium leading-tight">
                                    <span>responde</span>
                                    <br />
                                    <span className="font-bold text-zinc-800">98% das vezes</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Separador de Data Centralizado */}
                            <div className="text-center my-0.5">
                              <span className="text-[9.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                                HOJE
                              </span>
                            </div>

                            {/* Cartão de Aviso Compacto */}
                            <div className="bg-[#fff9f9] border border-[#f5dede] rounded-xl px-3 py-2 text-center space-y-0.5 shadow-2xs">
                              <p className="text-[10.5px] font-bold text-zinc-900">Mensagem automática</p>
                              <p className="text-[9px] text-zinc-500 leading-tight">
                                Não aceite cobrança na entrega se o pedido foi pago pelo app e nunca compartilhe dados pessoais no chat.
                              </p>
                            </div>

                            {/* Balão da Mensagem de Boas-vindas */}
                            <div className="flex items-end gap-2 pt-1">
                              <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden border border-zinc-200 shrink-0 mb-1">
                                {companyData?.logo_url ? (
                                  <img src={companyData.logo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Store className="h-3 w-3 text-zinc-700" />
                                )}
                              </div>

                              <div className="bg-[#f0f2f5] rounded-2xl rounded-bl-xs p-3.5 shadow-2xs border border-zinc-200/50 text-zinc-900 max-w-[85%] relative space-y-1.5">
                                <p className="text-[11.5px] leading-relaxed whitespace-pre-line font-normal text-zinc-800">
                                  {autoMessageText || DEFAULT_AUTO_MESSAGE}
                                </p>
                                <span className="text-[9.5px] text-zinc-400 block text-right font-medium">
                                  19:48
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 4. Campo de Digitação Inferior */}
                          <div className="pt-2 flex items-center gap-2">
                            <div className="flex-1 bg-[#f0f2f5] rounded-full px-4 py-2 text-zinc-400 text-xs flex items-center">
                              <span className="text-[11px]">Mensagem...</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-[#eaecf0] flex items-center justify-center text-zinc-500 shrink-0 shadow-2xs">
                              <Send className="h-3.5 w-3.5 -rotate-12 translate-x-0.5" />
                            </div>
                          </div>
                        </div>

                        {/* 5. Barra de Navegação Android Samsung */}
                        <div className="py-2 px-8 flex items-center justify-between text-zinc-400 text-xs border-t border-zinc-100 bg-white">
                          <span className="font-bold text-sm tracking-widest leading-none">|||</span>
                          <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-zinc-400" />
                          <ChevronLeft className="h-4 w-4 stroke-[2]" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-muted/20">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Central de Atendimento</h3>
              <p className="text-xs text-muted-foreground max-w-xs">Selecione uma conversa ao lado para responder seus clientes e entregadores.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
