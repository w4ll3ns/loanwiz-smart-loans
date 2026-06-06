-- 1) Registrar pagamento: só quita quando o tipo é 'total'
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcela(p_parcela_id uuid, p_tipo text, p_valor numeric, p_data_pagamento date, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parcela RECORD;
  v_user_id uuid;
  v_valor_pagar numeric;
  v_novo_valor_pago numeric;
  v_valor_ref numeric;
  v_novo_status text;
  v_tipo_pagamento text;
  v_juros numeric;
  v_todas_pagas boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_data_pagamento IS NULL THEN
    RAISE EXCEPTION 'Data do pagamento é obrigatória';
  END IF;

  IF p_data_pagamento > CURRENT_DATE + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'Data do pagamento não pode ser no futuro';
  END IF;

  SELECT p.*, c.id as contrato_id_ref, c.valor_emprestado, c.numero_parcelas, c.percentual, c.tipo_juros, c.status as contrato_status
  INTO v_parcela
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or not owned by user';
  END IF;

  IF v_parcela.status = 'pago' THEN
    RAISE EXCEPTION 'Installment is already fully paid';
  END IF;

  v_tipo_pagamento := p_tipo;
  CASE p_tipo
    WHEN 'total' THEN
      v_valor_pagar := COALESCE(v_parcela.valor_original, v_parcela.valor);
    WHEN 'juros' THEN
      v_juros := ROUND((v_parcela.valor_emprestado / v_parcela.numero_parcelas) * (v_parcela.percentual / 100), 2);
      v_valor_pagar := v_juros;
    WHEN 'parcial' THEN
      IF p_valor IS NULL OR p_valor <= 0 THEN
        RAISE EXCEPTION 'Custom payment value must be positive';
      END IF;
      v_valor_pagar := p_valor;
    ELSE
      RAISE EXCEPTION 'Invalid payment type: %', p_tipo;
  END CASE;

  v_novo_valor_pago := COALESCE(v_parcela.valor_pago, 0) + v_valor_pagar;
  v_valor_ref := COALESCE(v_parcela.valor_original, v_parcela.valor);

  -- Só quita quando o pagamento for do tipo 'total'.
  -- Juros e personalizados (parcial) nunca quitam automaticamente.
  IF v_tipo_pagamento = 'total' THEN
    v_novo_status := 'pago';
  ELSIF v_novo_valor_pago > 0 THEN
    v_novo_status := 'parcialmente_pago';
  ELSE
    v_novo_status := 'pendente';
  END IF;

  INSERT INTO parcelas_historico (
    parcela_id, valor_pago, tipo_pagamento, data_pagamento,
    observacao, tipo_evento
  ) VALUES (
    p_parcela_id, v_valor_pagar, v_tipo_pagamento,
    (p_data_pagamento::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    p_observacao, 'pagamento'
  );

  UPDATE parcelas SET
    valor_pago = v_novo_valor_pago,
    status = v_novo_status,
    data_pagamento = CASE WHEN v_novo_status = 'pago' THEN p_data_pagamento ELSE data_pagamento END,
    valor_original = COALESCE(valor_original, valor),
    updated_at = now()
  WHERE id = p_parcela_id;

  IF v_novo_status = 'pago' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM parcelas
      WHERE contrato_id = v_parcela.contrato_id
      AND status != 'pago'
      AND id != p_parcela_id
    ) INTO v_todas_pagas;

    IF v_todas_pagas THEN
      UPDATE contratos SET status = 'quitado', updated_at = now()
      WHERE id = v_parcela.contrato_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valor_pago', v_valor_pagar,
    'novo_status', v_novo_status,
    'contrato_quitado', COALESCE(v_todas_pagas, false)
  );
END;
$function$;

-- 2) Estornar pagamento: status 'pago' só se restar algum pagamento 'total'
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
  v_tem_total boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM parcelas_historico
    WHERE parcela_id = p_parcela_id
      AND tipo_evento = 'pagamento'
      AND tipo_pagamento = 'total'
  ) INTO v_tem_total;

  v_valor_ref := COALESCE(v_parcela.valor_original, v_parcela.valor);

  -- Só fica 'pago' se ainda houver um pagamento do tipo 'total'
  IF v_tem_total THEN
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

-- 3) Excluir evento do histórico: mesma regra de status
CREATE OR REPLACE FUNCTION public.excluir_evento_historico(p_evento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_tem_total boolean;
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

    SELECT EXISTS (
      SELECT 1 FROM public.parcelas_historico
      WHERE parcela_id = v_parcela_id
        AND tipo_evento = 'pagamento'
        AND tipo_pagamento = 'total'
    ) INTO v_tem_total;

    v_valor_ref := COALESCE(v_valor_original, v_valor);

    -- Só fica 'pago' se ainda houver um pagamento do tipo 'total'
    IF v_tem_total THEN
      v_novo_status := 'pago';
    ELSIF v_novo_pago > 0 THEN
      v_novo_status := 'parcialmente_pago';
    ELSE
      v_novo_status := 'pendente';
    END IF;

    v_nova_data_pag := CASE WHEN v_novo_status = 'pago' THEN CURRENT_DATE ELSE NULL END;

    UPDATE public.parcelas
    SET valor_pago = v_novo_pago,
        status = v_novo_status,
        data_pagamento = v_nova_data_pag,
        updated_at = now()
    WHERE id = v_parcela_id;

    IF v_novo_status <> 'pago' AND v_contrato_status = 'quitado' THEN
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
$function$;