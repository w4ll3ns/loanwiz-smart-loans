import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "avatars";

/** Build initials from a name (or fall back to email / "U"). */
export function getIniciais(nome?: string | null, email?: string | null): string {
  if (nome?.trim()) {
    const p = nome.trim().split(/\s+/);
    return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }
  return (email?.[0] ?? "U").toUpperCase();
}

/** Resolve a storage path stored in profiles.avatar_url to a usable signed URL. */
export async function resolveAvatarUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  // Already a full URL (legacy / external)
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24); // 24h
  if (error) return null;
  return data?.signedUrl ?? null;
}
