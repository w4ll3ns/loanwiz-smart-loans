CREATE OR REPLACE FUNCTION public.calendario_mensal(p_mes integer, p_ano integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_primeiro_dia date;
  v_ultimo_dia date;
  v_dias jsonb;
  v_recebido_mes numeric := 0;
  v_previsto_mes numeric := 0;
  v_atrasado_mes numeric := 0;
  v_qtd_recebimentos integer := 0;
  v_qtd_previstos integer := 0;
  v_qtd_atrasados integer := 0;
  v_total_emprestado_mes numeric := 0;
  v_qtd_emprestimos_mes integer := 0;
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
    SELECT (h.data_pagamento AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           SUM(COALESCE(h.valor_pago, 0))::numeric AS valor,
           COUNT(*)::int AS qtd
    FROM parcelas_historico h
    JOIN parcelas p ON p.id = h.parcela_id
    JOIN contratos c ON c.id = p.contrato_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND h.tipo_evento = 'pagamento'
      AND (h.data_pagamento AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_primeiro_dia AND v_ultimo_dia
    GROUP BY (h.data_pagamento AT TIME ZONE 'America/Sao_Paulo')::date
  ),
  previstos_dia AS (
    SELECT p.data_vencimento AS dia,
           SUM(COALESCE(p.valor_original, p.valor))::numeric AS valor,
           COUNT(*)::int AS qtd
    FROM parcelas p
    JOIN contratos c ON c.id = p.contrato_id
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND p.status IN ('pendente', 'parcialmente_pago')
      AND p.data_vencimento BETWEEN v_primeiro_dia AND v_ultimo_dia
    GROUP BY p.data_vencimento
  ),
  saidas_dia AS (
    SELECT c.data_emprestimo AS dia,
           SUM(COALESCE(c.valor_emprestado, 0))::numeric AS valor,
           COUNT(*)::int AS qtd
    FROM contratos c
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND c.data_emprestimo BETWEEN v_primeiro_dia AND v_ultimo_dia
    GROUP BY c.data_emprestimo
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
      CASE WHEN d.dia = CURRENT_DATE THEN COALESCE(pg.valor, 0) ELSE 0 END AS ja_recebido_hoje,
      CASE WHEN d.dia = CURRENT_DATE THEN COALESCE(pg.qtd, 0) ELSE 0 END AS qtd_recebido_hoje,
      CASE WHEN d.dia < CURRENT_DATE THEN COALESCE(pr.valor, 0) ELSE 0 END AS valor_atrasado,
      CASE WHEN d.dia < CURRENT_DATE THEN COALESCE(pr.qtd, 0) ELSE 0 END AS qtd_atrasados,
      COALESCE(sd.valor, 0) AS valor_saida,
      COALESCE(sd.qtd, 0) AS qtd_saidas
    FROM dias d
    LEFT JOIN pagamentos_dia pg ON pg.dia = d.dia
    LEFT JOIN previstos_dia pr ON pr.dia = d.dia
    LEFT JOIN saidas_dia sd ON sd.dia = d.dia
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'data', to_char(dia, 'YYYY-MM-DD'),
        'tipo', tipo,
        'valor', valor,
        'qtd_movimentacoes', qtd_movimentacoes,
        'ja_recebido_hoje', ja_recebido_hoje,
        'valor_atrasado', valor_atrasado,
        'qtd_atrasados', qtd_atrasados,
        'valor_saida', valor_saida,
        'qtd_saidas', qtd_saidas
      )
      ORDER BY dia
    ), '[]'::jsonb),
    COALESCE(SUM(CASE WHEN tipo = 'passado' THEN valor ELSE 0 END), 0) + COALESCE(SUM(ja_recebido_hoje), 0),
    COALESCE(SUM(CASE WHEN tipo IN ('hoje','futuro') THEN valor ELSE 0 END), 0),
    COALESCE(SUM(valor_atrasado), 0),
    COALESCE(SUM(CASE WHEN tipo = 'passado' THEN qtd_movimentacoes ELSE 0 END), 0) + COALESCE(SUM(qtd_recebido_hoje), 0),
    COALESCE(SUM(CASE WHEN tipo IN ('hoje','futuro') THEN qtd_movimentacoes ELSE 0 END), 0),
    COALESCE(SUM(qtd_atrasados), 0),
    COALESCE(SUM(valor_saida), 0),
    COALESCE(SUM(qtd_saidas), 0)
  INTO
    v_dias,
    v_recebido_mes,
    v_previsto_mes,
    v_atrasado_mes,
    v_qtd_recebimentos,
    v_qtd_previstos,
    v_qtd_atrasados,
    v_total_emprestado_mes,
    v_qtd_emprestimos_mes
  FROM computado;

  RETURN jsonb_build_object(
    'dias', v_dias,
    'totais', jsonb_build_object(
      'recebido_mes', v_recebido_mes,
      'previsto_mes', v_previsto_mes,
      'total_atrasado_mes', v_atrasado_mes,
      'qtd_recebimentos_mes', v_qtd_recebimentos,
      'qtd_previstos_mes', v_qtd_previstos,
      'qtd_atrasados_mes', v_qtd_atrasados,
      'total_emprestado_mes', v_total_emprestado_mes,
      'qtd_emprestimos_mes', v_qtd_emprestimos_mes
    )
  );
END;
$function$;