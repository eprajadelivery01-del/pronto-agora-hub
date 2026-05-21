import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ProfileRow = Record<string, any>;
export type InvitationRow = Record<string, any>;

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, user_roles(role)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPendingProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, user_roles(role)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function approveUser(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" as any })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function rejectUser(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected" as any })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateProfile(userId: string, updates: { full_name?: string; phone?: string; document?: string; avatar_url?: string }) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  
  await updateProfile(userId, { avatar_url: urlData.publicUrl });
  return urlData.publicUrl;
}

export async function createInvitation(email: string, role: "admin" | "company" | "driver" | "customer", invitedBy: string) {
  const { data, error } = await supabase
    .from("invitations")
    .insert({ email, role, invited_by: invitedBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchInvitations() {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function validateInvitation(token: string) {
  // Query by token only first — avoids compound-filter RLS issues
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[Invite] Supabase error:", error);
    throw new Error(error.message || "Erro ao validar convite");
  }
  if (!data) throw new Error("Convite não encontrado");
  if (data.status !== "pending") throw new Error("Convite inválido ou já utilizado");
  if (new Date(data.expires_at) < new Date()) throw new Error("Convite expirado");
  return data;
}

export async function acceptInvitation(token: string, userData: { email: string; password: string; fullName: string; phone: string; document: string; companyName?: string }) {
  const invitation = await validateInvitation(token);

  // 1. Sign up user — passa company_name e phone nos metadados para que o trigger
  //    handle_new_user crie a empresa com o nome correto da loja.
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        full_name: userData.fullName,
        phone: userData.phone,
        // CRÍTICO: o trigger handle_new_user usa 'company_name' para nomear a empresa
        company_name: userData.companyName || userData.fullName,
        invitation_id: invitation.id,
      },
    },
  });
  
  if (authError) throw authError;
  if (!authData.user) throw new Error("Erro ao criar conta");

  // 2. Aguardar brevemente para o trigger completar
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Atualizar perfil com documento e status ativo
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: userData.fullName,
      phone: userData.phone,
      document: userData.document,
      status: "active" as any,
    })
    .eq("user_id", authData.user.id);
    
  if (profileError) console.warn("[Invite] Aviso ao atualizar perfil:", profileError.message);

  // 4. Garantir role (o trigger pode já ter inserido, usar ON CONFLICT)
  const { error: roleError } = await supabase.from("user_roles").upsert({
    user_id: authData.user.id,
    role: invitation.role,
  }, { onConflict: "user_id,role", ignoreDuplicates: true });

  if (roleError) console.warn("[Invite] Aviso ao atribuir role:", roleError.message);

  // 5. Garantir registro específico do role
  if (invitation.role === "driver") {
    // Trigger pode ter criado; usar upsert seguro
    const { error: driverError } = await supabase.from("delivery_drivers").upsert({
      user_id: authData.user.id,
      is_online: false,
    }, { onConflict: "user_id", ignoreDuplicates: true });
    if (driverError) console.warn("[Invite] Aviso ao criar entregador:", driverError.message);
  }

  if (invitation.role === "company") {
    // O trigger pode já ter criado a empresa com o nome correto (via metadata company_name).
    // Usar UPDATE para garantir o nome correto caso o trigger tenha usado fallback.
    const correctName = userData.companyName || userData.fullName;

    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (existingCompany) {
      // Empresa criada pelo trigger — garantir que o nome está correto
      const { error: updateErr } = await supabase
        .from("companies")
        .update({ name: correctName, phone: userData.phone })
        .eq("user_id", authData.user.id);
      if (updateErr) console.warn("[Invite] Aviso ao atualizar empresa:", updateErr.message);
    } else {
      // Trigger não criou a empresa — inserir manualmente
      const { error: companyError } = await supabase.from("companies").insert({
        user_id: authData.user.id,
        name: correctName,
        phone: userData.phone,
      });
      if (companyError) throw new Error("Erro ao criar loja: " + companyError.message);
    }
  }

  // 6. Marcar convite como aceito
  await supabase
    .from("invitations")
    .update({ status: "accepted" as any, email: userData.email })
    .eq("token", token);

  // 7. Fazer login com o usuário recém-criado
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.email,
    password: userData.password,
  });
  if (signInError) throw signInError;

  return signInData;
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
  });
}

export function usePendingProfiles() {
  return useQuery({
    queryKey: ["profiles", "pending"],
    queryFn: fetchPendingProfiles,
  });
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useInvitations() {
  return useQuery({
    queryKey: ["invitations"],
    queryFn: fetchInvitations,
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role, invitedBy }: { email: string; role: "admin" | "company" | "driver" | "customer"; invitedBy: string }) =>
      createInvitation(email, role, invitedBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}
