import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { validateInvitation, acceptInvitation } from "@/services/users";
import { Package, User, Phone, FileText, Lock, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InvitationRow } from "@/services/users";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    validateInvitation(token)
      .then(setInvitation)
      .catch((e) => setError(e.message))
      .finally(() => setValidating(false));
  }, [token]);

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    company: "Lojista",
    driver: "Entregador",
    customer: "Cliente",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    if (password !== confirmPassword) {
      toast({ title: "Senhas não coincidem", description: "Certifique-se de que as senhas sejam iguais.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvitation(token, {
        email,
        password,
        fullName,
        phone,
        document,
      });
      toast({ title: "Conta criada!", description: "Bem-vindo ao É Pra Já!" });
      
      const redirectUrl = invitation.role === "company" 
        ? "https://lojista.eprajadelivery.com/login" 
        : "https://entregador.eprajadelivery.com/login";

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 2000);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground mb-2">Convite inválido</h1>
          <p className="text-sm text-muted-foreground">{error || "Este convite não existe ou já expirou."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Complete seu cadastro</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Você foi convidado para se tornar um <strong>{roleLabels[invitation.role] || invitation.role} Parceiro</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 shadow-card space-y-4 border border-border/50">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">E-mail de Acesso</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-all font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: José da Silva"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-all font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-all font-bold"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">CPF/CNPJ</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder="000.000..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-all font-bold"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Criar Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 dígitos"
                minLength={6}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-all font-bold"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Repetir Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua senha"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-all font-bold"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Criando Conta..." : "Finalizar Cadastro e Entrar"}
          </button>
          
          <p className="text-[10px] text-center text-muted-foreground mt-4 font-medium">
            Ao se cadastrar, você concorda com nossos <span className="text-primary font-black cursor-pointer hover:underline">Termos de Uso</span>.
          </p>
        </form>
      </div>
    </div>
  );
}
