-- Remove admin view policies from operational tables
DROP POLICY IF EXISTS "Admins can view all clientes" ON clientes;
DROP POLICY IF EXISTS "Admins can view all contratos" ON contratos;
DROP POLICY IF EXISTS "Admins can view all parcelas" ON parcelas;
DROP POLICY IF EXISTS "Admins can view all parcelas_historico" ON parcelas_historico;

-- Function for global stats (admin only)
CREATE OR REPLACE FUNCTION admin_get_global_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  RETURN (
    SELECT json_build_object(
      'total_clientes', (SELECT COUNT(*) FROM clientes),
      'total_contratos', (SELECT COUNT(*) FROM contratos),
      'valor_total_emprestado', (SELECT COALESCE(SUM(valor_emprestado), 0) FROM contratos)
    )
  );
END;
$$;

-- Function to get clients for a specific user (admin only)
CREATE OR REPLACE FUNCTION admin_get_user_clientes(p_user_id uuid)
RETURNS SETOF clientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  RETURN QUERY SELECT * FROM clientes WHERE user_id = p_user_id ORDER BY nome;
END;
$$;

-- Function to get contracts for a specific user (admin only)
CREATE OR REPLACE FUNCTION admin_get_user_contratos(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  cliente_nome text,
  valor_emprestado numeric,
  valor_total numeric,
  status text,
  data_emprestimo date,
  numero_parcelas integer,
  periodicidade text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  RETURN QUERY 
  SELECT 
    c.id,
    cl.nome as cliente_nome,
    c.valor_emprestado,
    c.valor_total,
    c.status,
    c.data_emprestimo,
    c.numero_parcelas,
    c.periodicidade
  FROM contratos c
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE cl.user_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$;

-- Function for user-specific stats (admin only)
CREATE OR REPLACE FUNCTION admin_get_user_stats(p_user_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  RETURN (
    SELECT json_build_object(
      'total_clientes', (SELECT COUNT(*) FROM clientes WHERE user_id = p_user_id),
      'total_contratos', (SELECT COUNT(*) FROM contratos c JOIN clientes cl ON c.cliente_id = cl.id WHERE cl.user_id = p_user_id),
      'valor_emprestado', (SELECT COALESCE(SUM(c.valor_emprestado), 0) FROM contratos c JOIN clientes cl ON c.cliente_id = cl.id WHERE cl.user_id = p_user_id),
      'valor_a_receber', (SELECT COALESCE(SUM(p.valor - COALESCE(p.valor_pago, 0)), 0) FROM parcelas p JOIN contratos c ON p.contrato_id = c.id JOIN clientes cl ON c.cliente_id = cl.id WHERE cl.user_id = p_user_id AND p.status = 'pendente'),
      'valor_recebido', (SELECT COALESCE(SUM(COALESCE(p.valor_pago, 0)), 0) FROM parcelas p JOIN contratos c ON p.contrato_id = c.id JOIN clientes cl ON c.cliente_id = cl.id WHERE cl.user_id = p_user_id)
    )
  );
END;
$$;