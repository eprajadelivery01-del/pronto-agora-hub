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
import { maskPhone, maskTime } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { optimizeStorageImage } from "@/lib/imageOptimization";
import { isStoreOpenBySchedule, WEEKDAY_FULL_NAMES } from "@/lib/storeHours";

const DEFAULT_WORKING_DAYS = [
  { day: 'Seg', active: true, start: '08:00', end: '18:00', periods: [{ start: '08:00', end: '18:00' }] },
  { day: 'Ter', active: true, start: '08:00', end: '18:00', periods: [{ start: '08:00', end: '18:00' }] },
  { day: 'Qua', active: true, start: '08:00', end: '18:00', periods: [{ start: '08:00', end: '18:00' }] },
  { day: 'Qui', active: true, start: '08:00', end: '18:00', periods: [{ start: '08:00', end: '18:00' }] },
  { day: 'Sex', active: true, start: '08:00', end: '18:00', periods: [{ start: '08:00', end: '18:00' }] },
  { day: 'Sab', active: true, start: '08:00', end: '12:00', periods: [{ start: '08:00', end: '12:00' }] },
  { day: 'Dom', active: false, start: '00:00', end: '00:00', periods: [{ start: '00:00', end: '00:00' }] },
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

  if (!rawDays) {
    return DEFAULT_WORKING_DAYS.map((day) => ({
      ...day,
      periods: day.periods.map((p) => ({ ...p })),
    }));
  }

  return DEFAULT_WORKING_DAYS.map((defaultDay, index) => {
    const day =
      rawDays.find(
        (d: any) =>
          String(d.day || d.weekday || d.name)
            .trim()
            .toLowerCase()
            .startsWith(defaultDay.day.toLowerCase())
      ) ||
      rawDays[index] ||
      {};

    let periods: { start: string; end: string }[] = [];
    if (Array.isArray(day.periods) && day.periods.length > 0) {
      periods = day.periods
        .map((p: any) => ({
          start: typeof p.start === "string" && p.start.trim() ? p.start.trim() : (p.open || "08:00"),
          end: typeof p.end === "string" && p.end.trim() ? p.end.trim() : (p.close || "18:00"),
        }))
        .filter((p: any) => Boolean(p.start && p.end));
    }

    if (periods.length === 0) {
      const s = typeof day.start === "string" && day.start.trim() ? day.start.trim() : defaultDay.start;
      const e = typeof day.end === "string" && day.end.trim() ? day.end.trim() : defaultDay.end;
      periods = [{ start: s, end: e }];
    }

    return {
      day: String(day.day || defaultDay.day),
      active: typeof day.active === "boolean" ? day.active : defaultDay.active,
      start: periods[0]?.start || defaultDay.start,
      end: periods[periods.length - 1]?.end || defaultDay.end,
      periods,
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
  const [adminDeliveryFee, setAdminDeliveryFee] = useState<number | null>(null);
  const [prepTimeMin, setPrepTimeMin] = useState("25");
  const [prepTimeMax, setPrepTimeMax] = useState("45");
  const [isOpen, setIsOpen] = useState(true);
  const [showInMarketplace, setShowInMarketplace] = useState(false);
  const [businessHours, setBusinessHours] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState(() => DEFAULT_WORKING_DAYS.map((day) => ({ ...day })));

  // Delivery Regions
  const [allRegions, setAllRegions] = useState<any[]>([]);
  const [deliveryRegionsPricing, setDeliveryRegionsPricing] = useState<any[]>([]);

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

    // Custom event listener to keep in sync with BusinessLayout (Header) toggle
    const handleStatusSync = (e: any) => {
      setIsOpen(e.detail.isOpen);
    };
    window.addEventListener('store-status-changed', handleStatusSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('store-status-changed', handleStatusSync);
    };
  }, [user?.id]);

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
        setAdminDeliveryFee(company.admin_delivery_fee || null);
        const minVal = company.prep_time_min != null ? company.prep_time_min : (company.prep_time != null ? company.prep_time : 25);
        const maxVal = company.prep_time_max != null ? company.prep_time_max : (company.prep_time != null ? company.prep_time : 45);
        setPrepTimeMin(minVal.toString());
        setPrepTimeMax(maxVal.toString());
        setBusinessHours(company.business_hours || "");
        setGallery(normalizeGallery(company.gallery));
        setWorkingDays(normalizeWorkingDays(company.business_hours));
        
        let pricing = [];
        try {
          if (typeof company.delivery_regions_pricing === 'string') {
            pricing = JSON.parse(company.delivery_regions_pricing);
          } else if (Array.isArray(company.delivery_regions_pricing)) {
            pricing = company.delivery_regions_pricing;
          }
        } catch(e) {}
        setDeliveryRegionsPricing(pricing || []);
      }

      // Fetch regions
      const { data: regions } = await supabase.from('regions').select('*').order('name');
      if (regions) {
        setAllRegions(regions);
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
    const newActive = !showInMarketplace;
    setShowInMarketplace(newActive);
    
    try {
      const { error } = await supabase
        .from("companies")
        .update({ 
          show_in_marketplace: newActive,
          active: newActive,
          is_active: newActive
        })
        .eq("id", companyId);
      if (error) throw error;
      toast.success(
        newActive
          ? "✅ Loja visível no marketplace!"
          : "⏸️ Loja oculta no marketplace."
      );
    } catch {
      setShowInMarketplace(!newActive);
      toast.error("Erro ao atualizar visibilidade da loja");
    }
  };

  const updateWorkingDay = (index: number, field: string, value: any) => {
    const newDays = [...workingDays];
    newDays[index] = { ...newDays[index], [field]: value };
    setWorkingDays(newDays);
  };

  const addPeriod = (dayIdx: number) => {
    const newDays = [...workingDays];
    const day = newDays[dayIdx];
    const currentPeriods = (day.periods && day.periods.length > 0
      ? day.periods
      : [{ start: day.start || "08:00", end: day.end || "18:00" }]
    ).map((p: any) => ({ ...p }));

    if (currentPeriods.length >= 4) {
      toast.info("Máximo de 4 turnos por dia.");
      return;
    }

    const last = currentPeriods[currentPeriods.length - 1];
    const nextStart = last ? "18:00" : "08:00";
    const nextEnd = last ? "23:00" : "18:00";
    currentPeriods.push({ start: nextStart, end: nextEnd });

    newDays[dayIdx] = {
      ...day,
      periods: currentPeriods,
      start: currentPeriods[0].start,
      end: currentPeriods[currentPeriods.length - 1].end,
    };
    setWorkingDays(newDays);
  };

  const removePeriod = (dayIdx: number, pIdx: number) => {
    const newDays = [...workingDays];
    const day = newDays[dayIdx];
    const currentPeriods = (day.periods && day.periods.length > 0
      ? day.periods
      : [{ start: day.start || "08:00", end: day.end || "18:00" }]
    ).map((p: any) => ({ ...p }));

    if (currentPeriods.length <= 1) return;
    currentPeriods.splice(pIdx, 1);

    newDays[dayIdx] = {
      ...day,
      periods: currentPeriods,
      start: currentPeriods[0]?.start || "08:00",
      end: currentPeriods[currentPeriods.length - 1]?.end || "18:00",
    };
    setWorkingDays(newDays);
  };

  const updatePeriodTime = (dayIdx: number, pIdx: number, field: "start" | "end", val: string) => {
    const newDays = [...workingDays];
    const day = newDays[dayIdx];
    const currentPeriods = (day.periods && day.periods.length > 0
      ? day.periods
      : [{ start: day.start || "08:00", end: day.end || "18:00" }]
    ).map((p: any) => ({ ...p }));

    if (!currentPeriods[pIdx]) return;
    currentPeriods[pIdx][field] = val;

    newDays[dayIdx] = {
      ...day,
      periods: currentPeriods,
      start: currentPeriods[0]?.start || "08:00",
      end: currentPeriods[currentPeriods.length - 1]?.end || "18:00",
    };
    setWorkingDays(newDays);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!companyId) return;
    const minVal = parseInt(prepTimeMin, 10);
    const maxVal = parseInt(prepTimeMax, 10);

    if (isNaN(minVal) || isNaN(maxVal) || minVal <= 0 || maxVal <= 0) {
      toast.error("O tempo mínimo e máximo de entrega devem ser números inteiros maiores que zero.");
      return;
    }

    if (minVal > maxVal) {
      toast.error("O tempo mínimo não pode ser maior que o tempo máximo.");
      return;
    }

    if (maxVal > 300) {
      toast.error("O tempo máximo de entrega não pode ultrapassar 300 minutos (5 horas).");
      return;
    }

    setSaving(true);

    try {
      const sanitizedDays = (Array.isArray(workingDays) ? workingDays : []).map((d) => {
        const periods = (d.periods && d.periods.length > 0
          ? d.periods
          : [{ start: d.start || "08:00", end: d.end || "18:00" }]
        ).map((p: any) => ({
          start: typeof p.start === 'string' && p.start.trim() ? p.start.trim() : "08:00",
          end: typeof p.end === 'string' && p.end.trim() ? p.end.trim() : "18:00",
        }));
        return {
          day: d.day,
          active: Boolean(d.active),
          start: periods[0]?.start || "08:00",
          end: periods[periods.length - 1]?.end || "18:00",
          periods,
        };
      });
      const hoursJson = JSON.stringify(sanitizedDays);
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
          prep_time: minVal,
          prep_time_min: minVal,
          prep_time_max: maxVal,
          business_hours: hoursJson,
          gallery: gallery,
          delivery_regions_pricing: deliveryRegionsPricing,
          is_open: isOpen,
          show_in_marketplace: true,
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

  const handleToggleStoreStatus = async () => {
    const next = !isOpen;
    setIsOpen(next);
    window.dispatchEvent(new CustomEvent('store-status-changed', { detail: { isOpen: next } }));
    if (companyId) {
      try {
        const { error } = await (supabase as any)
          .from("companies")
          .update({ is_open: next })
          .eq("id", companyId);
        if (error) throw error;
        toast.success(next ? "Loja aberta no Marketplace!" : "Loja fechada no Marketplace!");
      } catch (err: any) {
        setIsOpen(!next);
        toast.error("Erro ao atualizar status: " + err.message);
      }
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
                 <img src={optimizeStorageImage(coverUrl, { width: 1200, quality: 75 })} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="Banner" />
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
                          <img src={optimizeStorageImage(logoUrl, { width: 320 })} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="Logo" />
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
                     <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className={cn("h-2.5 w-2.5 rounded-full", (isOpen && isStoreOpenBySchedule(workingDays)) ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        <span className={cn("text-[11px] font-black uppercase tracking-widest", (isOpen && isStoreOpenBySchedule(workingDays)) ? "text-green-600" : "text-red-600")}>
                           {(isOpen && isStoreOpenBySchedule(workingDays)) ? "Sua Loja está aberta" : (isOpen ? "Sua Loja está fora do horário" : "Sua Loja está fechada")}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleStoreStatus}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all active:scale-95 cursor-pointer",
                            isOpen
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                          )}
                        >
                          {isOpen ? "Fechar Loja Manualmente" : "Abrir Loja Manualmente"}
                        </button>
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
                  {/* Left Column - Basic Info */}
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
                              <option value="lanches">Lanches / Hamburgueria</option>
                              <option value="mercado">Mercado / Mercearia</option>
                              <option value="farmacia">Farmácia / Drogaria</option>
                              <option value="petiscaria">Petiscaria</option>
                              <option value="bebidas">Adega / Bebidas</option>
                              <option value="shopping">Shopping / Variedades</option>
                           </select>
                        </div>
                     </div>
                  </div>

                  {/* Right Column - Contact & Settings */}
                  <div className="space-y-6">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                         <Phone className="h-3 w-3" /> Contato e Configurações
                      </div>

                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">WhatsApp de Vendas</label>
                            <div className="relative">
                               <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                               <input
                                  value={phone}
                                  onChange={(e) => setPhone(maskPhone(e.target.value))}
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

                         {/* TEMPO DE PREPARO E ENVIO */}
                          <div className="space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50">
                             <div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground">
                                   <Clock3 className="h-3.5 w-3.5 text-primary" /> Tempo de Preparo e Envio
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                   Defina quanto tempo sua loja normalmente leva para preparar e enviar um pedido.
                                </p>
                             </div>

                             <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1.5">
                                   <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Tempo mínimo</label>
                                   <div className="relative">
                                      <input
                                         type="number"
                                         min={1}
                                         max={300}
                                         value={prepTimeMin}
                                         onChange={(e) => setPrepTimeMin(e.target.value)}
                                         className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-border bg-background outline-none font-black text-sm"
                                         placeholder="25"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">min</span>
                                   </div>
                                </div>

                                <div className="space-y-1.5">
                                   <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Tempo máximo</label>
                                   <div className="relative">
                                      <input
                                         type="number"
                                         min={1}
                                         max={300}
                                         value={prepTimeMax}
                                         onChange={(e) => setPrepTimeMax(e.target.value)}
                                         className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-border bg-background outline-none font-black text-sm"
                                         placeholder="45"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">min</span>
                                   </div>
                                </div>
                             </div>

                             <div className="flex items-center justify-between rounded-xl bg-background/80 border border-border/40 px-3 py-2 text-xs">
                                <span className="text-muted-foreground font-medium">Os clientes verão:</span>
                                <span className="font-black text-primary">
                                   {(() => {
                                      const min = parseInt(prepTimeMin, 10);
                                      const max = parseInt(prepTimeMax, 10);
                                      if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0) return "25–45 min";
                                      if (min === max) return `${min} min`;
                                      return `${min}–${max} min`;
                                   })()}
                                </span>
                             </div>
                          </div>

                         {/* Toggle Unificado: Loja Ativa */}
                         <button
                            type="button"
                            onClick={toggleStoreActive}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group mt-2",
                              showInMarketplace
                                ? "bg-emerald-50 border-emerald-400 shadow-md shadow-emerald-100"
                                : "bg-muted/40 border-border/60 hover:border-border"
                            )}
                         >
                            <div className="text-left">
                               <p className={cn(
                                 "text-[11px] font-black uppercase tracking-widest",
                                 showInMarketplace ? "text-emerald-700" : "text-muted-foreground"
                               )}>
                                 {showInMarketplace ? "✅ Loja Ativa" : "⏸️ Loja Inativa"}
                               </p>
                               <p className={cn(
                                 "text-[10px] font-medium mt-0.5",
                                 showInMarketplace ? "text-emerald-600" : "text-muted-foreground"
                               )}>
                                 {showInMarketplace
                                   ? "Visível no marketplace"
                                   : "Oculta no marketplace"}
                               </p>
                            </div>
                            <div className={cn(
                              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
                              showInMarketplace ? "bg-emerald-500" : "bg-muted-foreground/30"
                            )}>
                               <span className={cn(
                                 "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                 showInMarketplace ? "translate-x-6" : "translate-x-1"
                               )} />
                            </div>
                         </button>
                      </div>
                  </div>
               </div>

               {/* FULL WIDTH SECTIONS BELOW */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-border/50">
                   {/* SCHEDULE SECTION */}
                   <div className="space-y-4 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                           <Clock3 className="h-3.5 w-3.5 text-primary" /> Horário de Funcionamento
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const firstActive = workingDays.find((d) => d.active);
                            if (firstActive) {
                              const sourcePeriods = (firstActive.periods && firstActive.periods.length > 0
                                ? firstActive.periods
                                : [{ start: firstActive.start || "08:00", end: firstActive.end || "18:00" }]
                              ).map((p) => ({ ...p }));

                              const newDays = (Array.isArray(workingDays) ? workingDays : []).map((d) => ({
                                ...d,
                                active: true,
                                start: sourcePeriods[0].start,
                                end: sourcePeriods[sourcePeriods.length - 1].end,
                                periods: sourcePeriods.map((p) => ({ ...p })),
                              }));
                              setWorkingDays(newDays);
                              toast.success("Horários aplicados a todos os dias!");
                            }
                          }}
                          className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Repetir Horários (Aplicar a todos)
                        </button>
                      </div>

                      <div className="space-y-2.5 p-3 sm:p-4 bg-muted/20 rounded-2xl border border-border/50">
                        {(Array.isArray(workingDays) ? workingDays : []).map((wd, idx) => {
                          const periods = wd.periods && wd.periods.length > 0
                            ? wd.periods
                            : [{ start: wd.start || "08:00", end: wd.end || "18:00" }];
                          const dayFullName = WEEKDAY_FULL_NAMES[wd.day] || wd.day;

                          return (
                            <div 
                              key={wd.day} 
                              className={cn(
                                "p-3 rounded-xl border transition-all",
                                wd.active 
                                  ? "bg-card border-border/80 shadow-xs" 
                                  : "bg-muted/40 border-border/30 opacity-70"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <input 
                                    type="checkbox" 
                                    id={`day-toggle-${wd.day}`}
                                    checked={wd.active} 
                                    onChange={(e) => updateWorkingDay(idx, 'active', e.target.checked)}
                                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                  />
                                  <label 
                                    htmlFor={`day-toggle-${wd.day}`} 
                                    className={cn("text-xs font-black cursor-pointer select-none", wd.active ? "text-foreground" : "text-muted-foreground")}
                                  >
                                    {dayFullName}
                                  </label>
                                </div>

                                {!wd.active ? (
                                  <span className="text-[10px] font-bold text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    Fechado
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    Aberto
                                  </span>
                                )}
                              </div>

                              {wd.active && (
                                <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-2">
                                  {periods.map((p, pIdx) => (
                                    <div key={pIdx} className="flex items-center justify-between gap-2 bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/30">
                                      <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                                        {periods.length > 1 ? `Turno ${pIdx + 1}` : 'Horário'}:
                                      </span>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <input 
                                          type="text" 
                                          value={p.start} 
                                          onChange={(e) => updatePeriodTime(idx, pIdx, 'start', maskTime(e.target.value))}
                                          className="w-14 py-1 text-center text-xs font-black bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all tracking-wider shadow-2xs"
                                          placeholder="08:00"
                                          maxLength={5}
                                        />
                                        <span className="text-[11px] font-bold text-muted-foreground/60 px-0.5">às</span>
                                        <input 
                                          type="text" 
                                          value={p.end} 
                                          onChange={(e) => updatePeriodTime(idx, pIdx, 'end', maskTime(e.target.value))}
                                          className="w-14 py-1 text-center text-xs font-black bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all tracking-wider shadow-2xs"
                                          placeholder="18:00"
                                          maxLength={5}
                                        />

                                        {periods.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removePeriod(idx, pIdx)}
                                            className="p-1 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5 cursor-pointer"
                                            title="Remover este turno"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}

                                  {periods.length < 4 && (
                                    <button
                                      type="button"
                                      onClick={() => addPeriod(idx)}
                                      className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 pt-0.5 pl-1 cursor-pointer transition-colors"
                                    >
                                      + Adicionar turno (intervalo)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                   </div>

                   {/* DELIVERY REGIONS PRICING */}
                   <div className="space-y-4 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                         <MapPin className="h-3 w-3" /> Taxas de Entrega por Região
                      </div>
                      <p className="text-xs text-muted-foreground ml-1">
                         Defina o valor que o cliente vai pagar pela entrega em cada região.
                      </p>

                      {allRegions.length === 0 && (
                        <div className="py-8 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                          <MapPin className="h-6 w-6" />
                          <p className="text-xs font-bold uppercase tracking-widest">Nenhuma região cadastrada</p>
                          <p className="text-[10px]">O Admin deve criar as regiões primeiro.</p>
                        </div>
                      )}

                      <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                        {allRegions.map((region) => {
                          const pricing = deliveryRegionsPricing.find(p => p.region_id === region.id);
                          const customerPrice = pricing ? pricing.customer_price : "";

                          return (
                            <div key={region.id} className="flex items-center gap-0 bg-card hover:bg-muted/30 transition-colors">
                              <div
                                className="w-1 self-stretch shrink-0 rounded-l-none"
                                style={{ backgroundColor: region.color || '#6366f1' }}
                              />
                              <div className="flex-1 min-w-0 px-4 py-3">
                                <p className="font-black text-sm leading-tight" style={{ color: region.color || 'inherit' }}>
                                  {region.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Base Admin: <span className="font-bold text-foreground">R$ {Number(adminDeliveryFee ?? region.price ?? 0).toFixed(2).replace('.', ',')}</span>
                                </p>
                              </div>
                              <div className="shrink-0 px-4 py-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1.5 text-right">Cobrar do cliente</p>
                                <div className="relative w-28">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">R$</span>
                                  <input
                                    type="text"
                                    value={customerPrice}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.,]/g, "");
                                      setDeliveryRegionsPricing(prev => {
                                        const exists = prev.find(p => p.region_id === region.id);
                                        if (exists) {
                                          return prev.map(p => p.region_id === region.id ? { ...p, customer_price: val } : p);
                                        }
                                        return [...prev, { region_id: region.id, customer_price: val }];
                                      });
                                    }}
                                    placeholder="0,00"
                                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background outline-none font-black text-primary text-right focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
               </div>

               {/* GALLERY SECTION */}
               <div className="pt-8 border-t border-border/50 mt-8 space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        <ImagePlus className="h-3 w-3" /> Galeria de Fotos
                     </div>
                     <label className="cursor-pointer px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                        Adicionar
                        <input type="file" multiple accept="image/*"  className="hidden" onChange={handleGalleryUpload} />
                     </label>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                     {(Array.isArray(gallery) ? gallery : []).map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group/item border border-border/50">
                           <img src={optimizeStorageImage(url, { width: 300 })} alt="Galeria" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                           <button 
                             onClick={() => removeGalleryItem(url)}
                             className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover/item:opacity-100 transition-all shadow-lg"
                           >
                             <X className="h-4 w-4" />
                           </button>
                        </div>
                     ))}
                     {gallery.length === 0 && (
                        <div className="col-span-full py-16 border-2 border-dashed border-border rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground/40 bg-muted/20">
                           <ImagePlus className="h-10 w-10 mb-3" />
                           <p className="text-[11px] font-black uppercase tracking-widest">Sua galeria está vazia</p>
                           <p className="text-[10px] mt-1 text-muted-foreground">Adicione fotos dos seus melhores pratos!</p>
                         </div>
                     )}
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
                       {coverUrl && <img src={optimizeStorageImage(coverUrl, { width: 520 })} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                       <div className="absolute inset-0 bg-black/20" />
                       <div className="absolute -bottom-3 left-3 w-10 h-10 rounded-xl bg-white p-1 shadow-lg">
                          <div className="w-full h-full rounded-lg bg-muted overflow-hidden">
                             {logoUrl && <img src={optimizeStorageImage(logoUrl, { width: 120 })} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
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
