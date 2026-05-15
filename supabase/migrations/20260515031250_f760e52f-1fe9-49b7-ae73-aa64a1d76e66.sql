CREATE OR REPLACE FUNCTION public.excluir_evento_historico(p_evento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tipo_evento text;
  v_parcela_id uuid;
  v_valor_original numeric;
  v_valor numeric;
  v_contrato_id uuid;
  v_contrato_status text;
  v_novo_pago numeric;
  v_valor_ref numeric;
  v_novo_status text := NULL;
  v_nova_data_pag date;
  v_contrato_reaberto boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT h.tipo_evento, p.id, p.valor_original, p.valor, c.id, c.status
  INTO v_tipo_evento, v_parcela_id, v_valor_original, v_valor, v_contrato_id, v_contrato_status
  FROM public.parcelas_historico h
  JOIN public.parcelas  p  ON p.id = h.parcela_id
  JOIN public.contratos c  ON c.id = p.contrato_id
  JOIN public.clientes  cl ON cl.id = c.cliente_id
  WHERE h.id = p_evento_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  DELETE FROM public.parcelas_historico WHERE id = p_evento_id;

  IF v_tipo_evento = 'pagamento' THEN
    SELECT COALESCE(SUM(valor_pago), 0) INTO v_novo_pago
    FROM public.parcelas_historico
    WHERE parcela_id = v_parcela_id AND tipo_evento = 'pagamento';

    v_valor_ref := COALESCE(v_valor_original, v_valor);
    v_novo_status := CASE WHEN v_novo_pago >= v_valor_ref THEN 'pago' ELSE 'pendente' END;
    v_nova_data_pag := CASE
      WHEN v_novo_pago = 0 THEN NULL
      WHEN v_novo_status = 'pago' THEN CURRENT_DATE
      ELSE NULL
    END;

    UPDATE public.parcelas
    SET valor_pago = v_novo_pago,
        status = v_novo_status,
        data_pagamento = v_nova_data_pag,
        updated_at = now()
    WHERE id = v_parcela_id;

    IF v_novo_status = 'pendente' AND v_contrato_status = 'quitado' THEN
      UPDATE public.contratos
      SET status = 'ativo', updated_at = now()
      WHERE id = v_contrato_id;
      v_contrato_reaberto := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'parcela_status', v_novo_status,
    'contrato_reaberto', v_contrato_reaberto
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_evento_historico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_evento_historico(uuid) TO authenticated;