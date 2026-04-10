import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Store, Camera, ImagePlus, Loader2, Save, User, MapPin, Phone
} from "lucide-react";

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
        setLogoUrl(company.logo_url || "");
        // cover_url might not exist in schema yet, store in logo_url as JSON or separate
        // For now, we'll use a convention: if logo_url is JSON, parse it
        try {
          const parsed = JSON.parse(company.logo_url || "");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setLogoUrl(parsed.logo || "");
            setCoverUrl(parsed.cover || "");
          }
        } catch {
          // logo_url is a plain string
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
      // Package logo + cover as JSON so both are stored
      const logoPayload = JSON.stringify({ logo: logoUrl, cover: coverUrl });

      const { error } = await (supabase as any)
        .from("companies")
        .update({
          name: storeName,
          phone,
          address,
          logo_url: logoPayload,
        })
        .eq("id", companyId);

      if (error) throw error;
      toast.success("Identidade visual atualizada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BusinessLayout title="Perfil da Loja">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Perfil & Identidade Visual">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Cover Photo Preview */}
        <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-border bg-muted aspect-[3/1]">
          {coverUrl ? (
            <img src={coverUrl} alt="Capa da Loja" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
              <Camera className="h-12 w-12 mb-2" />
              <span className="text-sm font-bold">Imagem de Capa</span>
            </div>
          )}

          {/* Store Logo Overlay */}
          <div className="absolute -bottom-10 left-8 w-24 h-24 rounded-3xl border-4 border-card bg-card shadow-xl overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Store className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </div>
        </div>

        {/* Spacer for overlapping logo */}
        <div className="h-8" />

        {/* Form */}
        <form onSubmit={handleSave} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-card space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-black text-foreground">Identidade da Loja</h2>
          </div>

          {/* Store Name */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Nome da Loja no Marketplace *
            </label>
            <div className="relative">
              <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Nome visível para os clientes"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Telefone / WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(65) 99999-9999"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-base"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Endereço da Loja
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-base"
              />
            </div>
          </div>

          {/* Visual Identity Images */}
          <div className="border-t border-border pt-8 space-y-6">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Imagens da Loja
            </h3>

            {/* Logo URL */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                Foto de Perfil / Logo da Loja
              </label>
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-2xl border border-border overflow-hidden bg-muted shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImagePlus className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="Cole a URL do logo/foto de perfil aqui..."
                  className="flex-1 px-4 py-3.5 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-sm"
                />
              </div>
            </div>

            {/* Cover URL */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                Imagem de Capa (Banner)
              </label>
              <div className="flex gap-4 items-start">
                <div className="w-28 h-16 rounded-xl border border-border overflow-hidden bg-muted shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <input
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="Cole a URL do banner/capa aqui..."
                  className="flex-1 px-4 py-3.5 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Recomendação: 1200×400 pixels. Essa imagem será exibida no topo da sua página no marketplace.</p>
            </div>
          </div>

          {/* Save */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving || !storeName}
              className="w-full py-5 rounded-2xl gradient-primary text-primary-foreground text-lg font-black shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
              {saving ? "Salvando..." : "Salvar Identidade Visual"}
            </button>
          </div>
        </form>

        {/* Info card */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex items-start gap-4">
          <User className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">Dono da conta</p>
            <p className="text-sm text-muted-foreground">{profile?.full_name || "—"} • {user?.email || "—"}</p>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
}
