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
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Convite inválido ou já utilizado");
  if (new Date(data.expires_at) < new Date()) throw new Error("Convite expirado");
  return data;
}

export async function acceptInvitation(token: string, userData: { email: string; password: string; fullName: string; phone: string; document: string; companyName?: string }) {
  const invitation = await validateInvitation(token);

  // 1. Sign up user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: { data: { full_name: userData.fullName } },
  });
  
  if (authError) throw authError;
  if (!authData.user) throw new Error("Erro ao criar conta");

  // 2. Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: userData.fullName,
      phone: userData.phone,
      document: userData.document,
      status: "active" as any,
    })
    .eq("user_id", authData.user.id);
    
  if (profileError) throw profileError;

  // 3. Assign role
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: authData.user.id,
    role: invitation.role,
  });

  if (roleError) throw roleError;

  // 4. Create role-specific records
  if (invitation.role === "driver") {
    const { error: driverError } = await supabase.from("delivery_drivers").insert({
      user_id: authData.user.id,
    });
    if (driverError) throw driverError;
  }

  if (invitation.role === "company") {
    const { error: companyError } = await supabase.from("companies").insert({
      user_id: authData.user.id,
      name: userData.companyName || userData.fullName,
    });
    if (companyError) throw companyError;
  }

  // 5. Mark invitation as accepted and record the registering email
  const { error: inviteUpdateError } = await supabase
    .from("invitations")
    .update({ status: "accepted" as any, email: userData.email })
    .eq("token", token);
    
  if (inviteUpdateError) throw inviteUpdateError;

  // 6. Sign in the newly created user
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
