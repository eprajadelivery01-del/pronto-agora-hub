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
  getConversation, DEFAULT_AUTO_MESSAGE, getStoreAutoMessageConfig, saveStoreAutoMessageConfig,
  calculateUnreadCount
} from "@/services/chat";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/services/companies";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function ChatPage() {
  const { user, hasRole } = useAuth();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [isClearingEmpty, setIsClearingEmpty] = useState(false);
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get("order_id");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const { playAlert } = useAudioAlert();

  const isLojista = hasRole('company');
  const Layout = isLojista ? BusinessLayout : AdminLayout;
  const qc = useQueryClient();

  const { data: companyData } = useCompany(user?.id, user?.email);
  const [autoMessageEnabled, setAutoMessageEnabled] = useState(true);
  const [autoMessageText, setAutoMessageText] = useState(DEFAULT_AUTO_MESSAGE);
  const [isSavingAutoMessage, setIsSavingAutoMessage] = useState(false);
  const [isLoadingAutoMessage, setIsLoadingAutoMessage] = useState(true);
  const [autoMessageSaveSuccess, setAutoMessageSaveSuccess] = useState(false);
  const [isAutoMessageDialogOpen, setIsAutoMessageDialogOpen] = useState(false);

  const LOJISTA_QUICK_REPLIES = [
    { label: "Saiu p/ entrega", emoji: "🛵", text: "Seu pedido já saiu para entrega! Em breve estará com você." },
    { label: "Em preparo", emoji: "👨‍🍳", text: "Olá! Seu pedido já está sendo preparado com todo carinho." },
    { label: "Quase pronto", emoji: "⏱️", text: "Está quase pronto! Só mais 5 minutinhos e já estará a caminho." },
    { label: "Talheres/Guardanapos", emoji: "🍽️", text: "Combinado! Já incluímos guardanapos e talheres no pacote." },
    { label: "Tudo confirmado", emoji: "👍", text: "Perfeito! Tudo anotado e confirmado por aqui." },
    { label: "Como posso ajudar?", emoji: "👋", text: "Olá! Como podemos te ajudar com o seu pedido?" },
    { label: "Bom apetite!", emoji: "❤️", text: "Muito obrigado pela preferência! Bom apetite! 🍽️✨" },
  ];

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
      setIsAutoMessageDialogOpen(false);
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
        .select("*, messages(id, content, created_at, sender_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Global Realtime listener for incoming messages com aviso sonoro
  useEffect(() => {
    if (!user?.id) return;
    const channelId = `admin-chat-global-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["conversations", user.id] });
          qc.invalidateQueries({ queryKey: ["messages"] });
          const newMsg = payload.new as any;
          if (newMsg && newMsg.sender_id !== user.id && !newMsg.content?.endsWith('\u200B')) {
            playAlert();
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
  }, [user?.id, qc, playAlert]);

  // Profiles map for conversation display
  const { data: profilesMap } = useQuery({
    queryKey: ["profiles-map", conversations?.length],
    enabled: !!conversations && conversations.length > 0,
    queryFn: async () => {
      if (!conversations) return {};
      const participantIds = Array.from(new Set(
        conversations.flatMap((c: any) => c.participants || [])
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

  const getOtherParticipantId = (conv: any) => {
    return conv.participants?.find((id: string) => id !== user?.id) || conv.participants?.[0];
  };

  const getConvTitle = (conv: any) => {
    const orderTag = conv.order_id ? `#${conv.order_id.slice(-6).toUpperCase()}` : null;

    let extractedTopic = null;
    if (conv.messages && conv.messages.length > 0) {
      const firstMsg = [...conv.messages].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      if (firstMsg?.content?.startsWith('[Assunto:')) {
        extractedTopic = firstMsg.content.replace('[Assunto:', '').replace(']', '').trim();
      }
    }

    const otherId = getOtherParticipantId(conv);
    const otherProfile = profilesMap?.[otherId];
    const customerName = otherProfile?.full_name || (otherId ? `Cliente #${otherId.slice(0, 4).toUpperCase()}` : null);

    if (orderTag) {
      return customerName ? `${customerName} (${orderTag})` : `Pedido ${orderTag}`;
    }

    if (otherProfile?.full_name) {
      return extractedTopic ? `${otherProfile.full_name} (${extractedTopic})` : otherProfile.full_name;
    }

    if (otherId) {
      return extractedTopic || `Usuário #${otherId.slice(0, 6).toUpperCase()}`;
    }

    return extractedTopic || (conv.title !== 'Conversa' ? conv.title : null) || conv.topic || "Conversa";
  };

  // Agrupa e unifica todas as conversas pelo mesmo participante/cliente (estilo WhatsApp)
  const unifiedConversations = useMemo(() => {
    if (!conversations) return [];

    const participantGroups: Record<string, any[]> = {};

    conversations.forEach((conv: any) => {
      const otherId = conv.participants?.find((id: string) => id && id !== user?.id && id !== companyData?.id)
        || conv.participants?.find((id: string) => id && id !== user?.id)
        || conv.participants?.[0]
        || conv.id;

      if (!participantGroups[otherId]) {
        participantGroups[otherId] = [];
      }
      participantGroups[otherId].push(conv);
    });

    const unified = Object.values(participantGroups).map((group) => {
      // Ordena as conversas da mais recente para a mais antiga
      const sortedConvs = [...group].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const primary = sortedConvs[0];
      const allIds = Array.from(new Set(group.map((c) => c.id)));
      const allParticipants = Array.from(new Set(group.flatMap((c) => c.participants || [])));
      const allOrderIds = Array.from(new Set(group.map((c) => c.order_id).filter(Boolean)));
      const latestOrderId = sortedConvs.find((c) => c.order_id)?.order_id || null;

      // Junta e deduplica todas as mensagens de todas as conversas desse mesmo cliente
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
        id: primary.id,
        all_ids: allIds,
        participants: allParticipants,
        order_id: latestOrderId,
        all_order_ids: allOrderIds,
        messages: deduplicated,
      };
    });

    return unified.sort((a, b) => {
      const lastMsgA = a.messages && a.messages.length > 0
        ? Math.max(...a.messages.map((m: any) => new Date(m.created_at).getTime()))
        : new Date(a.created_at).getTime();

      const lastMsgB = b.messages && b.messages.length > 0
        ? Math.max(...b.messages.map((m: any) => new Date(m.created_at).getTime()))
        : new Date(b.created_at).getTime();

      return lastMsgB - lastMsgA;
    });
  }, [conversations, user?.id, companyData?.id]);

  useEffect(() => {
    const handleUrlParams = async () => {
      if (conversations && orderIdParam && !selectedConv) {
        let convForOrder = unifiedConversations.find((c: any) => 
          c.order_id === orderIdParam || (c.all_order_ids && c.all_order_ids.includes(orderIdParam))
        );
        
        if (!convForOrder && searchParams.get("customer_id") && user) {
          const customerId = searchParams.get("customer_id");
          const existing = await getConversation(orderIdParam);
          if (existing) {
            qc.invalidateQueries({ queryKey: ["conversations", user.id] });
            setSelectedConv(existing);
          } else {
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
              qc.invalidateQueries({ queryKey: ["conversations", user.id] });
              setSelectedConv(created);
            }
          }
        } else if (convForOrder) {
          setSelectedConv(convForOrder);
        }
      }
    };
    handleUrlParams();
  }, [conversations, orderIdParam, selectedConv, searchParams, user, qc, unifiedConversations]);

  const activeConvIds = useMemo(() => {
    if (!selectedConv) return undefined;
    return selectedConv.all_ids || [selectedConv.id];
  }, [selectedConv]);

  const { data: messages, isLoading: loadingMessages } = useMessages(activeConvIds);
  const sendMessageMutation = useSendMessage();
  const deleteConversationMutation = useDeleteConversation();

  // Limpa mensagens otimistas que já foram confirmadas pelo Supabase
  useEffect(() => {
    if (messages && messages.length > 0) {
      setOptimisticMessages((prev) =>
        prev.filter((opt) => !messages.some((m: any) => 
          (m.id === opt.id) ||
          (m.content?.replace(/\u200B/g, '') === opt.content?.replace(/\u200B/g, '') && m.sender_id === opt.sender_id)
        ))
      );
    }
  }, [messages]);

  const displayMessages = useMemo(() => {
    const list = messages ? [...messages] : [];
    if (optimisticMessages.length > 0 && selectedConv) {
      const targetIds = selectedConv.all_ids || [selectedConv.id];
      const matchingOpts = optimisticMessages.filter((opt) => targetIds.includes(opt.conversation_id));
      list.push(...matchingOpts);
    }
    return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, optimisticMessages, selectedConv]);

  useEffect(() => {
    if (selectedConv) {
      const readMap = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
      const now = new Date().toISOString();
      readMap[selectedConv.id] = now;
      if (selectedConv.all_ids && Array.isArray(selectedConv.all_ids)) {
        selectedConv.all_ids.forEach((id: string) => {
          readMap[id] = now;
        });
      }
      localStorage.setItem('chat_read_timestamps', JSON.stringify(readMap));
      window.dispatchEvent(new Event('chat_read_update'));
    }
  }, [selectedConv, messages]);

  // Auto-scroll down when messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages]);

  const handleSelectConv = (conv: any) => {
    setSelectedConv(conv);
    setTimeout(() => {
      inputRef.current?.focus();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  const handleSend = (customText?: string) => {
    const rawContent = (typeof customText === "string" ? customText : message).trim();
    if (!rawContent || !selectedConv || isSendingRef.current) return;

    isSendingRef.current = true;
    setMessage("");

    const targetIds = selectedConv.all_ids || [selectedConv.id];
    const tempId = `optimistic-${Date.now()}`;

    // Adiciona instantaneamente na interface para resposta WhatsApp em 0ms
    const optMsg = {
      id: tempId,
      conversation_id: selectedConv.id,
      sender_id: user?.id,
      content: rawContent + '\u200B',
      created_at: new Date().toISOString(),
      pending: true,
    };

    setOptimisticMessages((prev) => [...prev, optMsg]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 40);

    sendMessageMutation.mutate({
      conversationId: targetIds,
      content: rawContent
    }, {
      onError: (err) => {
        console.error("Falha ao enviar mensagem:", err);
        toast.error("Erro ao enviar mensagem");
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
      },
      onSettled: () => {
        isSendingRef.current = false;
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    });
  };

  const handleDeleteConversation = async (conv: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ids = conv?.all_ids || (typeof conv === 'string' ? [conv] : [conv?.id]);
    if (!ids || ids.length === 0) return;
    if (!window.confirm("Tem certeza que deseja apagar esta conversa e todo o seu histórico?")) return;

    try {
      await deleteConversationMutation.mutateAsync(ids);
      toast.success("Conversa apagada com sucesso!");
      if (selectedConv && ids.includes(selectedConv.id)) {
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

  const renderConvIcon = (conv: any) => {
    if (conv.topic === 'driver_application') return <BikeIcon className="h-5 w-5" />;
    return conv.order_id ? <MessageSquare className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />;
  };

  // Filtra as conversas unificadas por busca
  const sortedConversations = useMemo(() => {
    if (!unifiedConversations) return [];
    if (!searchFilter.trim()) return unifiedConversations;

    const term = searchFilter.toLowerCase();
    return unifiedConversations.filter((conv) => {
      const title = getConvTitle(conv).toLowerCase();
      const lastMsg = conv.messages?.[conv.messages.length - 1]?.content?.toLowerCase() || "";
      const orderId = conv.order_id?.toLowerCase() || "";
      const allOrderMatch = conv.all_order_ids?.some((oid: string) => oid.toLowerCase().includes(term));
      return title.includes(term) || lastMsg.includes(term) || orderId.includes(term) || allOrderMatch;
    });
  }, [unifiedConversations, searchFilter, profilesMap]);

  // Contagem exata de conversas que possuem mensagens de clientes aguardando resposta
  const totalUnreadConvs = useMemo(() => {
    return sortedConversations.filter((conv) => {
      return calculateUnreadCount(conv, user?.id, companyData?.id, readTimestamps) > 0;
    }).length;
  }, [sortedConversations, user?.id, companyData?.id, readTimestamps]);

  // Auto-seleciona a conversa mais relevante ao abrir a tela (com mensagens não lidas em primeiro lugar)
  useEffect(() => {
    if (!selectedConv && sortedConversations.length > 0 && !orderIdParam) {
      const firstUnread = sortedConversations.find(
        (conv) => calculateUnreadCount(conv, user?.id, companyData?.id, readTimestamps) > 0
      );
      setSelectedConv(firstUnread || sortedConversations[0]);
    }
  }, [sortedConversations, selectedConv, orderIdParam, user?.id, companyData?.id, readTimestamps]);

  return (
    <Layout title="Chat" subtitle="Central de atendimento e mensagens automáticas" fullHeight>
      <div className="flex flex-1 h-full w-full min-w-0 min-h-0 bg-card overflow-hidden">
        {/* Sidebar de Conversas */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 border-r border-border flex flex-col bg-muted/20 min-w-0 overflow-hidden",
          selectedConv ? "hidden md:flex" : "flex"
        )}>
          {/* Topo da Sidebar: Título e Ação Secundária */}
          <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-xs uppercase tracking-wider">Conversas</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {sortedConversations.length}
              </span>
              {totalUnreadConvs > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground animate-pulse">
                  {totalUnreadConvs} {totalUnreadConvs === 1 ? 'não lida' : 'não lidas'}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              {isLojista && (
                <button 
                  onClick={() => setIsAutoMessageDialogOpen(true)}
                  title="Configurar Mensagem Automática de Aceite"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[0.65rem] font-bold uppercase tracking-wider transition-colors border border-primary/20 cursor-pointer shadow-2xs"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Msg Auto</span>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    autoMessageEnabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                  )} />
                </button>
              )}
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

          {/* Campo de Busca */}
          <div className="p-3 border-b border-border/50 bg-background/40 shrink-0">
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
                
                const isSelected = selectedConv?.id === conv.id || (selectedConv?.all_ids && selectedConv.all_ids.includes(conv.id));
                const unreadCount = calculateUnreadCount(conv, user?.id, companyData?.id, readTimestamps);
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConv(conv)}
                    className={cn(
                      "w-full p-3.5 text-left transition-all border-b border-border/40 relative group cursor-pointer flex items-center justify-between",
                      isSelected ? "bg-card shadow-sm z-10" : "hover:bg-muted/40"
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
                            {conv.order_id && <span className="text-[10px] font-black text-primary uppercase ml-1">(#{conv.order_id.slice(-4)})</span>}
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
                          {unreadCount > 0 && !isSelected && (
                            <span className="inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 animate-pulse">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteConversation(conv, e)}
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
        <div className={cn(
          "flex-1 flex flex-col bg-background relative min-w-0 min-h-0 h-full overflow-hidden",
          !selectedConv ? "hidden md:flex" : "flex"
        )}>
          {selectedConv ? (
            <>
              {/* Header da Conversa Ativa */}
              <div className="p-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedConv(null)}
                    className="md:hidden p-2 -ml-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    title="Voltar para a lista de conversas"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {profilesMap?.[getOtherParticipantId(selectedConv)]?.avatar_url ? (
                      <img src={profilesMap[getOtherParticipantId(selectedConv)].avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-sm block truncate">{getConvTitle(selectedConv)}</span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest block truncate">
                      {profilesMap?.[getOtherParticipantId(selectedConv)]?.role === 'company' ? "Lojista Parceiro" : profilesMap?.[getOtherParticipantId(selectedConv)]?.role === 'driver' ? "Entregador Parceiro" : "Cliente"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isLojista && (
                    <button
                      onClick={() => setIsAutoMessageDialogOpen(true)}
                      title="Configurar Mensagem Automática de Aceite"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all cursor-pointer mr-1"
                    >
                      <Bot className="h-4 w-4" />
                      <span className="hidden sm:inline">Msg Automática</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteConversation(selectedConv)}
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
                ) : displayMessages && displayMessages.length > 0 ? (
                  displayMessages.map((msg: any) => {
                    const isMe = (msg.sender_id === user?.id && msg.content?.endsWith('\u200B')) || msg.sender_id === user?.id;
                    const cleanContent = msg.content ? msg.content.replace(/\u200B/g, '') : '';
                    const isPending = !!msg.pending;
                    
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[85%] md:max-w-[70%]",
                          isMe ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl p-4 shadow-2xs whitespace-pre-wrap break-words leading-relaxed text-sm transition-all",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-xs"
                              : "bg-muted/80 text-foreground rounded-bl-xs border border-border/40"
                          )}
                        >
                          {cleanContent}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isMe && (
                            isPending ? (
                              <Clock className="h-3 w-3 text-muted-foreground/60 animate-pulse" />
                            ) : (
                              <CheckCheck className="h-3.5 w-3.5 text-primary/70" />
                            )
                          )}
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

              {/* Barra de Respostas Rápidas (1 toque para responder) */}
              <div className="px-3 py-2 border-t border-border/50 bg-card/70 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase tracking-wider shrink-0 bg-amber-500/10 px-2 py-1 rounded-lg">
                  <Zap className="h-3 w-3" />
                  <span>Rápidas</span>
                </div>
                {LOJISTA_QUICK_REPLIES.map((qr, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center rounded-full bg-muted/80 hover:bg-muted border border-border/80 text-xs font-medium text-foreground transition-all shrink-0 shadow-2xs overflow-hidden group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(qr.text);
                        inputRef.current?.focus();
                      }}
                      title={`Inserir no campo: "${qr.text}"`}
                      className="flex items-center gap-1.5 px-3 py-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span>{qr.emoji}</span>
                      <span>{qr.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSend(qr.text)}
                      title={`Enviar agora em 1 toque: "${qr.text}"`}
                      className="px-2 py-1.5 bg-primary/10 group-hover:bg-primary text-primary group-hover:text-primary-foreground transition-all flex items-center justify-center cursor-pointer border-l border-border/60"
                    >
                      <Zap className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Barra de Envio com Form para suporte a Enter e Teclado Mobile */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="p-3 border-t border-border bg-card/80 flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Digite sua resposta e tecle Enter..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-muted/60 text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 text-sm outline-none border border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className="p-2.5 px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all shrink-0 cursor-pointer shadow-sm flex items-center gap-1.5 font-bold text-xs"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Enviar</span>
                      <Send className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Empty State Limpo e Moderno */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 md:p-12 bg-muted/10">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary shadow-sm">
                <MessageSquare className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-foreground mb-1.5">
                Central de Atendimento
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
                Selecione uma conversa na lista ao lado para responder aos seus clientes e entregadores em tempo real.
              </p>
              {isLojista && (
                <button
                  onClick={() => setIsAutoMessageDialogOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 text-foreground font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  <Bot className="h-4 w-4 text-primary" />
                  <span>Configurar Mensagem Automática de Aceite</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal / Dialog de Configuração da Mensagem Automática */}
      <Dialog open={isAutoMessageDialogOpen} onOpenChange={setIsAutoMessageDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh]">
          <div className="p-5 md:p-6 border-b border-border bg-muted/20 shrink-0">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    Mensagem Automática de Aceite
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Enviada no chat do cliente assim que você clica em "Aceitar Pedido".
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-5 md:p-6 space-y-5 overflow-y-auto min-h-0 flex-1 custom-scrollbar">
            {/* Switch de Ativação */}
            <div className="rounded-2xl border border-border bg-muted/30 p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">Disparar ao Aceitar Pedido</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {autoMessageEnabled 
                    ? "Ativado: o cliente recebe esta mensagem automaticamente ao aceitar o pedido."
                    : "Desativado: nenhuma mensagem automática será enviada ao aceitar."}
                </p>
              </div>

              <Switch
                checked={autoMessageEnabled}
                onCheckedChange={setAutoMessageEnabled}
              />
            </div>

            {/* Editor de Texto */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Texto da Mensagem
                </label>
                <button
                  type="button"
                  onClick={() => setAutoMessageText(DEFAULT_AUTO_MESSAGE)}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-colors"
                  title="Restaurar a mensagem padrão de boas-vindas"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              {/* Emojis Rápidos */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
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

              <textarea
                value={autoMessageText}
                onChange={(e) => setAutoMessageText(e.target.value)}
                rows={4}
                placeholder="Escreva aqui a mensagem que seu cliente receberá..."
                className="w-full p-3.5 rounded-xl border border-border bg-background text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all font-medium leading-relaxed"
              />

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Quebras de linha digitadas serão mantidas no chat.</span>
                <span className="font-bold bg-muted px-2 py-0.5 rounded-full">{autoMessageText.length} caracteres</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAutoMessageDialogOpen(false)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-bold text-foreground transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAutoMessage}
              disabled={isSavingAutoMessage || isLoadingAutoMessage}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-95 active:scale-98 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSavingAutoMessage ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : autoMessageSaveSuccess ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Salvar Configuração</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
