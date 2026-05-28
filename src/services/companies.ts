import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export async function fetchCompanies() {
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("*")
    .order("name");
  
  if (companiesError) throw companiesError;
  if (!companies) return [];

  const userIds = companies.map(c => c.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, document")
    .in("user_id", userIds);

  if (profilesError) {
    console.error("Erro ao buscar perfis das empresas:", profilesError);
    return companies;
  }

  return companies.map(company => ({
    ...company,
    document: profiles?.find(p => p.user_id === company.user_id)?.document || null
  }));
}

export async function fetchCompanyByUserId(userId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId);
  
  if (error) throw error;
  
  if (!data || data.length === 0) {
    // Fallback para Administradores: se o usuário for admin, retorna a primeira empresa
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.role === "admin") {
      const { data: fallbackCompanies } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1);
      if (fallbackCompanies && fallbackCompanies.length > 0) {
        return fallbackCompanies[0];
      }
    }
    return null;
  }
  
  // Return the best company (not a test one, or the first one)
  return data.find(c => !c.name.toLowerCase().includes("teste")) || data[0];
}

export function useCompany(userId?: string) {
  return useQuery({
    queryKey: ["company", userId],
    queryFn: () => (userId ? fetchCompanyByUserId(userId) : null),
    enabled: !!userId,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });
}
