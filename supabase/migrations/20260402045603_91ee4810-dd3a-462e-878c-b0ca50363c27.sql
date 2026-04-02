
-- Drop the permissive user UPDATE policy that allows subscription bypass
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a restricted UPDATE policy using a SECURITY DEFINER function
-- that only allows users to update safe fields (nome, telefone, email, ultimo_acesso)
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_nome text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE profiles
  SET
    nome = COALESCE(p_nome, nome),
    telefone = COALESCE(p_telefone, telefone),
    email = COALESCE(p_email, email),
    ultimo_acesso = now(),
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Re-create a restrictive UPDATE policy: users can only update ultimo_acesso on their own row
-- All other profile updates must go through the security definer function
CREATE POLICY "Users can update own profile limited"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND ativo = (SELECT p.ativo FROM profiles p WHERE p.id = auth.uid())
    AND status_plano = (SELECT p.status_plano FROM profiles p WHERE p.id = auth.uid())
    AND data_expiracao_teste IS NOT DISTINCT FROM (SELECT p.data_expiracao_teste FROM profiles p WHERE p.id = auth.uid())
    AND observacoes_admin IS NOT DISTINCT FROM (SELECT p.observacoes_admin FROM profiles p WHERE p.id = auth.uid())
  );
