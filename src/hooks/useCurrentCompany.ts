import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCompanyByUserId } from "@/services/companies";

export interface CurrentCompanyResult {
  companyId: string | null;
  company: any | null;
  isLoading: boolean;
  isLinked: boolean;
  userId: string | undefined;
  error: unknown;
}

/**
 * Hook central do painel lojista. Resolve a empresa vinculada ao usuário logado
 * (com fallback admin já implementado em fetchCompanyByUserId) e expõe um
 * estado claro de "vinculado / não vinculado / carregando".
 */
export function useCurrentCompany(): CurrentCompanyResult {
  const { user } = useAuth();
  const userId = user?.id;
  const email = user?.email;

  const query = useQuery({
    queryKey: ["current-company", userId, email],
    queryFn: async () => {
      if (!userId) return null;
      const company = await fetchCompanyByUserId(userId, email);
      return company;

    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const company = query.data ?? null;
  const isLoading = !!userId && query.isLoading;

  return {
    companyId: company?.id ?? null,
    company,
    isLoading,
    isLinked: !!company?.id,
    userId,
    error: query.error,
  };
}
