
-- =====================================================
-- BLOCO 1: RPCs TRANSACIONAIS
-- =====================================================

-- 1. criar_contrato_com_parcelas — transação atômica
CREATE OR REPLACE FUNCTION public.criar_contrato_com_parcelas(
  p_cliente_id uuid,
  p_valor_emprestado numeric,
  p_percentual numeric,
  p_periodicidade text,
  p_numero_parcelas integer,
  p_data_emprestimo date,
  p_tipo_juros text DEFAULT 'simples',
  p_permite_sabado boolean DEFAULT true,
  p_permite_domingo boolean DEFAULT false
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

  -- Validar usuário ativo
  IF NOT public.is_user_active(v_user_id) THEN
    RAISE EXCEPTION 'User account is not active';
  END IF;

  -- Validar que o cliente pertence ao usuário
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Client not found or not owned by user';
  END IF;

  -- Validar inputs
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

  -- Calcular valor total
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

  -- Inserir contrato
  INSERT INTO contratos (
    cliente_id, valor_emprestado, percentual, periodicidade,
    numero_parcelas, data_emprestimo, valor_total, status,
    tipo_juros, permite_cobranca_sabado, permite_cobranca_domingo
  ) VALUES (
    p_cliente_id, p_valor_emprestado, p_percentual, p_periodicidade,
    p_numero_parcelas, p_data_emprestimo, v_valor_total, 'ativo',
    p_tipo_juros, p_permite_sabado, p_permite_domingo
  ) RETURNING id INTO v_contrato_id;

  -- Gerar parcelas (reutiliza função existente)
  PERFORM public.gerar_parcelas(
    v_contrato_id, p_numero_parcelas, v_valor_parcela,
    p_data_emprestimo, p_periodicidade, p_permite_sabado, p_permite_domingo
  );

  RETURN v_contrato_id;
END;
$$;

-- 2. registrar_pagamento_parcela — pagamento atômico
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcela(
  p_parcela_id uuid,
  p_tipo text, -- 'total', 'juros', 'parcial'
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
  v_contrato RECORD;
  v_user_id uuid;
  v_valor_pagar numeric;
  v_novo_valor_pago numeric;
  v_novo_status text;
  v_tipo_pagamento text;
  v_juros numeric;
  v_todas_pagas boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Buscar parcela com validação de ownership
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

  -- Calcular valor a pagar conforme tipo
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

  -- Calcular novo valor pago e status
  v_novo_valor_pago := COALESCE(v_parcela.valor_pago, 0) + v_valor_pagar;
  
  IF p_tipo = 'total' THEN
    v_novo_status := 'pago';
  ELSE
    v_novo_status := 'pendente';
  END IF;

  -- Inserir histórico
  INSERT INTO parcelas_historico (
    parcela_id, valor_pago, tipo_pagamento, data_pagamento,
    observacao, tipo_evento
  ) VALUES (
    p_parcela_id, v_valor_pagar, v_tipo_pagamento,
    now(), p_observacao, 'pagamento'
  );

  -- Atualizar parcela
  UPDATE parcelas SET
    valor_pago = v_novo_valor_pago,
    status = v_novo_status,
    data_pagamento = p_data_pagamento,
    valor_original = COALESCE(valor_original, valor),
    updated_at = now()
  WHERE id = p_parcela_id;

  -- Se quitou a parcela, verificar se todas do contrato estão pagas
  IF v_novo_status = 'pago' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM parcelas
      WHERE contrato_id = v_parcela.contrato_id
      AND status != 'pago'
      AND id != p_parcela_id -- a parcela atual já foi marcada como pago acima
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

-- 3. estornar_pagamento_parcela — estorno atômico
CREATE OR REPLACE FUNCTION public.estornar_pagamento_parcela(
  p_parcela_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parcela RECORD;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validar ownership
  SELECT p.*, c.id as contrato_id_ref, c.status as contrato_status
  INTO v_parcela
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or not owned by user';
  END IF;

  -- Deletar histórico de pagamentos
  DELETE FROM parcelas_historico
  WHERE parcela_id = p_parcela_id AND tipo_evento = 'pagamento';

  -- Resetar parcela
  UPDATE parcelas SET
    status = 'pendente',
    data_pagamento = NULL,
    valor_pago = 0,
    updated_at = now()
  WHERE id = p_parcela_id;

  -- Se contrato estava quitado, reabrir
  IF v_parcela.contrato_status = 'quitado' THEN
    UPDATE contratos SET status = 'ativo', updated_at = now()
    WHERE id = v_parcela.contrato_id;
  END IF;
END;
$$;

-- 4. dashboard_stats — KPIs agregados
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'total_receber', COALESCE(SUM(CASE WHEN p.status IN ('pendente','parcialmente_pago') THEN COALESCE(p.valor_original, p.valor) ELSE 0 END), 0),
    'total_recebido', COALESCE(SUM(COALESCE(p.valor_pago, 0)), 0),
    'parcelas_vencidas', COALESCE(SUM(CASE WHEN p.status IN ('pendente','parcialmente_pago') AND p.data_vencimento < CURRENT_DATE THEN 1 ELSE 0 END), 0),
    'lucro', COALESCE(SUM(
      CASE WHEN p.status IN ('pago','parcialmente_pago') AND COALESCE(p.valor_pago, 0) > 0 THEN
        GREATEST(COALESCE(p.valor_pago, 0) - (c.valor_emprestado / c.numero_parcelas), 0)
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

  -- Lucro mensal (últimos 6 meses)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.mes_order), '[]'::jsonb) INTO v_lucro_mensal
  FROM (
    SELECT
      to_char(m.mes, 'Mon/YY') as mes,
      m.mes as mes_order,
      COALESCE(SUM(
        GREATEST(COALESCE(p.valor_pago, 0) - (c.valor_emprestado / c.numero_parcelas), 0)
      ), 0) as lucro
    FROM generate_series(
      date_trunc('month', CURRENT_DATE - interval '5 months'),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    ) m(mes)
    LEFT JOIN parcelas p ON p.data_pagamento >= m.mes::date
      AND p.data_pagamento < (m.mes + interval '1 month')::date
      AND p.status IN ('pago','parcialmente_pago')
      AND COALESCE(p.valor_pago, 0) > 0
    LEFT JOIN contratos c ON p.contrato_id = c.id
    LEFT JOIN clientes cl ON c.cliente_id = cl.id AND cl.user_id = v_user_id
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
$$;

-- =====================================================
-- FOREIGN KEYS (aditivas, não destrutivas)
-- =====================================================

DO $$
BEGIN
  -- contratos.cliente_id → clientes.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contratos_cliente_id_fkey' AND table_name = 'contratos'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
  END IF;

  -- parcelas.contrato_id → contratos.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parcelas_contrato_id_fkey' AND table_name = 'parcelas'
  ) THEN
    ALTER TABLE public.parcelas
      ADD CONSTRAINT parcelas_contrato_id_fkey
      FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE;
  END IF;

  -- parcelas_historico.parcela_id → parcelas.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parcelas_historico_parcela_id_fkey' AND table_name = 'parcelas_historico'
  ) THEN
    ALTER TABLE public.parcelas_historico
      ADD CONSTRAINT parcelas_historico_parcela_id_fkey
      FOREIGN KEY (parcela_id) REFERENCES public.parcelas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_parcelas_contrato_id ON public.parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON public.parcelas(status);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON public.contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_historico_parcela_id ON public.parcelas_historico(parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_data_vencimento ON public.parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_data_pagamento ON public.parcelas(data_pagamento);
