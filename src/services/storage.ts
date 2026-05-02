import { supabase } from "@/lib/supabaseClient";

export async function uploadImage(file: File, bucket: string, pathPrefix: string = "") {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return urlData.publicUrl;
}
