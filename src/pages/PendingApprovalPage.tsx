import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock, Phone, ShieldCheck, LogOut, MessageCircle } from "lucide-react";

export default function PendingApprovalPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

      <div className="w-full max-w-md text-center space-y-8 animate-in fade-in zoom-in duration-500">
        {/* Header Icons */}
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center relative z-10">
            <Clock className="h-12 w-12 text-primary animate-pulse" />
          </div>
          <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-warning flex items-center justify-center shadow-lg z-20">
            <ShieldCheck className="h-6 w-6 text-warning-foreground" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
            Boas-vindas ao É Pra Já!
          </h1>
          <p className="text-muted-foreground font-medium">
            Olá, <span className="text-foreground font-bold">{profile?.full_name || "Parceiro"}</span>. Ficamos felizes com seu interesse!
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-start gap-4 text-left">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-1">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Análise de Cadastro</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu cadastro está sendo analisado pela nossa equipe administrativa.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 text-left">
            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center shrink-0 mt-1">
              <Phone className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Entraremos em contato</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                O administrador entrará em contato via WhatsApp no número <span className="font-bold text-foreground">{profile?.phone || "cadastrado"}</span> para ativar sua conta.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info and logout */}
        <div className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground italic px-6">
            "Trabalhamos para garantir a melhor experiência para lojistas e entregadores da nossa rede."
          </p>
          
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              onClick={signOut}
              className="rounded-xl h-12 gap-2 font-semibold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sair / Entrar com outra conta
            </Button>
            
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              BUILD: V34-PENDING-FLOW
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
