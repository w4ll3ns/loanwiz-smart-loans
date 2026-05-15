
DROP FUNCTION IF EXISTS public.criar_contrato_com_parcelas(uuid, numeric, numeric, text, integer, date, text, boolean, boolean);

CREATE OR REPLACE FUNCTION public.criar_contrato_com_parcelas(
  p_cliente_id uuid,
  p_valor_emprestado numeric,
  p_percentual numeric,
  p_periodicidade text,
  p_numero_parcelas integer,
  p_data_emprestimo date,
  p_tipo_juros text DEFAULT 'simples',
  p_permite_sabado boolean DEFAULT true,
  p_permite_domingo boolean DEFAULT false,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_total numeric;
  v_valor_parcela numeric;
  v_contrato_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_user_active(v_user_id) THEN
    RAISE EXCEPTION 'User account is not active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Client not found or not owned by user';
  END IF;

  IF p_valor_emprestado <= 0 OR p_valor_emprestado > 100000000 THEN
    RAISE EXCEPTION 'Invalid loan amount';
  END IF;
  IF p_percentual <= 0 OR p_percentual > 1000 THEN
    RAISE EXCEPTION 'Invalid interest rate';
  END IF;
  IF p_numero_parcelas < 1 OR p_numero_parcelas > 365 THEN
    RAISE EXCEPTION 'Invalid number of installments';
  END IF;
  IF p_periodicidade NOT IN ('diario', 'semanal', 'quinzenal', 'mensal') THEN
    RAISE EXCEPTION 'Invalid periodicity';
  END IF;
  IF p_tipo_juros NOT IN ('simples', 'parcela', 'composto') THEN
    RAISE EXCEPTION 'Invalid interest type';
  END IF;

  CASE p_tipo_juros
    WHEN 'simples' THEN
      v_valor_total := p_valor_emprestado + (p_valor_emprestado * p_percentual / 100);
    WHEN 'parcela' THEN
      v_valor_total := p_valor_emprestado + (p_valor_emprestado * (p_percentual / 100) * p_numero_parcelas);
    WHEN 'composto' THEN
      v_valor_total := p_valor_emprestado * POWER(1 + (p_percentual / 100), p_numero_parcelas);
  END CASE;
  v_valor_total := ROUND(v_valor_total, 2);
  v_valor_parcela := ROUND(v_valor_total / p_numero_parcelas, 2);

  INSERT INTO contratos (
    cliente_id, valor_emprestado, percentual, periodicidade,
    numero_parcelas, data_emprestimo, valor_total, status,
    tipo_juros, permite_cobranca_sabado, permite_cobranca_domingo,
    observacoes
  ) VALUES (
    p_cliente_id, p_valor_emprestado, p_percentual, p_periodicidade,
    p_numero_parcelas, p_data_emprestimo, v_valor_total, 'ativo',
    p_tipo_juros, p_permite_sabado, p_permite_domingo,
    NULLIF(p_observacoes, '')
  ) RETURNING id INTO v_contrato_id;

  PERFORM public.gerar_parcelas(
    v_contrato_id, p_numero_parcelas, v_valor_parcela,
    p_data_emprestimo, p_periodicidade, p_permite_sabado, p_permite_domingo
  );

  RETURN v_contrato_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_contrato_com_parcelas(uuid, numeric, numeric, text, integer, date, text, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_contrato_com_parcelas(uuid, numeric, numeric, text, integer, date, text, boolean, boolean, text) TO authenticated;
