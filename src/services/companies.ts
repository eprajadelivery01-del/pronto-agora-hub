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

const pickBestCompany = (companies: any[]) =>
  companies.find(c => !c.name?.toLowerCase().includes("teste")) || companies[0];

export async function fetchCompanyByUserId(userId: string, email?: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId);
  
  if (error) throw error;
  
  if (data && data.length > 0) {
    return pickBestCompany(data);
  }

  const resolvedEmail = email || (await supabase.auth.getUser()).data.user?.email;
  if (resolvedEmail) {
    const { data: companiesByEmail, error: emailError } = await supabase
      .from("companies")
      .select("*")
      .ilike("email", resolvedEmail.trim());

    if (emailError) throw emailError;
    if (companiesByEmail && companiesByEmail.length > 0) {
      return pickBestCompany(companiesByEmail);
    }
  }

  if (!data || data.length === 0) {
    return null;
  }
}

export function useCompany(userId?: string, email?: string) {
  return useQuery({
    queryKey: ["company", userId, email],
    queryFn: () => (userId ? fetchCompanyByUserId(userId, email) : null),
    enabled: !!userId,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });
}
