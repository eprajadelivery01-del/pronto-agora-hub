import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Settings, Bell, Shield, Palette, Loader2, Save, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setDocument("");
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Configurações salvas!" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    const newPassword = prompt("Digite a nova senha (mínimo 8 caracteres):");
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Senha deve ter no mínimo 8 caracteres", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
    }
  };

  return (
    <AdminLayout title="Configurações" subtitle="Preferências do sistema">
      <div className="max-w-2xl space-y-6">
        {/* Profile settings */}
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Dados do Perfil</h3>
              <p className="text-xs text-muted-foreground">Informações pessoais do administrador</p>
            </div>
          </div>
          <div className="space-y-3">
            <FieldInput label="Nome completo" value={fullName} onChange={setFullName} placeholder="Seu nome" />
            <FieldInput label="Email" value={user?.email || ""} onChange={() => {}} placeholder="" disabled />
            <FieldInput label="Telefone" value={phone} onChange={setPhone} placeholder="(65) 99999-0000" />
            <FieldInput label="Documento (CPF)" value={document} onChange={setDocument} placeholder="000.000.000-00" />
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Salvo!" : "Salvar Alterações"}
          </button>
        </div>

        {/* Security */}
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Segurança</h3>
              <p className="text-xs text-muted-foreground">Gerenciar senha e autenticação</p>
            </div>
          </div>
          <button
            onClick={handlePasswordChange}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Alterar Senha
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

function FieldInput({ label, value, onChange, placeholder, disabled, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
