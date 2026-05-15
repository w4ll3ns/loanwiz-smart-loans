-- =========================================================
-- RPC: calendario_mensal(p_mes, p_ano)
-- =========================================================
CREATE OR REPLACE FUNCTION public.calendario_mensal(p_mes integer, p_ano integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_primeiro_dia date;
  v_ultimo_dia date;
  v_dias jsonb;
  v_recebido_mes numeric := 0;
  v_previsto_mes numeric := 0;
  v_qtd_recebimentos integer := 0;
  v_qtd_previstos integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_mes IS NULL OR p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Invalid month: %', p_mes;
  END IF;
  IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2100 THEN
    RAISE EXCEPTION 'Invalid year: %', p_ano;
  END IF;

  v_primeiro_dia := make_date(p_ano, p_mes, 1);
  v_ultimo_dia := (v_primeiro_dia + interval '1 month' - interval '1 day')::date;

  WITH dias AS (
    SELECT d::date AS dia
    FROM generate_series(v_primeiro_dia, v_ultimo_dia, interval '1 day') d
  ),
  pagamentos_dia AS (
    SELECT (h.data_pagamento AT TIME ZONE 'UTC')::date AS dia,
           SUM(COALESCE(h.valor_pago, 0))::numeric AS valor,
           COUNT(*)::int AS qtd
    FROM parcelas_historico h
    JOIN parcelas p ON p.id = h.parcela_id
    JOIN contratos c ON c.id = p.contrato_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND h.tipo_evento = 'pagamento'
      AND (h.data_pagamento AT TIME ZONE 'UTC')::date BETWEEN v_primeiro_dia AND v_ultimo_dia
    GROUP BY (h.data_pagamento AT TIME ZONE 'UTC')::date
  ),
  previstos_dia AS (
    SELECT p.data_vencimento AS dia,
           SUM(COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0))::numeric AS valor,
           COUNT(*)::int AS qtd
    FROM parcelas p
    JOIN contratos c ON c.id = p.contrato_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND p.status IN ('pendente', 'parcialmente_pago')
      AND p.data_vencimento BETWEEN v_primeiro_dia AND v_ultimo_dia
    GROUP BY p.data_vencimento
  ),
  computado AS (
    SELECT
      d.dia,
      CASE
        WHEN d.dia < CURRENT_DATE THEN 'passado'
        WHEN d.dia = CURRENT_DATE THEN 'hoje'
        ELSE 'futuro'
      END AS tipo,
      CASE
        WHEN d.dia < CURRENT_DATE THEN COALESCE(pg.valor, 0)
        ELSE COALESCE(pr.valor, 0)
      END AS valor,
      CASE
        WHEN d.dia < CURRENT_DATE THEN COALESCE(pg.qtd, 0)
        ELSE COALESCE(pr.qtd, 0)
      END AS qtd_movimentacoes,
      CASE WHEN d.dia = CURRENT_DATE THEN COALESCE(pg.valor, 0) ELSE NULL END AS ja_recebido_hoje
    FROM dias d
    LEFT JOIN pagamentos_dia pg ON pg.dia = d.dia
    LEFT JOIN previstos_dia pr ON pr.dia = d.dia
  )
  SELECT
    COALESCE(jsonb_agg(
      CASE
        WHEN tipo = 'hoje' THEN
          jsonb_build_object(
            'data', to_char(dia, 'YYYY-MM-DD'),
            'tipo', tipo,
            'valor', valor,
            'qtd_movimentacoes', qtd_movimentacoes,
            'ja_recebido_hoje', COALESCE(ja_recebido_hoje, 0)
          )
        ELSE
          jsonb_build_object(
            'data', to_char(dia, 'YYYY-MM-DD'),
            'tipo', tipo,
            'valor', valor,
            'qtd_movimentacoes', qtd_movimentacoes
          )
      END
      ORDER BY dia
    ), '[]'::jsonb),
    COALESCE(SUM(CASE WHEN tipo = 'passado' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo IN ('hoje','futuro') THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'passado' THEN qtd_movimentacoes ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo IN ('hoje','futuro') THEN qtd_movimentacoes ELSE 0 END), 0)
  INTO v_dias, v_recebido_mes, v_previsto_mes, v_qtd_recebimentos, v_qtd_previstos
  FROM computado;

  RETURN jsonb_build_object(
    'dias', v_dias,
    'totais', jsonb_build_object(
      'recebido_mes', v_recebido_mes,
      'previsto_mes', v_previsto_mes,
      'qtd_recebimentos_mes', v_qtd_recebimentos,
      'qtd_previstos_mes', v_qtd_previstos
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calendario_mensal(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendario_mensal(integer, integer) TO authenticated;

-- =========================================================
-- RPC: calendario_dia_detalhes(p_data)
-- =========================================================
CREATE OR REPLACE FUNCTION public.calendario_dia_detalhes(p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tipo text;
  v_recebimentos jsonb;
  v_previstos jsonb;
  v_total_recebido numeric := 0;
  v_total_previsto numeric := 0;
  v_qtd_recebimentos integer := 0;
  v_qtd_previstos integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Date is required';
  END IF;

  v_tipo := CASE
    WHEN p_data < CURRENT_DATE THEN 'passado'
    WHEN p_data = CURRENT_DATE THEN 'hoje'
    ELSE 'futuro'
  END;

  SELECT
    COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.data_pagamento), '[]'::jsonb),
    COALESCE(SUM(t.valor_pago), 0),
    COUNT(*)
  INTO v_recebimentos, v_total_recebido, v_qtd_recebimentos
  FROM (
    SELECT
      h.id AS evento_id,
      p.id AS parcela_id,
      c.id AS contrato_id,
      cl.nome AS cliente_nome,
      p.numero_parcela,
      c.numero_parcelas AS total_parcelas,
      p.data_vencimento AS data_vencimento_parcela,
      COALESCE(h.valor_pago, 0) AS valor_pago,
      h.tipo_pagamento,
      h.observacao,
      h.data_pagamento
    FROM parcelas_historico h
    JOIN parcelas p ON p.id = h.parcela_id
    JOIN contratos c ON c.id = p.contrato_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND h.tipo_evento = 'pagamento'
      AND (h.data_pagamento AT TIME ZONE 'UTC')::date = p_data
  ) t;

  SELECT
    COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.cliente_nome), '[]'::jsonb),
    COALESCE(SUM(t.valor_previsto), 0),
    COUNT(*)
  INTO v_previstos, v_total_previsto, v_qtd_previstos
  FROM (
    SELECT
      p.id AS parcela_id,
      c.id AS contrato_id,
      cl.nome AS cliente_nome,
      p.numero_parcela,
      c.numero_parcelas AS total_parcelas,
      (COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0))::numeric AS valor_previsto,
      COALESCE(p.valor_pago, 0)::numeric AS valor_ja_pago,
      GREATEST(0, (CURRENT_DATE - p.data_vencimento))::int AS dias_atraso,
      p.status,
      p.valor,
      p.valor_original,
      p.data_vencimento,
      c.percentual,
      c.tipo_juros,
      c.valor_emprestado,
      c.numero_parcelas AS contrato_numero_parcelas
    FROM parcelas p
    JOIN contratos c ON c.id = p.contrato_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND p.data_vencimento = p_data
      AND p.status IN ('pendente', 'parcialmente_pago')
  ) t;

  RETURN jsonb_build_object(
    'data', to_char(p_data, 'YYYY-MM-DD'),
    'tipo', v_tipo,
    'recebimentos', v_recebimentos,
    'previstos', v_previstos,
    'totais', jsonb_build_object(
      'total_recebido', v_total_recebido,
      'total_previsto', v_total_previsto,
      'qtd_recebimentos', v_qtd_recebimentos,
      'qtd_previstos', v_qtd_previstos
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calendario_dia_detalhes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendario_dia_detalhes(date) TO authenticated;