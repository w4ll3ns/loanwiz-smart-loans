CREATE OR REPLACE FUNCTION public.excluir_contrato(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_contrato RECORD;
  v_tem_pagamento boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.id, c.status, cl.user_id
  INTO v_contrato
  FROM contratos c
  JOIN clientes cl ON cl.id = c.cliente_id
  WHERE c.id = p_contrato_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;

  IF v_contrato.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_contrato.status = 'quitado' THEN
    RAISE EXCEPTION 'Cannot delete a settled contract';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM parcelas
    WHERE contrato_id = p_contrato_id
      AND (status = 'pago' OR COALESCE(valor_pago, 0) > 0)
  ) INTO v_tem_pagamento;

  IF v_tem_pagamento THEN
    RAISE EXCEPTION 'Cannot delete contract with payments';
  END IF;

  DELETE FROM parcelas_historico
  WHERE parcela_id IN (SELECT id FROM parcelas WHERE contrato_id = p_contrato_id);

  DELETE FROM parcelas WHERE contrato_id = p_contrato_id;
  DELETE FROM contratos WHERE id = p_contrato_id;
END;
$$;