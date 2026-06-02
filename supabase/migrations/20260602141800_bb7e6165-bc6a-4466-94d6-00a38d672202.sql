CREATE OR REPLACE FUNCTION public.estornar_pagamento_parcela(p_parcela_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parcela RECORD;
  v_user_id uuid;
  v_owner_id uuid;
  v_cliente_nome text;
  v_ultimo RECORD;
  v_valor_estornado numeric;
  v_valor_pago_anterior numeric;
  v_status_anterior text;
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

  SELECT p.*, c.id as contrato_id_ref, c.status as contrato_status, cl.user_id as owner_id, cl.nome as cliente_nome
  INTO v_parcela
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or not owned by user';
  END IF;

  v_owner_id := v_parcela.owner_id;
  v_cliente_nome := v_parcela.cliente_nome;
  v_valor_pago_anterior := COALESCE(v_parcela.valor_pago, 0);
  v_status_anterior := v_parcela.status;

  SELECT h.id, COALESCE(h.valor_pago, 0) AS valor_pago, h.tipo_pagamento, h.data_pagamento
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

  INSERT INTO public.audit_logs (user_id, action, target_user_id, details)
  VALUES (
    v_user_id,
    'estorno_pagamento',
    v_owner_id,
    jsonb_build_object(
      'parcela_id', p_parcela_id,
      'contrato_id', v_parcela.contrato_id_ref,
      'cliente_nome', v_cliente_nome,
      'numero_parcela', v_parcela.numero_parcela,
      'valor_estornado', v_valor_estornado,
      'tipo_pagamento', v_ultimo.tipo_pagamento,
      'data_lancamento_revertido', v_ultimo.data_pagamento,
      'valor_pago_anterior', v_valor_pago_anterior,
      'valor_pago_novo', v_novo_valor_pago,
      'status_anterior', v_status_anterior,
      'status_novo', v_novo_status,
      'contrato_reaberto', v_contrato_reaberto
    )
  );

  RETURN jsonb_build_object(
    'valor_estornado', v_valor_estornado,
    'valor_pago', v_novo_valor_pago,
    'novo_status', v_novo_status,
    'contrato_reaberto', v_contrato_reaberto
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalcular_contrato_parcelas(p_contrato_id uuid, p_tipo_juros text, p_percentual numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato RECORD;
  v_cliente_nome text;
  v_tipo_juros_anterior text;
  v_percentual_anterior numeric;
  v_valor_total_anterior numeric;
  v_valor_total_novo numeric;
  v_valor_ja_pago numeric;
  v_parcelas_pendentes integer;
  v_valor_parcela_nova numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.*, cl.user_id, cl.nome as cliente_nome INTO v_contrato
  FROM contratos c
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE c.id = p_contrato_id
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;

  IF v_contrato.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_contrato.status = 'quitado' THEN
    RAISE EXCEPTION 'Cannot edit a settled contract';
  END IF;

  IF p_tipo_juros NOT IN ('simples', 'parcela', 'composto') THEN
    RAISE EXCEPTION 'Invalid interest type: %. Must be simples, parcela, or composto', p_tipo_juros;
  END IF;

  IF p_percentual IS NULL THEN
    p_percentual := v_contrato.percentual;
  END IF;

  v_cliente_nome := v_contrato.cliente_nome;
  v_tipo_juros_anterior := v_contrato.tipo_juros;
  v_percentual_anterior := v_contrato.percentual;
  v_valor_total_anterior := v_contrato.valor_total;

  CASE p_tipo_juros
    WHEN 'simples' THEN
      v_valor_total_novo := v_contrato.valor_emprestado + (v_contrato.valor_emprestado * p_percentual / 100);
    WHEN 'parcela' THEN
      v_valor_total_novo := v_contrato.valor_emprestado + (v_contrato.valor_emprestado * (p_percentual / 100) * v_contrato.numero_parcelas);
    WHEN 'composto' THEN
      v_valor_total_novo := v_contrato.valor_emprestado * POWER(1 + (p_percentual / 100), v_contrato.numero_parcelas);
  END CASE;

  v_valor_total_novo := ROUND(v_valor_total_novo, 2);

  SELECT COALESCE(SUM(valor_pago), 0) INTO v_valor_ja_pago
  FROM parcelas WHERE contrato_id = p_contrato_id AND status = 'pago';

  SELECT COUNT(*) INTO v_parcelas_pendentes
  FROM parcelas WHERE contrato_id = p_contrato_id AND status = 'pendente';

  IF v_parcelas_pendentes = 0 THEN
    RAISE EXCEPTION 'No pending installments to recalculate';
  END IF;

  v_valor_parcela_nova := ROUND((v_valor_total_novo - v_valor_ja_pago) / v_parcelas_pendentes, 2);

  UPDATE contratos SET
    tipo_juros = p_tipo_juros,
    percentual = p_percentual,
    valor_total = v_valor_total_novo,
    updated_at = now()
  WHERE id = p_contrato_id;

  UPDATE parcelas SET
    valor = v_valor_parcela_nova,
    valor_original = v_valor_parcela_nova,
    updated_at = now()
  WHERE contrato_id = p_contrato_id AND status = 'pendente';

  INSERT INTO public.audit_logs (user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    'recalculo_contrato',
    v_contrato.user_id,
    jsonb_build_object(
      'contrato_id', p_contrato_id,
      'cliente_nome', v_cliente_nome,
      'tipo_juros_anterior', v_tipo_juros_anterior,
      'tipo_juros_novo', p_tipo_juros,
      'percentual_anterior', v_percentual_anterior,
      'percentual_novo', p_percentual,
      'valor_total_anterior', v_valor_total_anterior,
      'valor_total_novo', v_valor_total_novo,
      'valor_parcela_novo', v_valor_parcela_nova,
      'parcelas_pendentes_afetadas', v_parcelas_pendentes
    )
  );
END;
$function$;