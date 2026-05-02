import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * FUNÇÕES
 */
export async function getWallet(userId: string) {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // Se não houver carteira ainda, criamos uma?
  
  if (!data) {
     const { data: newWallet, error: createError } = await supabase
       .from("wallets")
       .insert({ user_id: userId, balance: 0 })
       .select()
       .single();
     if (createError) throw createError;
     return newWallet;
  }
  
  return data;
}

export async function getTransactions(walletId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function requestWithdrawal(amount: number, userId: string) {
  // Atomic withdrawal via Postgres RPC to prevent race-condition overdrafts.
  // Falls back to client-side logic if the RPC doesn't exist yet.
  const { error: rpcError } = await supabase.rpc("withdraw" as any, {
    p_user_id: userId,
    p_amount: amount,
  });

  if (rpcError) {
    // If the RPC function doesn't exist yet, fall back (temporary)
    if (rpcError.message?.includes("function") && rpcError.message?.includes("does not exist")) {
      console.warn("withdraw RPC not found — using legacy non-atomic path");
      const wallet = await getWallet(userId);
      if (wallet.balance < amount) throw new Error("Saldo insuficiente");

      const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: wallet.balance - amount })
        .eq("id", wallet.id);
      if (updateError) throw updateError;

      const { error: transError } = await supabase
        .from("financial_transactions")
        .insert({
          wallet_id: wallet.id,
          amount: -amount,
          type: "debit",
          description: "Saque solicitado",
        });
      if (transError) throw transError;
      return { success: true };
    }

    // "Saldo insuficiente" raised from the DB function
    if (rpcError.message?.includes("Saldo insuficiente")) {
      throw new Error("Saldo insuficiente");
    }
    throw rpcError;
  }

  return { success: true };
}

/**
 * HOOKS
 */
export function useWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: () => (user?.id ? getWallet(user.id) : null),
    enabled: !!user?.id,
  });
}

export function useTransactions() {
  const { data: wallet } = useWallet();
  return useQuery({
    queryKey: ["transactions", wallet?.id],
    queryFn: () => (wallet?.id ? getTransactions(wallet.id) : null),
    enabled: !!wallet?.id,
  });
}

export function useWithdrawals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      return requestWithdrawal(amount, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", user?.id] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
