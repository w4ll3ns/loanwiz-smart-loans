CREATE OR REPLACE FUNCTION public.excluir_cliente(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_owner uuid;
  v_tem_contratos boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.clientes WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.contratos WHERE cliente_id = p_cliente_id)
  INTO v_tem_contratos;

  IF v_tem_contratos THEN
    RAISE EXCEPTION 'Cliente possui contratos vinculados. Exclua os contratos primeiro.';
  END IF;

  DELETE FROM public.clientes WHERE id = p_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_cliente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_cliente(uuid) TO authenticated;