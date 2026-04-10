import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Phone, FileText, Loader2, Calendar } from "lucide-react";

async function fetchCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });
}

export default function CustomersPage() {
  const { data: customers, isLoading } = useCustomers();

  return (
    <AdminLayout title="Clientes" subtitle="Clientes do marketplace que compram dos lojistas">
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (customers ?? []).length === 0 ? (
        <div className="bg-card rounded-xl p-12 shadow-card text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-foreground">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">Os clientes aparecerão aqui quando se cadastrarem no marketplace.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              {customers!.length} {customers!.length === 1 ? "cliente" : "clientes"} cadastrados
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Nome</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Telefone</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">CPF</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground p-4">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers!.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(c.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {c.phone || "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> {c.cpf || "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
