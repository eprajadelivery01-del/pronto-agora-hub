// @ts-nocheck
import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Store, Camera, ImagePlus, Loader2, Save, User, MapPin, Phone, 
  Smartphone, Eye, Layers, Info, CheckCircle2, Pencil, X, Link as LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Edit states for overlays
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchCompanyData();
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
        description: "Não esqueça de clicar em 'Publicar Perfil' para salvar permanentemente."
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error("Falha ao enviar imagem do dispositivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!companyId) return;
    setSaving(true);

    try {
      const { error } = await (supabase as any)
        .from("companies")
        .update({
          name: storeName,
          phone,
          address,
          description,
          logo_url: logoUrl,
          cover_url: coverUrl,
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
                    className="px-6 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/30 transition-all shadow-2xl"
                  >
                    <Pencil className="h-4 w-4" /> Alterar Banner
                  </button>
               </div>

               {/* Overlapping Avatar (Logo) */}
               <div className="absolute -bottom-16 left-8 group/avatar">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-white p-2 shadow-2xl border-4 border-card relative">
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

                  </div>
                  <div className="flex gap-3">
                     <button className="px-6 py-3 rounded-2xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-all">
                        Ver Página Pública
                     </button>
                     <button 
                        onClick={() => handleSave()}
                        className="px-8 py-3 rounded-2xl bg-foreground text-background font-black text-sm uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl shadow-foreground/10"
                     >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar Perfil"}
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
                 <div className="w-full h-full bg-background rounded-[2.2rem] overflow-hidden flex flex-col relative">
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
      {(isEditingLogo || isEditingCover) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl space-y-6 an              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                       <Camera className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-black text-foreground">
                       {isEditingLogo ? "Alterar Logo" : "Alterar Banner"}
                    </h3>
                 </div>
                 <button onClick={() => { setIsEditingLogo(false); setIsEditingCover(false); }} className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <X className="h-6 w-6" />
                 </button>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                   <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                      Sua imagem será armazenada com segurança. O tamanho ideal é 1200x400 para banners e 400x400 para logos.
                   </p>
                   
                   <div className="relative group/file">
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
                          "w-full py-12 rounded-[2rem] border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-primary/10 transition-all",
                          isUploading && "opacity-50 cursor-not-allowed"
                        )}
                      >
                         {isUploading ? (
                           <Loader2 className="h-10 w-10 animate-spin text-primary" />
                         ) : (
                           <ImagePlus className="h-10 w-10 text-primary" />
                         )}
                         <div className="text-center">
                            <span className="text-sm font-black uppercase tracking-widest text-primary block">Selecionar do Dispositivo</span>
                            <span className="text-[10px] text-muted-foreground font-bold mt-1 block">PNG, JPG ou WEBP até 5MB</span>
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
                className="w-full py-5 rounded-2xl gradient-primary text-primary-foreground font-black uppercase tracking-widest italic shadow-xl shadow-primary/20 disabled:opacity-50 hover:scale-[1.01] active:scale-95 transition-all"
              >
                {isUploading ? "Enviando arquivo..." : "Fechar e Salvar"}
              </button>
           </div>
        </div>
      )}

    </BusinessLayout>
  );
}
