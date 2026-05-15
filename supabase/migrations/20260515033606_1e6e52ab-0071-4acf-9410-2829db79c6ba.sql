
CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(p_user_id uuid, p_ativo boolean)
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

  UPDATE public.profiles
  SET ativo = p_ativo, updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, target_user_id, details)
  VALUES (auth.uid(), 'toggle_user', p_user_id, jsonb_build_object('ativo', p_ativo));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_plano(
  p_user_id uuid,
  p_plano text,
  p_data_expiracao date DEFAULT NULL
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_plano NOT IN ('teste','ativo','expirado','cancelado') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plano;
  END IF;

  UPDATE public.profiles
  SET
    status_plano = p_plano,
    data_expiracao_teste = COALESCE(p_data_expiracao, data_expiracao_teste),
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    'change_plan',
    p_user_id,
    jsonb_build_object('plano', p_plano, 'data_expiracao', p_data_expiracao)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_observacoes(
  p_user_id uuid,
  p_observacoes text
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET observacoes_admin = NULLIF(p_observacoes, ''), updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    'update_observacoes',
    p_user_id,
    jsonb_build_object('has_text', (p_observacoes IS NOT NULL AND length(p_observacoes) > 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_user_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_status(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_user_plano(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_plano(uuid, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_user_observacoes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_observacoes(uuid, text) TO authenticated;
