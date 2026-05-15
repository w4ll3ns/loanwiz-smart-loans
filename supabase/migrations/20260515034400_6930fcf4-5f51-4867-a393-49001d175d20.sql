-- Add pessimistic row locks to prevent concurrent payment race conditions

CREATE OR REPLACE FUNCTION public.recalcular_contrato_parcelas(p_contrato_id uuid, p_tipo_juros text, p_percentual numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato RECORD;
  v_valor_total_novo numeric;
  v_valor_ja_pago numeric;
  v_parcelas_pendentes integer;
  v_valor_parcela_nova numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.*, cl.user_id INTO v_contrato
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
END;
$function$;

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

  IF v_novo_valor_pago >= v_valor_ref THEN
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
    now(), p_observacao, 'pagamento'
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

CREATE OR REPLACE FUNCTION public.estornar_pagamento_parcela(p_parcela_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parcela RECORD;
  v_user_id uuid;
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

  DELETE FROM parcelas_historico
  WHERE parcela_id = p_parcela_id AND tipo_evento = 'pagamento';

  UPDATE parcelas SET
    status = 'pendente',
    data_pagamento = NULL,
    valor_pago = 0,
    updated_at = now()
  WHERE id = p_parcela_id;

  IF v_parcela.contrato_status = 'quitado' THEN
    UPDATE contratos SET status = 'ativo', updated_at = now()
    WHERE id = v_parcela.contrato_id_ref;
  END IF;
END;
$function$;