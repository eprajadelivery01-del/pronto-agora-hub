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
  // Server-side invitation acceptance via edge function to prevent client-side role manipulation
  const res = await supabase.functions.invoke("accept-invitation", {
    body: {
      token,
      email: userData.email,
      password: userData.password,
      fullName: userData.fullName,
      phone: userData.phone,
      document: userData.document,
      companyName: userData.companyName,
    },
  });

  if (res.error) throw new Error(res.error.message);
  const data = res.data as any;
  if (data?.error) throw new Error(data.error);

  // Sign in the newly created user
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
