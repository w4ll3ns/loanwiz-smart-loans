-- Garantir UNIQUE para suportar ON CONFLICT em user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END$$;

-- Documentação anti-PII no schema
COMMENT ON TABLE public.user_roles IS
  'Roles de usuários. Admins iniciais devem ser promovidos manualmente via SQL Editor no dashboard do Supabase ou via RPC admin_promote_user(p_user_id). NUNCA inserir UUIDs/emails/telefones ou qualquer PII em arquivos de migration versionados.';

-- RPC para promover usuário a admin sem hardcode
CREATE OR REPLACE FUNCTION public.admin_promote_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.insert_audit_log(
    'promote_admin',
    p_user_id,
    jsonb_build_object('promoted_by', auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_promote_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_promote_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_promote_user(uuid) IS
  'Promove um usuário existente a admin. Apenas admins podem chamar. Usar via SQL Editor para promover o primeiro admin manualmente — nunca hardcode UUIDs em migrations.';