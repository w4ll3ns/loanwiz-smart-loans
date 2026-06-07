CREATE OR REPLACE FUNCTION public.dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_result jsonb;
  v_stats jsonb;
  v_proximos jsonb;
  v_lucro_mensal jsonb;
  v_status_dist jsonb;
  v_capital_mensal jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- KPIs principais
  SELECT jsonb_build_object(
    'total_emprestado', COALESCE(SUM(CASE WHEN c.status = 'ativo' THEN c.valor_emprestado ELSE 0 END), 0),
    'clientes_ativos', (SELECT COUNT(*) FROM clientes WHERE user_id = v_user_id),
    'contratos_ativos', COALESCE(SUM(CASE WHEN c.status = 'ativo' THEN 1 ELSE 0 END), 0)
  ) INTO v_stats
  FROM contratos c
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE cl.user_id = v_user_id;

  -- Totais de parcelas
  SELECT v_stats || jsonb_build_object(
    'total_receber', COALESCE(SUM(CASE
        WHEN p.status IN ('pendente','parcialmente_pago')
        THEN COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0)
        ELSE 0 END), 0),
    'total_recebido', COALESCE(SUM(COALESCE(p.valor_pago, 0)), 0),
    'parcelas_vencidas', COALESCE(SUM(CASE WHEN p.status IN ('pendente','parcialmente_pago') AND p.data_vencimento < CURRENT_DATE THEN 1 ELSE 0 END), 0),
    'valor_vencido', COALESCE(SUM(
      CASE WHEN p.status IN ('pendente','parcialmente_pago')
           AND p.data_vencimento < CURRENT_DATE
      THEN COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0)
      ELSE 0 END
    ), 0),
    'lucro', COALESCE(SUM(
      CASE WHEN p.status IN ('pago','parcialmente_pago') AND COALESCE(p.valor_pago, 0) > 0 THEN
        GREATEST(COALESCE(p.valor_pago, 0) - (c.valor_emprestado / NULLIF(c.numero_parcelas, 0)), 0)
      ELSE 0 END
    ), 0)
  ) INTO v_stats
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE cl.user_id = v_user_id;

  -- Próximos vencimentos (top 4)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_proximos
  FROM (
    SELECT
      cl.nome as cliente,
      COALESCE(p.valor_original, p.valor) as valor,
      p.data_vencimento as data,
      CASE
        WHEN p.data_vencimento < CURRENT_DATE THEN 'vencido'
        WHEN p.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
        ELSE 'proximo'
      END as status
    FROM parcelas p
    JOIN contratos c ON p.contrato_id = c.id
    JOIN clientes cl ON c.cliente_id = cl.id
    WHERE cl.user_id = v_user_id AND p.status IN ('pendente','parcialmente_pago')
    ORDER BY p.data_vencimento ASC
    LIMIT 4
  ) t;

  -- Lucro mensal (últimos 6 meses) -- CORRIGIDO: filtro de usuário aplicado de fato
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.mes_order), '[]'::jsonb) INTO v_lucro_mensal
  FROM (
    SELECT
      to_char(m.mes, 'Mon/YY') as mes,
      m.mes as mes_order,
      COALESCE(SUM(pp.lucro_parcela), 0) as lucro
    FROM generate_series(
      date_trunc('month', CURRENT_DATE - interval '5 months'),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    ) m(mes)
    LEFT JOIN (
      SELECT p.data_pagamento,
             GREATEST(COALESCE(p.valor_pago, 0)
                      - (c.valor_emprestado / NULLIF(c.numero_parcelas, 0)), 0) AS lucro_parcela
      FROM parcelas p
      JOIN contratos c ON p.contrato_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      WHERE cl.user_id = v_user_id
        AND p.status IN ('pago','parcialmente_pago')
        AND COALESCE(p.valor_pago, 0) > 0
    ) pp ON pp.data_pagamento >= m.mes::date
        AND pp.data_pagamento < (m.mes + interval '1 month')::date
    GROUP BY m.mes
  ) t;

  -- Distribuição por status
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_status_dist
  FROM (
    SELECT
      CASE
        WHEN p.status = 'pago' THEN 'Pagas'
        WHEN p.status = 'parcialmente_pago' THEN 'Parciais'
        WHEN p.data_vencimento < CURRENT_DATE THEN 'Atrasadas'
        ELSE 'Pendentes'
      END as name,
      COUNT(*) as value
    FROM parcelas p
    JOIN contratos c ON p.contrato_id = c.id
    JOIN clientes cl ON c.cliente_id = cl.id
    WHERE cl.user_id = v_user_id
    GROUP BY 1
  ) t;

  -- Capital mensal (últimos 6 meses)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.mes_order), '[]'::jsonb) INTO v_capital_mensal
  FROM (
    SELECT
      to_char(m.mes, 'Mon/YY') as mes,
      m.mes as mes_order,
      COALESCE((
        SELECT SUM(c2.valor_emprestado)
        FROM contratos c2
        JOIN clientes cl2 ON c2.cliente_id = cl2.id
        WHERE cl2.user_id = v_user_id
          AND c2.data_emprestimo >= m.mes::date
          AND c2.data_emprestimo < (m.mes + interval '1 month')::date
      ), 0) as emprestado,
      COALESCE((
        SELECT SUM(COALESCE(p2.valor_pago, 0))
        FROM parcelas p2
        JOIN contratos c2 ON p2.contrato_id = c2.id
        JOIN clientes cl2 ON c2.cliente_id = cl2.id
        WHERE cl2.user_id = v_user_id
          AND p2.data_pagamento >= m.mes::date
          AND p2.data_pagamento < (m.mes + interval '1 month')::date
          AND p2.status IN ('pago','parcialmente_pago')
      ), 0) as recebido
    FROM generate_series(
      date_trunc('month', CURRENT_DATE - interval '5 months'),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    ) m(mes)
  ) t;

  RETURN v_stats || jsonb_build_object(
    'proximos_vencimentos', v_proximos,
    'lucro_mensal', v_lucro_mensal,
    'status_distribuicao', v_status_dist,
    'capital_mensal', v_capital_mensal
  );
END;
$function$;