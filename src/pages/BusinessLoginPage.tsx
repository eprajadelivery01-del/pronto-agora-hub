import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Mail, Lock, Eye, EyeOff, Loader2, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function BusinessLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, userStatus, hasRole } = useAuth();

  useEffect(() => {
    if (user) {
      if (userStatus === "pending") {
        navigate("/pending-approval", { replace: true });
      } else if (hasRole("company")) {
        navigate("/business", { replace: true });
      } else if (hasRole("admin")) {
        navigate("/admin", { replace: true });
      }
    }
  }, [user, userStatus, hasRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Erro ao entrar: " + error.message);
        await supabase.rpc("log_failed_login", { p_email: email, p_app_name: "Painel Lojista" } as any).catch(() => {});
      } else {
        toast.success("Bem-vindo ao Portal Lojista!");
      }
    } catch (err: any) {
      toast.error("Ocorreu um erro inesperado.");
      await supabase.rpc("log_failed_login", { p_email: email, p_app_name: "Painel Lojista" } as any).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
         <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/30 rounded-full blur-[120px]" />
         <div className="absolute top-[40%] -right-[15%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-[2rem] bg-card border border-border shadow-2xl flex items-center justify-center mb-6 overflow-hidden">
            <img src="/logo.png" alt="É Pra Já" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display text-4xl font-black text-foreground tracking-tighter mb-2">
            Central do Lojista
          </h1>
          <p className="text-muted-foreground font-medium max-w-xs uppercase text-[10px] tracking-[0.3em] bg-muted px-4 py-1.5 rounded-full">
            Painel de Gestão Comercial
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 mb-2">
            <Building2 className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
               <p className="text-xs font-bold text-primary uppercase tracking-widest">Portal do Parceiro</p>
               <p className="text-sm text-muted-foreground truncate">Gestão operacional em tempo real</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block ml-1">E-mail Corporativo</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail de acesso"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block ml-1">Senha Segura</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border border-border bg-background font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl gradient-primary text-primary-foreground text-lg font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <span>Entrar no Painel</span>
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-muted-foreground font-medium py-2 uppercase tracking-widest">
            PROBLEMAS COM O ACESSO? CONTATE O SUPORTE NEXUSPRO
          </p>
        </div>

        <div className="text-center">
            <button 
              onClick={() => navigate("/login")}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Sou Administrador do Sistema
            </button>
        </div>
      </div>
    </div>
  );
}
