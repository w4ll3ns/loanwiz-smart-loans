CREATE OR REPLACE FUNCTION public.excluir_parcela(p_parcela_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_parcela RECORD;
  v_max_numero integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.id, p.numero_parcela, p.status, p.valor_pago,
         c.id AS contrato_id, c.status AS contrato_status
  INTO v_parcela
  FROM public.parcelas p
  JOIN public.contratos c ON c.id = p.contrato_id
  JOIN public.clientes cl ON cl.id = c.cliente_id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  IF v_parcela.contrato_status = 'quitado' THEN
    RAISE EXCEPTION 'Contrato quitado não pode ter parcelas excluídas';
  END IF;

  IF v_parcela.status = 'pago' OR COALESCE(v_parcela.valor_pago, 0) > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir uma parcela com pagamentos registrados';
  END IF;

  SELECT MAX(numero_parcela) INTO v_max_numero
  FROM public.parcelas
  WHERE contrato_id = v_parcela.contrato_id;

  IF v_parcela.numero_parcela <> v_max_numero THEN
    RAISE EXCEPTION 'Apenas a última parcela pode ser excluída para evitar quebra de sequência';
  END IF;

  DELETE FROM public.parcelas_historico WHERE parcela_id = p_parcela_id;
  DELETE FROM public.parcelas WHERE id = p_parcela_id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_parcela(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_parcela(uuid) TO authenticated;