-- Add avatar_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Extend update_own_profile to accept avatar_url
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_nome text DEFAULT NULL::text,
  p_telefone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_avatar_url text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE profiles
  SET
    nome = COALESCE(p_nome, nome),
    telefone = COALESCE(p_telefone, telefone),
    email = COALESCE(p_email, email),
    avatar_url = CASE WHEN p_avatar_url IS NULL THEN avatar_url
                      WHEN p_avatar_url = '' THEN NULL
                      ELSE p_avatar_url END,
    ultimo_acesso = now(),
    updated_at = now()
  WHERE id = auth.uid();
END;
$function$;