import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * FUNÇÕES
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, data: any) {
  const { data: updatedData, error } = await supabase
    .from("profiles")
    .update(data)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return updatedData;
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

/**
 * HOOKS
 */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => (user?.id ? getProfile(user.id) : null),
    enabled: !!user?.id,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      return updateProfile(user.id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

export function useUploadAvatar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      return uploadAvatar(user.id, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
