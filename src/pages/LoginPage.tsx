import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, hasRole, roles, userStatus } = useAuth();

  useEffect(() => {
    if (!user || authLoading) return;

    // Aguarda as roles serem carregadas antes de decidir o redirecionamento.
    // Sem isso, o toast destrutivo dispara durante o intervalo entre o login
    // e o fetch assíncrono dos perfis/roles, causando o falso "Identificação Necessária".
    if (roles.length === 0) {
      // Fallback: se após 4s ainda não houver roles, aí sim mostramos o aviso.
      const fallback = setTimeout(() => {
        toast({
          title: "Identificação Necessária",
          description: "Este portal é exclusivo para Lojistas parceiros.",
          variant: "destructive",
        });
      }, 4000);
      return () => clearTimeout(fallback);
    }

    if (userStatus === "pending") {
      navigate("/pending-approval", { replace: true });
    } else if (hasRole("company")) {
      navigate("/business", { replace: true });
    } else if (hasRole("admin")) {
      toast({
        title: "Portal de Lojistas",
        description: "Você está logado como Administrador. Use o painel administrativo para gestão global.",
        variant: "default",
      });
    } else {
      toast({
        title: "Identificação Necessária",
        description: "Este portal é exclusivo para Lojistas parceiros.",
        variant: "destructive",
      });
    }
  }, [user, authLoading, roles, userStatus, hasRole, navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      }
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-lg p-2">
            <img src="/logo.png" alt="É Pra Já" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground tracking-tight">É Pra Já</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Delivery • Painel de Gestão</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-2xl p-6 shadow-card space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? "Entrando..." : "Entrar"}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest font-bold"
          >
            Problemas ao entrar? Limpar Sessão
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso exclusivo por convite do administrador
        </p>
      </div>
    </div>
  );
}
