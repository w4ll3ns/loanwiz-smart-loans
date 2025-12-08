-- Função para recalcular contrato e parcelas quando tipo de juros é alterado
CREATE OR REPLACE FUNCTION public.recalcular_contrato_parcelas(
  p_contrato_id uuid,
  p_tipo_juros text,
  p_percentual numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato RECORD;
  v_valor_total_novo numeric;
  v_valor_ja_pago numeric;
  v_parcelas_pendentes integer;
  v_valor_parcela_nova numeric;
BEGIN
  -- Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Buscar contrato com dados do cliente
  SELECT c.*, cl.user_id INTO v_contrato
  FROM contratos c
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE c.id = p_contrato_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;

  -- Verificar autorização (apenas dono pode editar)
  IF v_contrato.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Não permitir edição de contrato quitado
  IF v_contrato.status = 'quitado' THEN
    RAISE EXCEPTION 'Cannot edit a settled contract';
  END IF;

  -- Validar tipo de juros
  IF p_tipo_juros NOT IN ('simples', 'parcela', 'composto') THEN
    RAISE EXCEPTION 'Invalid interest type: %. Must be simples, parcela, or composto', p_tipo_juros;
  END IF;

  -- Usar percentual existente se não fornecido
  IF p_percentual IS NULL THEN
    p_percentual := v_contrato.percentual;
  END IF;

  -- Calcular novo valor total baseado no tipo de juros
  CASE p_tipo_juros
    WHEN 'simples' THEN
      v_valor_total_novo := v_contrato.valor_emprestado + (v_contrato.valor_emprestado * p_percentual / 100);
    WHEN 'parcela' THEN
      v_valor_total_novo := v_contrato.valor_emprestado + (v_contrato.valor_emprestado * (p_percentual / 100) * v_contrato.numero_parcelas);
    WHEN 'composto' THEN
      v_valor_total_novo := v_contrato.valor_emprestado * POWER(1 + (p_percentual / 100), v_contrato.numero_parcelas);
  END CASE;

  -- Arredondar para 2 casas decimais
  v_valor_total_novo := ROUND(v_valor_total_novo, 2);

  -- Obter valor já pago (parcelas com status 'pago')
  SELECT COALESCE(SUM(valor_pago), 0) INTO v_valor_ja_pago
  FROM parcelas WHERE contrato_id = p_contrato_id AND status = 'pago';

  -- Contar parcelas pendentes
  SELECT COUNT(*) INTO v_parcelas_pendentes
  FROM parcelas WHERE contrato_id = p_contrato_id AND status = 'pendente';

  IF v_parcelas_pendentes = 0 THEN
    RAISE EXCEPTION 'No pending installments to recalculate';
  END IF;

  -- Calcular novo valor por parcela pendente
  v_valor_parcela_nova := ROUND((v_valor_total_novo - v_valor_ja_pago) / v_parcelas_pendentes, 2);

  -- Atualizar contrato
  UPDATE contratos SET
    tipo_juros = p_tipo_juros,
    percentual = p_percentual,
    valor_total = v_valor_total_novo,
    updated_at = now()
  WHERE id = p_contrato_id;

  -- Atualizar apenas parcelas pendentes
  UPDATE parcelas SET
    valor = v_valor_parcela_nova,
    valor_original = v_valor_parcela_nova,
    updated_at = now()
  WHERE contrato_id = p_contrato_id AND status = 'pendente';
END;
$$;