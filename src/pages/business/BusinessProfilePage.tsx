// @ts-nocheck
import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Store, Camera, ImagePlus, Loader2, Save, User, MapPin, Phone, 
  Smartphone, Eye, Layers, Info, CheckCircle2
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
        
        // Handle migration from JSON hack to separate columns
        if (company.logo_url?.startsWith("{")) {
          try {
            const parsed = JSON.parse(company.logo_url);
            setLogoUrl(parsed.logo || "");
            setCoverUrl(company.cover_url || parsed.cover || "");
          } catch {
            setLogoUrl(company.logo_url || "");
            setCoverUrl(company.cover_url || "");
          }
        } else {
          setLogoUrl(company.logo_url || "");
          setCoverUrl(company.cover_url || "");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.success("Sua loja está pronta para o marketplace!", {
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
      <BusinessLayout title="Perfil da Loja">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Identidade Visual">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Left Column: Form */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-card border border-border rounded-[2.5rem] shadow-card overflow-hidden">
            <div className="p-8 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-foreground">Configurações da Loja</h2>
                  <p className="text-xs text-muted-foreground font-medium">Personalize como os clientes verão sua marca.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-10">
              {/* Visual Identity Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary/70">
                  <Layers className="h-4 w-4" /> 
                  <span>Identidade Visual</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Logo Input */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Logo / Foto de Perfil</label>
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-muted border border-border shrink-0 overflow-hidden flex items-center justify-center">
                        {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground/30" />}
                      </div>
                      <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="URL da imagem..."
                        className="flex-1 px-4 py-3 rounded-xl border border-border bg-background/50 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Cover Input */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Capa (Banner)</label>
                    <div className="flex gap-4">
                      <div className="w-24 h-16 rounded-xl bg-muted border border-border shrink-0 overflow-hidden flex items-center justify-center">
                        {coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground/30" />}
                      </div>
                      <input
                        value={coverUrl}
                        onChange={(e) => setCoverUrl(e.target.value)}
                        placeholder="URL do banner..."
                        className="flex-1 px-4 py-3 rounded-xl border border-border bg-background/50 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Basic Info Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary/70">
                  <Info className="h-4 w-4" /> 
                  <span>Informações Básicas</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Nome no Marketplace</label>
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                      <input
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="Ex: Pizzaria Fornalha"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Telefone Comercial</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(65) 99999-9999"
                          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Cidade / Bairro</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Manaus - Centro"
                          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Descrição (Bio)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Fale um pouco sobre sua loja para seus clientes..."
                      rows={3}
                      className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary resize-none transition-all"
                    />
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={saving || !storeName}
                className="w-full py-5 rounded-[2rem] gradient-primary text-primary-foreground text-lg font-black shadow-primary/20 shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                {saving ? "Publicando..." : "Salvar Identidade"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Marketplace Preview */}
        <div className="xl:col-span-5 relative">
          <div className="sticky top-28 space-y-6">
            <div className="flex items-center gap-2 px-6">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="font-black text-foreground uppercase tracking-widest text-xs">Marketplace Live Preview</h3>
            </div>
            
            {/* Phone Frame */}
            <div className="w-full max-w-[320px] mx-auto aspect-[9/18.5] bg-foreground rounded-[3.5rem] p-3 shadow-2xl border-[8px] border-muted relative group">
              {/* Screen Content */}
              <div className="w-full h-full bg-background rounded-[2.5rem] overflow-hidden flex flex-col relative select-none">
                
                {/* Status Bar */}
                <div className="h-6 w-full flex justify-between items-center px-6 pt-2">
                  <span className="text-[8px] font-bold">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-foreground/20" />
                    <div className="w-2 h-2 rounded-full bg-foreground/20" />
                  </div>
                </div>

                {/* Cover in Preview */}
                <div className="h-32 bg-muted relative overflow-hidden shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <Smartphone className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Floating Logo */}
                  <div className="absolute -bottom-4 left-4 w-16 h-16 rounded-2xl bg-white p-1.5 shadow-xl border border-white">
                    <div className="w-full h-full rounded-xl bg-muted overflow-hidden flex items-center justify-center">
                      {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" /> : <Store className="h-6 w-6 text-muted-foreground/30" />}
                    </div>
                  </div>
                </div>

                <div className="mt-8 px-5 space-y-4">
                  <div>
                    <h4 className="text-xl font-black text-foreground leading-tight tracking-tight">
                      {storeName || "Nome da Loja"}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1">
                      📍 {address || "Sua Localização"} • ⭐ 5.0 (Novo)
                    </p>
                  </div>

                  <div className="bg-muted/30 rounded-2xl p-4">
                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3 italic">
                      {description || "Sua descrição aparecerá aqui para os clientes."}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Categorias Populares</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-10 bg-muted/40 rounded-xl" />
                      <div className="h-10 bg-muted/40 rounded-xl" />
                    </div>
                  </div>
                </div>

                {/* Fake action bar */}
                <div className="mt-auto p-4 border-t border-border">
                  <div className="w-full h-10 rounded-xl bg-primary flex items-center justify-center">
                    <span className="text-[10px] font-black text-white uppercase italic">Ver Cardápio Full</span>
                  </div>
                </div>
              </div>

              {/* Speaker notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-foreground rounded-b-2xl z-20" />
            </div>

            <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 max-w-[320px] mx-auto">
               <p className="text-xs font-bold text-primary mb-1">Dica Premium</p>
               <p className="text-[10px] text-muted-foreground leading-relaxed">
                 Use imagens de alta qualidade (16:9 para capa) para aumentar em até 40% a conversão de novos clientes.
               </p>
            </div>
          </div>
        </div>

      </div>
    </BusinessLayout>
  );
}
