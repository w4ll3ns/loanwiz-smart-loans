-- Atualizar a função gerar_parcelas para incluir valor_original
CREATE OR REPLACE FUNCTION public.gerar_parcelas(p_contrato_id uuid, p_numero_parcelas integer, p_valor_parcela numeric, p_data_inicio date, p_periodicidade text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  i INTEGER;
  data_vencimento DATE;
  data_base DATE;
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

  -- Calculate base date for first installment based on periodicity
  CASE p_periodicidade
    WHEN 'diario' THEN
      data_base := p_data_inicio + INTERVAL '1 day';
    WHEN 'semanal' THEN
      data_base := p_data_inicio + INTERVAL '1 week';
    WHEN 'quinzenal' THEN
      data_base := p_data_inicio + INTERVAL '15 days';
    WHEN 'mensal' THEN
      data_base := p_data_inicio + INTERVAL '1 month';
  END CASE;

  -- Generate installments
  FOR i IN 1..p_numero_parcelas LOOP
    CASE p_periodicidade
      WHEN 'diario' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '1 day');
      WHEN 'semanal' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '1 week');
      WHEN 'quinzenal' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '15 days');
      WHEN 'mensal' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '1 month');
    END CASE;

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
  END LOOP;
END;
$function$;