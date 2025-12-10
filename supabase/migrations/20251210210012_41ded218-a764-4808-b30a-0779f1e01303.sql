-- Atualizar função gerar_parcelas para calcular datas incrementalmente
-- Isso evita que parcelas fiquem com a mesma data quando ajustadas para dias permitidos

CREATE OR REPLACE FUNCTION public.gerar_parcelas(
  p_contrato_id uuid, 
  p_numero_parcelas integer, 
  p_valor_parcela numeric, 
  p_data_inicio date, 
  p_periodicidade text,
  p_permite_sabado boolean DEFAULT true,
  p_permite_domingo boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  i INTEGER;
  data_vencimento DATE;
  data_anterior DATE;
  intervalo INTERVAL;
BEGIN
  -- Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorization check: verify user owns the contract
  IF NOT EXISTS (
    SELECT 1 FROM public.contratos c
    JOIN public.clientes cl ON c.cliente_id = cl.id
    WHERE c.id = p_contrato_id
    AND cl.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to generate installments for this contract';
  END IF;

  -- Input validation
  IF p_numero_parcelas <= 0 THEN
    RAISE EXCEPTION 'Number of installments must be positive';
  END IF;

  IF p_valor_parcela <= 0 THEN
    RAISE EXCEPTION 'Installment value must be positive';
  END IF;

  IF p_periodicidade NOT IN ('diario', 'semanal', 'quinzenal', 'mensal') THEN
    RAISE EXCEPTION 'Invalid periodicidade: %. Must be diario, semanal, quinzenal, or mensal', p_periodicidade;
  END IF;

  -- Definir intervalo baseado na periodicidade
  CASE p_periodicidade
    WHEN 'diario' THEN intervalo := INTERVAL '1 day';
    WHEN 'semanal' THEN intervalo := INTERVAL '1 week';
    WHEN 'quinzenal' THEN intervalo := INTERVAL '15 days';
    WHEN 'mensal' THEN intervalo := INTERVAL '1 month';
  END CASE;
  
  -- Ponto de partida é a data do empréstimo
  data_anterior := p_data_inicio;

  -- Gerar parcelas - CALCULANDO CADA DATA A PARTIR DA ANTERIOR AJUSTADA
  FOR i IN 1..p_numero_parcelas LOOP
    -- Calcular próxima data baseada na data ANTERIOR (não na base fixa)
    data_vencimento := data_anterior + intervalo;
    
    -- Ajustar se cair em dia proibido (sábado/domingo)
    data_vencimento := ajustar_data_parcela(data_vencimento, p_permite_sabado, p_permite_domingo);

    INSERT INTO public.parcelas (
      contrato_id,
      numero_parcela,
      valor,
      valor_original,
      data_vencimento,
      status,
      valor_pago
    ) VALUES (
      p_contrato_id,
      i,
      p_valor_parcela,
      p_valor_parcela,
      data_vencimento,
      'pendente',
      0
    );
    
    -- A próxima parcela será calculada a partir DESTA data ajustada
    data_anterior := data_vencimento;
  END LOOP;
END;
$function$;

-- Também atualizar a versão sem parâmetros de sábado/domingo para manter consistência
CREATE OR REPLACE FUNCTION public.gerar_parcelas(
  p_contrato_id uuid, 
  p_numero_parcelas integer, 
  p_valor_parcela numeric, 
  p_data_inicio date, 
  p_periodicidade text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Chamar a versão completa com valores padrão
  PERFORM public.gerar_parcelas(
    p_contrato_id,
    p_numero_parcelas,
    p_valor_parcela,
    p_data_inicio,
    p_periodicidade,
    true,  -- permite sábado por padrão
    false  -- não permite domingo por padrão
  );
END;
$function$;