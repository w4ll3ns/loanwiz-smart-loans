-- 1. Adicionar colunas na tabela contratos
ALTER TABLE contratos 
ADD COLUMN permite_cobranca_sabado BOOLEAN DEFAULT true,
ADD COLUMN permite_cobranca_domingo BOOLEAN DEFAULT false;

-- 2. Atualizar todos os contratos existentes
UPDATE contratos 
SET permite_cobranca_sabado = true, 
    permite_cobranca_domingo = false 
WHERE permite_cobranca_sabado IS NULL 
   OR permite_cobranca_domingo IS NULL;

-- 3. Criar função auxiliar para ajustar data pulando dias não permitidos
CREATE OR REPLACE FUNCTION ajustar_data_parcela(
  p_data DATE,
  p_permite_sabado BOOLEAN,
  p_permite_domingo BOOLEAN
) RETURNS DATE AS $$
DECLARE
  data_ajustada DATE;
  dia_semana INTEGER;
BEGIN
  data_ajustada := p_data;
  
  LOOP
    dia_semana := EXTRACT(DOW FROM data_ajustada);
    
    -- Domingo = 0, Sábado = 6
    IF (dia_semana = 0 AND NOT p_permite_domingo) THEN
      data_ajustada := data_ajustada + 1; -- Move para segunda
    ELSIF (dia_semana = 6 AND NOT p_permite_sabado) THEN
      -- Se não permite sábado, verificar se permite domingo
      IF p_permite_domingo THEN
        data_ajustada := data_ajustada + 1; -- Move para domingo
      ELSE
        data_ajustada := data_ajustada + 2; -- Move para segunda
      END IF;
    ELSE
      EXIT; -- Data é válida
    END IF;
  END LOOP;
  
  RETURN data_ajustada;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar função auxiliar para recalcular parcelas futuras
CREATE OR REPLACE FUNCTION recalcular_parcelas_futuras(
  p_contrato_id UUID,
  p_intervalo INTERVAL,
  p_permite_sabado BOOLEAN,
  p_permite_domingo BOOLEAN
) RETURNS void AS $$
DECLARE
  parcela_anterior RECORD;
  parcela_atual RECORD;
  nova_data DATE;
BEGIN
  -- Obter parcelas pendentes ordenadas
  FOR parcela_atual IN
    SELECT id, numero_parcela, data_vencimento
    FROM parcelas
    WHERE contrato_id = p_contrato_id
      AND status = 'pendente'
    ORDER BY numero_parcela
  LOOP
    -- Buscar a parcela anterior (pode ser paga ou pendente)
    SELECT data_vencimento INTO parcela_anterior
    FROM parcelas
    WHERE contrato_id = p_contrato_id
      AND numero_parcela = parcela_atual.numero_parcela - 1;
    
    IF FOUND THEN
      -- Calcular nova data baseada na anterior + intervalo
      nova_data := parcela_anterior.data_vencimento + p_intervalo;
      nova_data := ajustar_data_parcela(nova_data, p_permite_sabado, p_permite_domingo);
      
      -- Atualizar apenas se mudou
      IF nova_data != parcela_atual.data_vencimento THEN
        UPDATE parcelas
        SET data_vencimento = nova_data
        WHERE id = parcela_atual.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Atualizar função gerar_parcelas para respeitar dias permitidos
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
  
  -- Ajustar data base para não cair em dia proibido
  data_base := ajustar_data_parcela(data_base, p_permite_sabado, p_permite_domingo);

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
    
    -- Ajustar cada data de vencimento
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
  END LOOP;
END;
$function$;

-- 6. Script para corrigir parcelas que caem em domingo
DO $$
DECLARE
  parcela_record RECORD;
  nova_data DATE;
  contrato_info RECORD;
  intervalo_base INTERVAL;
BEGIN
  -- Para cada parcela em domingo
  FOR parcela_record IN 
    SELECT p.id, p.contrato_id, p.numero_parcela, p.data_vencimento, p.status
    FROM parcelas p
    WHERE EXTRACT(DOW FROM p.data_vencimento) = 0
    ORDER BY p.contrato_id, p.numero_parcela
  LOOP
    -- Obter info do contrato
    SELECT periodicidade, permite_cobranca_sabado, permite_cobranca_domingo
    INTO contrato_info
    FROM contratos
    WHERE id = parcela_record.contrato_id;
    
    -- Mover domingo para segunda-feira
    nova_data := parcela_record.data_vencimento + 1;
    
    -- Atualizar a parcela
    UPDATE parcelas 
    SET data_vencimento = nova_data
    WHERE id = parcela_record.id;
    
    RAISE NOTICE 'Parcela % do contrato % movida de % para %', 
      parcela_record.numero_parcela, 
      parcela_record.contrato_id, 
      parcela_record.data_vencimento, 
      nova_data;
  END LOOP;
  
  -- Agora recalcular parcelas futuras para manter intervalo correto
  FOR contrato_info IN
    SELECT DISTINCT c.id, c.periodicidade, c.permite_cobranca_sabado, c.permite_cobranca_domingo
    FROM contratos c
    WHERE EXISTS (
      SELECT 1 FROM parcelas p 
      WHERE p.contrato_id = c.id 
      AND p.status = 'pendente'
    )
  LOOP
    -- Determinar intervalo base
    CASE contrato_info.periodicidade
      WHEN 'diario' THEN intervalo_base := INTERVAL '1 day';
      WHEN 'semanal' THEN intervalo_base := INTERVAL '1 week';
      WHEN 'quinzenal' THEN intervalo_base := INTERVAL '15 days';
      WHEN 'mensal' THEN intervalo_base := INTERVAL '1 month';
    END CASE;
    
    -- Recalcular datas das parcelas futuras pendentes
    PERFORM recalcular_parcelas_futuras(
      contrato_info.id, 
      intervalo_base,
      contrato_info.permite_cobranca_sabado,
      contrato_info.permite_cobranca_domingo
    );
  END LOOP;
END $$;