-- Corrigir search_path nas funções auxiliares
CREATE OR REPLACE FUNCTION ajustar_data_parcela(
  p_data DATE,
  p_permite_sabado BOOLEAN,
  p_permite_domingo BOOLEAN
) RETURNS DATE 
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION recalcular_parcelas_futuras(
  p_contrato_id UUID,
  p_intervalo INTERVAL,
  p_permite_sabado BOOLEAN,
  p_permite_domingo BOOLEAN
) RETURNS void 
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;