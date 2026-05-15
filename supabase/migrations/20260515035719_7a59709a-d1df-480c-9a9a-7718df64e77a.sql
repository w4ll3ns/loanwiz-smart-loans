
CREATE OR REPLACE FUNCTION public.alterar_data_parcela(
  p_parcela_id uuid,
  p_nova_data date,
  p_justificativa text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_parcela RECORD;
  v_just text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_justificativa IS NULL OR length(trim(p_justificativa)) = 0 THEN
    RAISE EXCEPTION 'Justificativa é obrigatória';
  END IF;

  IF p_nova_data IS NULL THEN
    RAISE EXCEPTION 'Nova data é obrigatória';
  END IF;

  v_just := trim(p_justificativa);

  SELECT p.id, p.data_vencimento, p.data_vencimento_original, p.status,
         c.id AS contrato_id, c.status AS contrato_status
  INTO v_parcela
  FROM public.parcelas p
  JOIN public.contratos c ON c.id = p.contrato_id
  JOIN public.clientes cl ON cl.id = c.cliente_id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or not owned by user';
  END IF;

  IF v_parcela.status = 'pago' THEN
    RAISE EXCEPTION 'Cannot change due date of paid installment';
  END IF;

  IF v_parcela.contrato_status = 'quitado' THEN
    RAISE EXCEPTION 'Cannot change due date on settled contract';
  END IF;

  IF p_nova_data = v_parcela.data_vencimento THEN
    RAISE EXCEPTION 'Nova data must be different from current due date';
  END IF;

  UPDATE public.parcelas
  SET data_vencimento = p_nova_data,
      justificativa_alteracao_data = v_just,
      data_vencimento_original = COALESCE(data_vencimento_original, v_parcela.data_vencimento),
      updated_at = now()
  WHERE id = p_parcela_id;

  INSERT INTO public.parcelas_historico (
    parcela_id, tipo_evento,
    data_vencimento_anterior, data_vencimento_nova,
    observacao, data_pagamento
  ) VALUES (
    p_parcela_id, 'alteracao_data',
    v_parcela.data_vencimento, p_nova_data,
    v_just, now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_data_parcela(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_data_parcela(uuid, date, text) TO authenticated;
