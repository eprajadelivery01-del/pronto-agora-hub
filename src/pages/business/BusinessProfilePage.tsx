// @ts-nocheck
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Store, Camera, ImagePlus, Loader2, Save, User, MapPin, Phone, 
  Smartphone, Eye, Layers, Info, CheckCircle2, Pencil, X, Link as LinkIcon, Clock3, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WORKING_DAYS = [
  { day: 'Seg', active: true, start: '08:00', end: '18:00' },
  { day: 'Ter', active: true, start: '08:00', end: '18:00' },
  { day: 'Qua', active: true, start: '08:00', end: '18:00' },
  { day: 'Qui', active: true, start: '08:00', end: '18:00' },
  { day: 'Sex', active: true, start: '08:00', end: '18:00' },
  { day: 'Sab', active: true, start: '08:00', end: '12:00' },
  { day: 'Dom', active: false, start: '00:00', end: '00:00' },
];

const normalizeGallery = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter((url) => typeof url === "string" && url.trim());
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((url) => typeof url === "string" && url.trim());
    } catch {}
    return value.split(",").map((url) => url.trim()).filter(Boolean);
  }
  if (value && typeof value === "object") return Object.values(value).filter((url) => typeof url === "string" && url.trim()) as string[];
  return [];
};

const normalizeWorkingDays = (value: any) => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }

  const rawDays = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.days)
      ? parsed.days
      : Array.isArray(parsed?.workingDays)
        ? parsed.workingDays
        : null;

  if (!rawDays) return DEFAULT_WORKING_DAYS.map((day) => ({ ...day }));

  return DEFAULT_WORKING_DAYS.map((defaultDay, index) => {
    const day = rawDays[index] || {};
    return {
      day: String(day.day || defaultDay.day),
      active: typeof day.active === "boolean" ? day.active : defaultDay.active,
      start: typeof day.start === "string" ? day.start : defaultDay.start,
      end: typeof day.end === "string" ? day.end : defaultDay.end,
    };
  });
};

export default function BusinessProfilePage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company data
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("restaurante");
  const [deliveryFee, setDeliveryFee] = useState("0.00");
  const [isOpen, setIsOpen] = useState(true);
  const [showInMarketplace, setShowInMarketplace] = useState(false);
  const [businessHours, setBusinessHours] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState(() => DEFAULT_WORKING_DAYS.map((day) => ({ ...day })));

  // Edit states for overlays
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchCompanyData();

    // Subscribe to realtime changes for store status synchronization
    const channel = supabase
      .channel('store-status-sync')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'companies',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.is_open !== undefined) {
          setIsOpen(payload.new.is_open);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchCompanyData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);
        setStoreName(company.name || "");
        setPhone(company.phone || "");
        setAddress(company.address || "");
        setDescription(company.description || "");
        setLogoUrl(company.logo_url || "");
        setCoverUrl(company.cover_url || "");
        setCategory(company.category || "restaurante");
        setIsOpen(company.is_open ?? true);
        setShowInMarketplace(company.show_in_marketplace ?? false);
        setDeliveryFee(company.delivery_fee?.toString() || "0.00");
        setBusinessHours(company.business_hours || "");
        setGallery(normalizeGallery(company.gallery));
        setWorkingDays(normalizeWorkingDays(company.business_hours));
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    // Validate size and type
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande! Limite de 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      if (type === 'logo') {
        setLogoUrl(publicUrl);
        setTempUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
        setTempUrl(publicUrl);
      }

      toast.success("Foto enviada com sucesso!", {
        description: "Não esqueça de clicar em 'Salvar Perfil' para salvar permanentemente."
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error("Falha ao enviar imagem do dispositivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !companyId) return;

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} é muito grande! Pulei.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `gallery-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${companyId}/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('store-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('store-assets')
          .getPublicUrl(filePath);

        newUrls.push(data.publicUrl);
      }

      setGallery(prev => [...prev, ...newUrls]);
      toast.success(`${newUrls.length} fotos adicionadas à galeria!`);
    } catch (error: any) {
      console.error('Erro no upload da galeria:', error);
      toast.error("Erro ao enviar algumas fotos.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeGalleryItem = (url: string) => {
    setGallery(prev => prev.filter(item => item !== url));
  };

  const toggleStoreActive = async () => {
    if (!companyId) return;
    // Both fields toggle together: open = visible in marketplace
    const newActive = !isOpen;
    setIsOpen(newActive);
    setShowInMarketplace(newActive);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_open: newActive, show_in_marketplace: newActive })
        .eq("id", companyId);
      if (error) throw error;
      toast.success(
        newActive
          ? "✅ Loja ativa! Visível no marketplace e aceitando pedidos."
          : "⏸️ Loja pausada. Oculta no marketplace e sem receber pedidos."
      );
    } catch {
      setIsOpen(!newActive);
      setShowInMarketplace(!newActive);
      toast.error("Erro ao atualizar status da loja");
    }
  };

  const updateWorkingDay = (index: number, field: string, value: any) => {
    const newDays = [...workingDays];
    newDays[index] = { ...newDays[index], [field]: value };
    setWorkingDays(newDays);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!companyId) return;
    setSaving(true);

    try {
      const hoursJson = JSON.stringify(workingDays);
      const { error } = await (supabase as any)
        .from("companies")
        .update({
          name: storeName,
          phone,
          address,
          description,
          logo_url: logoUrl,
          cover_url: coverUrl,
          category: category,
          delivery_fee: parseFloat(deliveryFee.replace(',', '.')),
          is_open: isOpen,
          show_in_marketplace: showInMarketplace,
          business_hours: hoursJson,
          gallery: gallery,
        })
        .eq("id", companyId);

      if (error) throw error;
      toast.success("Perfil Social atualizado!", {
        description: "Suas mudanças já estão visíveis no marketplace.",
        icon: <CheckCircle2 className="h-4 w-4 text-success" />
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BusinessLayout title="Perfil">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Editor de Perfil">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Left Column: Social Editor */}
        <div className="xl:col-span-8 space-y-6">
          
          <div className="bg-card border border-border rounded-[2.5rem] shadow-card overflow-hidden">
            
            {/* SOCIAL HEADER: Banner + Avatar overlapping */}
            <div className="relative group/banner h-64 md:h-80 bg-muted">
               {/* Banner Image */}
               {coverUrl ? (
                 <img src={coverUrl} className="w-full h-full object-cover" alt="Banner" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <Camera className="h-12 w-12 text-muted-foreground/20" />
                 </div>
               )}
               
               {/* Banner Overlay/Edit */}
               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => { setIsEditingCover(true); setTempUrl(coverUrl); }}
                    className="px-6 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/30 transition-all shadow-2xl cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" /> Alterar Banner
                  </button>
               </div>

               {/* Always-visible Floating Action Button for banner change */}
               <button
                 onClick={() => { setIsEditingCover(true); setTempUrl(coverUrl); }}
                 className="absolute top-4 right-4 z-10 p-3 bg-white/80 dark:bg-card/80 backdrop-blur-md border border-border/50 text-foreground hover:text-primary rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center cursor-pointer"
                 title="Alterar Banner"
               >
                 <Camera className="h-4 w-4" />
               </button>

               {/* Overlapping Avatar (Logo) */}
               <div className="absolute -bottom-16 left-8 group/avatar">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-white dark:bg-card p-2 shadow-2xl border-4 border-card relative">
                     <div className="w-full h-full rounded-[2rem] bg-muted overflow-hidden flex items-center justify-center relative">
                        {logoUrl ? (
                          <img src={logoUrl} className="w-full h-full object-cover" alt="Logo" />
                        ) : (
                          <Store className="h-10 w-10 text-muted-foreground/30" />
                        )}
                        
                        {/* Avatar Edit Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                           onClick={() => { setIsEditingLogo(true); setTempUrl(logoUrl); }}>
                           <Camera className="h-8 w-8 text-white" />
                        </div>
                     </div>
                     {/* Always-visible Floating Action Button for logo change */}
                     <button
                       onClick={() => { setIsEditingLogo(true); setTempUrl(logoUrl); }}
                       className="absolute bottom-0 right-0 z-10 p-3 bg-primary hover:bg-primary/95 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center border-4 border-card cursor-pointer"
                       title="Alterar Logo"
                     >
                       <Camera className="h-4 w-4" />
                     </button>
                  </div>
               </div>
            </div>

            {/* Content Area */}
            <div className="pt-20 px-8 pb-8 space-y-10">
               
               {/* Introduction Header */}
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-1">
                     <h2 className="text-3xl font-black text-foreground tracking-tight">
                        {storeName || "Minha Loja"}
                     </h2>
                     <div className="flex items-center gap-2 mt-1">
                        <div className={cn("h-2.5 w-2.5 rounded-full", isOpen ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        <span className={cn("text-[11px] font-black uppercase tracking-widest", isOpen ? "text-green-600" : "text-red-600")}>
                           {isOpen ? "Sua Loja está aberta" : "Sua Loja está fechada"}
                        </span>
                      </div>
                  </div>
                  <div className="flex gap-3">
                     <button 
                        onClick={() => handleSave()}
                        className="px-8 py-3 rounded-2xl bg-foreground text-background font-black text-sm uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl shadow-foreground/10"
                     >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Perfil"}
                     </button>
                  </div>
               </div>

               {/* Inputs Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border/50">
                  <div className="space-y-6">
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        <Info className="h-3 w-3" /> Sobre o Negócio
                     </div>
                     
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Nome da Loja</label>
                           <input
                              value={storeName}
                              onChange={(e) => setStoreName(e.target.value)}
                              className="w-full px-5 py-3.5 rounded-2xl border border-border bg-background focus:ring-4 focus:ring-primary/5 transition-all outline-none font-bold"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Bio / Descrição</label>
                           <textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Fale um pouco sobre o que você vende..."
                              className="w-full px-5 py-3.5 rounded-2xl border border-border bg-background focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium text-sm min-h-[100px] resize-none"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Categoria / Setor</label>
                           <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              className="w-full px-5 py-3.5 rounded-2xl border border-border bg-background focus:ring-4 focus:ring-primary/5 transition-all outline-none font-bold appearance-none cursor-pointer"
                           >
                              <option value="restaurante">Restaurante</option>
                              <option value="mercado">Mercado / Mercearia</option>
                              <option value="farmacia">Farmácia / Drogaria</option>
                              <option value="lanches">Lanches / Fast Food</option>
                              <option value="pizza">Pizzaria</option>
                              <option value="bebidas">Adega / Bebidas</option>
                              <option value="padaria">Padaria / Confeitaria</option>
                              <option value="hamburguer">Hambúrguer Artesanal</option>
                              <option value="assados">Assados</option>
                              <option value="acompanhamentos">Acompanhamentos</option>
                              <option value="marmita">Marmita</option>
                              <option value="perfumaria">Perfumaria</option>
                              <option value="doces">Doceria / Sobremesas</option>
                              <option value="pet">Pet Shop / Agro</option>
                              <option value="shopping">Shopping / Variedades</option>
                           </select>
                        </div>
                        
                        <div className="pt-4 border-t border-border/40 mt-6 space-y-3">
                             {/* Toggle Unificado: Loja Ativa */}
                             <button
                                type="button"
                                onClick={toggleStoreActive}
                                className={cn(
                                  "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group",
                                  isOpen
                                    ? "bg-emerald-50 border-emerald-400 shadow-md shadow-emerald-100"
                                    : "bg-muted/40 border-border/60 hover:border-border"
                                )}
                             >
                                <div className="text-left">
                                   <p className={cn(
                                     "text-[11px] font-black uppercase tracking-widest",
                                     isOpen ? "text-emerald-700" : "text-muted-foreground"
                                   )}>
                                     {isOpen ? "✅ Loja Ativa" : "⏸️ Loja Pausada"}
                                   </p>
                                   <p className={cn(
                                     "text-[10px] font-medium mt-0.5",
                                     isOpen ? "text-emerald-600" : "text-muted-foreground"
                                   )}>
                                     {isOpen
                                       ? "Visível no marketplace · Aceitando pedidos"
                                       : "Oculta no marketplace · Sem receber pedidos"}
                                   </p>
                                </div>
                                <div className={cn(
                                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
                                  isOpen ? "bg-emerald-500" : "bg-muted-foreground/30"
                                )}>
                                   <span className={cn(
                                     "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                     isOpen ? "translate-x-6" : "translate-x-1"
                                   )} />
                                </div>
                             </button>

                           <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Horário de Funcionamento</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstActive = workingDays.find(d => d.active);
                                    if (firstActive) {
                                      const newDays = (Array.isArray(workingDays) ? workingDays : []).map(d => ({ ...d, start: firstActive.start, end: firstActive.end }));
                                      setWorkingDays(newDays);
                                      toast.success("Horários aplicados a todos os dias!");
                                    }
                                  }}
                                  className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline"
                                >
                                  Repetir Horários (Aplicar a todos)
                                </button>
                              </div>
                              <div className="space-y-2 p-4 bg-muted/30 rounded-2xl border border-border/40">
                                {(Array.isArray(workingDays) ? workingDays : []).map((wd, idx) => (
                                  <div key={wd.day} className="flex items-center justify-between gap-4 py-2 border-b border-border/10 last:border-0">
                                    <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={wd.active} 
                                        onChange={(e) => updateWorkingDay(idx, 'active', e.target.checked)}
                                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                      />
                                      <span className={cn("text-xs font-bold w-10", wd.active ? "text-foreground" : "text-muted-foreground")}>{wd.day}</span>
                                    </div>
                                    
                                    <div className={cn("flex items-center gap-3 transition-all", !wd.active && "opacity-20 pointer-events-none")}>
                                      <div className="relative">
                                        <Clock3 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                                        <input 
                                          type="text" 
                                          value={wd.start} 
                                          onChange={(e) => updateWorkingDay(idx, 'start', e.target.value)}
                                          className="w-20 pl-7 pr-2 py-1.5 text-[11px] font-black bg-background border border-border rounded-xl text-center outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                                          placeholder="08:00"
                                        />
                                      </div>
                                      <span className="text-[10px] font-black text-muted-foreground/30">➜</span>
                                      <div className="relative">
                                        <Clock3 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                                        <input 
                                          type="text" 
                                          value={wd.end} 
                                          onChange={(e) => updateWorkingDay(idx, 'end', e.target.value)}
                                          className="w-20 pl-7 pr-2 py-1.5 text-[11px] font-black bg-background border border-border rounded-xl text-center outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                                          placeholder="18:00"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                         <Phone className="h-3 w-3" /> Contato e Localização
                      </div>

                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">WhatsApp de Vendas</label>
                            <div className="relative">
                               <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                               <input
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-border bg-background outline-none font-bold"
                                  placeholder="(00) 00000-0000"
                               />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Endereço Fiscal/Físico</label>
                            <div className="relative">
                               <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                               <input
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                  className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-border bg-background outline-none font-bold italic text-sm"
                                  placeholder="Av. Brasil, 123 - Centro"
                               />
                            </div>
                         </div>

                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Taxa de Entrega Padrão (R$)</label>
                            <div className="relative">
                               <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                               <input
                                  value={deliveryFee}
                                  onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.,]/g, ""))}
                                  className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-border bg-background outline-none font-black text-primary text-lg"
                                  placeholder="0,00"
                               />
                            </div>
                         </div>
                      </div>

                      {/* GALLERY SECTION */}
                      <div className="pt-8 space-y-4">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                               <ImagePlus className="h-3 w-3" /> Galeria de Fotos
                            </div>
                            <label className="cursor-pointer px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                               Adicionar
                               <input type="file" multiple accept="image/*"  className="hidden" onChange={handleGalleryUpload} />
                            </label>
                         </div>
                         
                         <div className="grid grid-cols-3 gap-3">
                            {(Array.isArray(gallery) ? gallery : []).map((url, idx) => (
                               <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group/item border border-border/50">
                                  <img src={url} className="w-full h-full object-cover" />
                                  <button 
                                    onClick={() => removeGalleryItem(url)}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                               </div>
                            ))}
                            {gallery.length === 0 && (
                               <div className="col-span-3 py-12 border-2 border-dashed border-border rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground/30">
                                  <ImagePlus className="h-8 w-8 mb-2" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest">Sua galeria está vazia</p>
                                </div>
                            )}
                         </div>
                      </div>
                   </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Marketplace Preview Side (Simplified) */}
        <div className="xl:col-span-4 hidden xl:block">
           <div className="sticky top-28 bg-muted/30 border border-border/50 rounded-[3rem] p-8 text-center space-y-6">
              <div className="flex items-center justify-center gap-2 text-primary">
                 <Eye className="h-5 w-5" />
                 <h3 className="font-black text-xs uppercase tracking-widest">Marketplace View</h3>
              </div>
              
              {/* Minimalist Phone Card Preview */}
              <div className="w-full max-w-[260px] mx-auto aspect-[9/18] bg-foreground rounded-[3rem] p-2.5 shadow-2xl overflow-hidden group">
                 <div className={cn(
                    "w-full h-full bg-background rounded-[2.2rem] overflow-hidden flex flex-col relative transition-all duration-500",
                    !isOpen && "grayscale opacity-50"
                 )}>
                    <div className="h-20 bg-muted overflow-hidden relative">
                       {coverUrl && <img src={coverUrl} className="w-full h-full object-cover" />}
                       <div className="absolute inset-0 bg-black/20" />
                       <div className="absolute -bottom-3 left-3 w-10 h-10 rounded-xl bg-white p-1 shadow-lg">
                          <div className="w-full h-full rounded-lg bg-muted overflow-hidden">
                             {logoUrl && <img src={logoUrl} className="w-full h-full object-cover" />}
                          </div>
                       </div>
                    </div>
                    <div className="mt-5 px-4 space-y-4">
                       <div>
                          <p className="text-[10px] font-black text-foreground truncate">{storeName || "Sua Loja"}</p>
                          <p className="text-[7px] text-muted-foreground font-bold">📍 {address?.split("-")[0] || "Sua Cidade"}</p>
                       </div>
                       <div className="h-14 bg-muted/40 rounded-xl p-2">
                          <p className="text-[7px] text-muted-foreground line-clamp-4 italic leading-relaxed">
                             {description || "Sua descrição aparecerá aqui para os milhares de clientes do Pronto Agora."}
                          </p>
                       </div>
                       <div className="space-y-2">
                          <div className="h-6 bg-primary/10 rounded-lg" />
                          <div className="h-6 bg-muted/40 rounded-lg" />
                       </div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

      {/* URL EDIT MODALS/OVERLAYS */}
      {(isEditingLogo || isEditingCover) && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[2.5rem] p-6 md:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 scrollbar-thin">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                       <Camera className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-black text-foreground">
                       {isEditingLogo ? "Alterar Logo" : "Alterar Banner"}
                    </h3>
                 </div>
                 <button onClick={() => { setIsEditingLogo(false); setIsEditingCover(false); }} className="p-2 rounded-xl hover:bg-muted transition-colors cursor-pointer">
                    <X className="h-6 w-6" />
                 </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                   <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                      Sua imagem será armazenada com segurança. O tamanho ideal é 1200x400 para banners e 400x400 para logos.
                   </p>
                   
                   <div className="relative group/file mt-1">
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, isEditingLogo ? 'logo' : 'cover')}
                        disabled={isUploading}
                      />
                      <label 
                        htmlFor="file-upload"
                        className={cn(
                          "w-full py-8 rounded-[2rem] border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/10 transition-all",
                          isUploading && "opacity-50 cursor-not-allowed"
                        )}
                      >
                         {isUploading ? (
                           <Loader2 className="h-10 w-10 animate-spin text-primary" />
                         ) : (
                           <ImagePlus className="h-10 w-10 text-primary" />
                         )}
                         <div className="text-center">
                            <span className="text-xs font-black uppercase tracking-widest text-primary block">Tirar Foto / Galeria</span>
                            <span className="text-[9px] text-muted-foreground font-bold mt-1 block">PNG, JPG ou WEBP até 5MB</span>
                         </div>
                      </label>
                   </div>
                </div>
              </div>

              <button 
                onClick={() => {
                   setIsEditingLogo(false);
                   setIsEditingCover(false);
                   toast.success("Foto processada! Publique seu perfil para confirmar.");
                }}
                disabled={isUploading || (!logoUrl && isEditingLogo) || (!coverUrl && isEditingCover)}
                className="w-full py-4.5 rounded-2xl gradient-primary text-primary-foreground font-black uppercase tracking-widest italic shadow-xl shadow-primary/20 disabled:opacity-50 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
              >
                {isUploading ? "Enviando arquivo..." : "Fechar e Salvar"}
              </button>
           </div>
        </div>,
        document.body
      )}

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 flex justify-center opacity-40 select-none pointer-events-none">
        <span className="text-[10px] font-black tracking-[0.5em] text-muted-foreground uppercase">
          BONASOFT
        </span>
      </div>
    </BusinessLayout>
  );
}
