CREATE OR REPLACE FUNCTION public.admin_get_user_stats(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_clientes', (SELECT COUNT(*) FROM clientes WHERE user_id = p_user_id),
      'total_contratos', (
        SELECT COUNT(*) FROM contratos c
        JOIN clientes cl ON c.cliente_id = cl.id
        WHERE cl.user_id = p_user_id
      ),
      'valor_emprestado_ativo', (
        SELECT COALESCE(SUM(c.valor_emprestado), 0)
        FROM contratos c JOIN clientes cl ON c.cliente_id = cl.id
        WHERE cl.user_id = p_user_id AND c.status = 'ativo'
      ),
      'valor_emprestado_total', (
        SELECT COALESCE(SUM(c.valor_emprestado), 0)
        FROM contratos c JOIN clientes cl ON c.cliente_id = cl.id
        WHERE cl.user_id = p_user_id
      ),
      'valor_emprestado', (
        SELECT COALESCE(SUM(c.valor_emprestado), 0)
        FROM contratos c JOIN clientes cl ON c.cliente_id = cl.id
        WHERE cl.user_id = p_user_id
      ),
      'valor_a_receber', (
        SELECT COALESCE(SUM(COALESCE(p.valor_original, p.valor)), 0)
        FROM parcelas p
        JOIN contratos c ON p.contrato_id = c.id
        JOIN clientes cl ON c.cliente_id = cl.id
        WHERE cl.user_id = p_user_id AND p.status IN ('pendente', 'parcialmente_pago')
      ),
      'valor_recebido', (
        SELECT COALESCE(SUM(COALESCE(p.valor_pago, 0)), 0)
        FROM parcelas p
        JOIN contratos c ON p.contrato_id = c.id
        JOIN clientes cl ON c.cliente_id = cl.id
        WHERE cl.user_id = p_user_id
      )
    )
  );
END;
$function$;