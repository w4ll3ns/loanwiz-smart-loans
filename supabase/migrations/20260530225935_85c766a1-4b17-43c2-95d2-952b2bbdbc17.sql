DROP FUNCTION IF EXISTS public.estornar_pagamento_parcela(uuid);

CREATE OR REPLACE FUNCTION public.estornar_pagamento_parcela(p_parcela_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parcela RECORD;
  v_user_id uuid;
  v_ultimo RECORD;
  v_valor_estornado numeric;
  v_novo_valor_pago numeric;
  v_valor_ref numeric;
  v_novo_status text;
  v_nova_data_pag date;
  v_contrato_reaberto boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.*, c.id as contrato_id_ref, c.status as contrato_status
  INTO v_parcela
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or not owned by user';
  END IF;

  SELECT h.id, COALESCE(h.valor_pago, 0) AS valor_pago
  INTO v_ultimo
  FROM parcelas_historico h
  WHERE h.parcela_id = p_parcela_id
    AND h.tipo_evento = 'pagamento'
  ORDER BY h.created_at DESC, h.data_pagamento DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há pagamentos para estornar';
  END IF;

  v_valor_estornado := v_ultimo.valor_pago;

  DELETE FROM parcelas_historico WHERE id = v_ultimo.id;

  SELECT COALESCE(SUM(COALESCE(valor_pago, 0)), 0)
  INTO v_novo_valor_pago
  FROM parcelas_historico
  WHERE parcela_id = p_parcela_id AND tipo_evento = 'pagamento';

  v_valor_ref := COALESCE(v_parcela.valor_original, v_parcela.valor);

  IF v_novo_valor_pago >= v_valor_ref THEN
    v_novo_status := 'pago';
  ELSIF v_novo_valor_pago > 0 THEN
    v_novo_status := 'parcialmente_pago';
  ELSE
    v_novo_status := 'pendente';
  END IF;

  v_nova_data_pag := CASE WHEN v_novo_status = 'pago' THEN COALESCE(v_parcela.data_pagamento, CURRENT_DATE) ELSE NULL END;

  UPDATE parcelas SET
    valor_pago = v_novo_valor_pago,
    status = v_novo_status,
    data_pagamento = v_nova_data_pag,
    updated_at = now()
  WHERE id = p_parcela_id;

  IF v_parcela.contrato_status = 'quitado' AND v_novo_status <> 'pago' THEN
    UPDATE contratos SET status = 'ativo', updated_at = now()
    WHERE id = v_parcela.contrato_id_ref;
    v_contrato_reaberto := true;
  END IF;

  RETURN jsonb_build_object(
    'valor_estornado', v_valor_estornado,
    'valor_pago', v_novo_valor_pago,
    'novo_status', v_novo_status,
    'contrato_reaberto', v_contrato_reaberto
  );
END;
$function$;