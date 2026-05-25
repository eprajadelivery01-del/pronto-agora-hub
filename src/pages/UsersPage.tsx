import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BikeIcon } from "@/components/icons/BikeIcon";
import { useDrivers } from "@/services/drivers";
import { useCompanies } from "@/services/companies";
import { useInvitations, useCreateInvitation, usePendingProfiles, useApproveUser, useRejectUser } from "@/services/users";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Building2, Plus, Star, Mail, Copy, Loader2, Check, Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Tab = "pending" | "drivers" | "companies" | "invitations";

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const { data: drivers, isLoading: loadingDrivers } = useDrivers();
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: invitations, isLoading: loadingInvites } = useInvitations();
  const { data: pendingProfiles, isLoading: loadingPending } = usePendingProfiles();

  const pendingCount = pendingProfiles?.length ?? 0;

  return (
    <AdminLayout title="Usuários" subtitle="Gestão de entregadores, empresas e convites">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit flex-wrap">
          {([
            { key: "pending" as const, icon: Clock, label: "Solicitações", badge: pendingCount },
            { key: "drivers" as const, icon: (props: any) => <BikeIcon {...props} />, label: "Entregadores" },
            { key: "companies" as const, icon: Building2, label: "Empresas" },
            { key: "invitations" as const, icon: Mail, label: "Convites" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
                tab === t.key ? "bg-card shadow-card text-foreground" : "text-muted-foreground"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <InviteDialog />
      </div>

      {tab === "pending" && (
        loadingPending ? <LoadingGrid /> : <PendingApprovals profiles={pendingProfiles ?? []} />
      )}

      {tab === "drivers" && (
        loadingDrivers ? <LoadingGrid /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(drivers ?? []).map((driver) => (
              <div key={driver.id} className="bg-card rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {driver.profiles?.avatar_url ? (
                        <img src={driver.profiles.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">
                          {(driver.profiles?.full_name || "?").split(" ").map(n => n[0]).join("")}
                        </span>
                      )}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${driver.is_online ? "bg-success" : "bg-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{driver.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{driver.profiles?.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{driver.vehicle_type || "moto"}</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Star className="h-3.5 w-3.5 text-warning fill-warning" /> {Number(driver.rating || 5).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
            {(drivers ?? []).length === 0 && <EmptyState text="Nenhum entregador cadastrado" />}
          </div>
        )
      )}

      {tab === "companies" && (
        loadingCompanies ? <LoadingGrid /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(companies ?? []).map((company) => (
              <div key={company.id} className="bg-card rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.phone || "—"}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{company.address || "—"}</p>
              </div>
            ))}
            {(companies ?? []).length === 0 && <EmptyState text="Nenhuma empresa cadastrada" />}
          </div>
        )
      )}

      {tab === "invitations" && (
        loadingInvites ? <LoadingGrid /> : (
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Email</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Role</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Status</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(invitations ?? []).map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="p-4 text-sm text-foreground">{inv.email}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{inv.role}</span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        inv.status === "pending" && "bg-warning/10 text-warning",
                        inv.status === "accepted" && "bg-success/10 text-success",
                        inv.status === "expired" && "bg-muted text-muted-foreground"
                      )}>{inv.status}</span>
                    </td>
                    <td className="p-4">
                      {inv.status === "pending" && <CopyLinkButton token={inv.token} role={inv.role} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(invitations ?? []).length === 0 && (
              <div className="p-12 text-center">
                <p className="text-sm text-muted-foreground">Nenhum convite enviado</p>
              </div>
            )}
          </div>
        )
      )}
    </AdminLayout>
  );
}

function PendingApprovals({ profiles }: { profiles: any[] }) {
  const { toast } = useToast();
  const approve = useApproveUser();
  const reject = useRejectUser();

  const handleApprove = async (userId: string, name: string) => {
    try {
      await approve.mutateAsync(userId);
      toast({ title: "Aprovado!", description: `${name} agora pode acessar o sistema.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (userId: string, name: string) => {
    try {
      await reject.mutateAsync(userId);
      toast({ title: "Rejeitado", description: `${name} foi bloqueado.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (profiles.length === 0) {
    return (
      <div className="bg-card rounded-xl p-12 shadow-card text-center">
        <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" />
          Solicitações de Cadastro ({profiles.length})
        </h3>
      </div>
      <div className="divide-y divide-border">
        {profiles.map((profile) => {
          const roles = profile.user_roles?.map((r: any) => r.role) ?? [];
          const roleLabel = roles.includes("driver") ? "Entregador" : roles.includes("company") ? "Empresa" : roles[0] || "—";
          const initials = (profile.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2);

          return (
            <div key={profile.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-warning">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{profile.full_name || "Sem nome"}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{roleLabel}</span>
                    <span>{profile.phone || "—"}</span>
                    <span>•</span>
                    <span>{new Date(profile.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(profile.id, profile.full_name)}
                  disabled={approve.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                </button>
                <button
                  onClick={() => handleReject(profile.id, profile.full_name)}
                  disabled={reject.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> Rejeitar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InviteDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const createInvite = useCreateInvitation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"company" | "driver">("driver");
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await createInvite.mutateAsync({ email, role, invitedBy: user.id });
      toast({ title: "Convite criado!" });
      setEmail("");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Convidar Usuário
        </button>
      </DialogTrigger>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <div className="flex gap-2">
              {(["driver", "company"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium border transition-colors",
                    role === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  {r === "driver" ? "Entregador" : "Empresa"}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={createInvite.isPending}
            className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createInvite.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar Convite
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyLinkButton({ token, role }: { token: string, role?: string }) {
  const [copied, setCopied] = useState(false);
  
  // Use fixed domains for consistent invite links
  const baseUrl = role === "driver" 
    ? "https://entregador.eprajadelivery.com" 
    : "https://lojista.eprajadelivery.com";
    
  const link = `${baseUrl}/invite/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-primary hover:underline">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : "Copiar link"}
    </button>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-xl p-5 shadow-card animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full p-12 text-center">
      <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
