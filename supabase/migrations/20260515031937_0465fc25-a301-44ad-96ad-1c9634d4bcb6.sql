-- 1. Constraint
ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_status_check;
ALTER TABLE public.parcelas
  ADD CONSTRAINT parcelas_status_check
  CHECK (status IN ('pendente', 'pago', 'parcialmente_pago', 'vencido'));

-- 2. Backfill
UPDATE public.parcelas
SET status = 'parcialmente_pago', updated_at = now()
WHERE status = 'pendente'
  AND COALESCE(valor_pago, 0) > 0
  AND COALESCE(valor_pago, 0) < COALESCE(valor_original, valor);

-- 3. registrar_pagamento_parcela: auto-promove via valor_pago acumulado
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcela(
  p_parcela_id uuid,
  p_tipo text,
  p_valor numeric,
  p_data_pagamento date,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id;

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
$$;