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

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });
}
