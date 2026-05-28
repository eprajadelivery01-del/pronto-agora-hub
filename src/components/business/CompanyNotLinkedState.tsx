import { AlertTriangle, Copy, LogOut, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface CompanyNotLinkedStateProps {
  userId?: string;
}

/**
 * Estado mostrado quando o usuário logado no painel lojista NÃO tem
 * uma empresa vinculada em public.companies.user_id.
 *
 * Em vez de deixar a UI travada com skeletons eternos ou botões "disabled"
 * silenciosos, mostramos o motivo e ações claras.
 */
export function CompanyNotLinkedState({ userId }: CompanyNotLinkedStateProps) {
  const { signOut } = useAuth();

  const copyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      toast.success("ID copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-lg w-full bg-card border border-border rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <h2 className="text-2xl font-black text-foreground">
            Empresa não vinculada
          </h2>
        </div>

        <p className="text-muted-foreground mb-4">
          Sua conta de lojista ainda não está vinculada a uma empresa no sistema.
          Por isso os botões de novo pedido / novo item ficam desativados e
          algumas abas não carregam.
        </p>

        <p className="text-sm text-muted-foreground mb-6">
          Envie o ID abaixo para o suporte para que façam o vínculo da sua conta
          com a empresa correta.
        </p>

        {userId && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-3 mb-6">
            <code className="flex-1 text-xs break-all text-foreground">
              {userId}
            </code>
            <button
              onClick={copyId}
              className="p-2 rounded-lg hover:bg-muted transition"
              aria-label="Copiar ID"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:opacity-90 transition"
          >
            <LifeBuoy className="w-4 h-4" />
            Falar com suporte
          </a>
          <button
            onClick={() => signOut()}
            className="flex-1 h-12 rounded-2xl border border-border font-bold flex items-center justify-center gap-2 hover:bg-muted transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
